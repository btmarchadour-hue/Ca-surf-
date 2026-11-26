import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, LocateFixed, RefreshCw, Search, UserRound, Users, Waves } from 'lucide-react';
import { AddSpotModal } from './components/AddSpotModal';
import { CrewView } from './components/CrewView';
import { DashboardView } from './components/DashboardView';
import { MorningAlertModal } from './components/MorningAlertModal';
import { OnboardingGate } from './components/OnboardingGate';
import { OtherSpotsSearchModal } from './components/OtherSpotsSearchModal';
import { SpotDetailPanel } from './components/SpotDetailPanel';
import { SpotsCatalogView } from './components/SpotsCatalogView';
import { SurferProfileView } from './components/SurferProfileView';
import {
  BUILTIN_SURF_SPOTS,
  DEFAULT_FAVORITE_SPOT_IDS,
  getImageForBreakType,
} from './data/spots';
import { auth, googleProvider } from './lib/firebase';
import {
  createCustomSpot,
  createSurfCrew,
  DEFAULT_SURFER_PREFS,
  deleteAlertLog,
  deleteCrewParkingReport,
  deleteCustomSpot,
  ensureUserProfile,
  joinSurfCrewByCode,
  leaveSurfCrew,
  logMorningAlert,
  publishCrewParkingReport,
  saveFullSurferProfile,
  subscribeAlertLogs,
  subscribeCrewMembers,
  subscribeCrewParkingReports,
  subscribeCustomSpots,
  subscribeUserCrews,
  subscribeUserProfile,
  switchActiveCrew,
  updateCrewSessionCheckIn,
  updateUserFavorites,
} from './lib/firestoreService';
import {
  fetchAllSpotsForecasts,
  getLocalDateKey,
  haversineKm,
  rankSpotsForDate,
} from './lib/surfEngine';
import {
  sanitizeParkingReports,
  sanitizeSpotIdList,
  sanitizeSurferPrefs,
  sanitizeUserLocation,
} from './lib/validation';
import type {
  ActiveTab,
  AlertLogRecord,
  BestWindowRecommendation,
  BreakType,
  CrewMemberRecord,
  CustomSpotRecord,
  ParkingReportRecord,
  SpotForecast,
  SurfCrewRecord,
  SurferPreferences,
  SurfSpot,
  UserLocation,
  UserProfile,
} from './types/surf';
import type { ParkingCheckSubmitPayload } from './components/ParkingCheckCard';

const LOCAL_FAV_KEY = 'houle_claire_guest_favorites_v2';
const LOCAL_PREFS_KEY = 'houle_claire_guest_surfer_prefs_v2';
const LOCAL_PARKING_KEY = 'ca_surf_local_parking_reports_v1';
const LOCAL_LOCATION_KEY = 'ca_surf_user_location_v1';
const NEARBY_RADIUS_KM = 100;

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [guestFavorites, setGuestFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_FAV_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as unknown;
        if (Array.isArray(parsed)) return sanitizeSpotIdList(parsed);
      }
    } catch {
      // ignore
    }
    return DEFAULT_FAVORITE_SPOT_IDS;
  });

  const [guestSurferPrefs, setGuestSurferPrefs] = useState<SurferPreferences>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PREFS_KEY);
      if (saved) return sanitizeSurferPrefs(JSON.parse(saved), DEFAULT_SURFER_PREFS);
    } catch {
      // ignore
    }
    return DEFAULT_SURFER_PREFS;
  });

  const [customSpots, setCustomSpots] = useState<CustomSpotRecord[]>([]);
  const [alertLogs, setAlertLogs] = useState<AlertLogRecord[]>([]);
  const [crews, setCrews] = useState<SurfCrewRecord[]>([]);
  const [crewMembers, setCrewMembers] = useState<CrewMemberRecord[]>([]);
  const [crewParkingReports, setCrewParkingReports] = useState<ParkingReportRecord[]>([]);
  const [localParkingReports, setLocalParkingReports] = useState<ParkingReportRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_PARKING_KEY);
      if (saved) return sanitizeParkingReports(JSON.parse(saved));
    } catch {
      // ignore
    }
    return [];
  });

  const [forecasts, setForecasts] = useState<Record<string, SpotForecast>>({});
  const [loadingForecasts, setLoadingForecasts] = useState(true);
  const [forecastError, setForecastError] = useState('');
  const [lastUpdatedLabel, setLastUpdatedLabel] = useState('');

  const [activeTab, setActiveTab] = useState<ActiveTab>('session');
  const [selectedSpotId, setSelectedSpotId] = useState<string | null>(null);
  const [alertModalDate, setAlertModalDate] = useState<string | null>(null);
  const [addSpotOpen, setAddSpotOpen] = useState(false);
  const [searchMenuOpen, setSearchMenuOpen] = useState(false);
  const [authError, setAuthError] = useState('');

  const [userLocation, setUserLocation] = useState<UserLocation | null>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_LOCATION_KEY);
      if (saved) return sanitizeUserLocation(JSON.parse(saved));
    } catch {
      // ignore
    }
    return null;
  });
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'granted' | 'denied' | 'error'>(
    () => (userLocation?.source === 'gps' ? 'granted' : 'idle')
  );
  const [geoError, setGeoError] = useState('');

  const lastTriggeredAlertKeyRef = useRef<string>('');

  // Merge verified free-API spots + user's Firestore custom spots
  const allSpots = useMemo<SurfSpot[]>(() => {
    const convertedCustom: SurfSpot[] = customSpots.map((c) => ({
      id: c.id,
      name: c.name,
      town: c.region,
      region: c.region,
      lat: c.lat,
      lng: c.lng,
      offshoreDeg: c.offshoreDeg,
      idealSwellDeg: (c.offshoreDeg + 180) % 360,
      idealMinWave: c.idealMinWave,
      idealMaxWave: c.idealMaxWave,
      breakType: c.breakType,
      difficulty: 'intermediate',
      bestBoards: ['midlength', 'fish', 'shortboard'],
      waveCharacter: 'Spot personnalisé connecté en direct à Open-Meteo Marine',
      idealTide: c.idealTide,
      apiProvider: 'Open-Meteo Marine',
      imageUrl: getImageForBreakType(c.breakType, c.region),
      isCustom: true,
    }));
    return [...BUILTIN_SURF_SPOTS, ...convertedCustom];
  }, [customSpots]);

  const favoriteSpotIds = profile ? profile.favoriteSpotIds : guestFavorites;
  const surferPrefs: SurferPreferences = profile
    ? {
        displayName: profile.displayName,
        surferLevel: profile.surferLevel,
        boardType: profile.boardType,
        homeRegion: profile.homeRegion,
        onboardingCompleted: profile.onboardingCompleted,
        alertEnabled: profile.alertEnabled,
        alertTime: profile.alertTime,
        minWaveHeight: profile.minWaveHeight,
        maxWaveHeight: profile.maxWaveHeight,
        maxWindSpeed: profile.maxWindSpeed,
        preferOffshoreOnly: profile.preferOffshoreOnly,
      }
    : guestSurferPrefs;

  const chosenSpots = useMemo(() => {
    const set = new Set(favoriteSpotIds);
    return allSpots.filter((s) => set.has(s.id));
  }, [allSpots, favoriteSpotIds]);

  const activeCrew = useMemo(() => {
    if (crews.length === 0) return null;
    if (profile?.activeCrewId) {
      const match = crews.find((c) => c.id === profile.activeCrewId);
      if (match) return match;
    }
    return crews[0];
  }, [crews, profile?.activeCrewId]);

  const saveLocation = useCallback((loc: UserLocation) => {
    setUserLocation(loc);
    setGeoError('');
    try {
      localStorage.setItem(LOCAL_LOCATION_KEY, JSON.stringify(loc));
    } catch {
      // ignore
    }
  }, []);

  const requestGpsLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoStatus('error');
      setGeoError(
        'La géolocalisation GPS n’est pas disponible dans ce navigateur — choisissez une ville de départ ci-dessous.'
      );
      return;
    }

    setGeoStatus('locating');
    setGeoError('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(4));
        const lng = Number(pos.coords.longitude.toFixed(4));

        // Build a friendly local label from nearest coastal spot if close
        let nearestSpot: SurfSpot | null = null;
        let nearestDist = Infinity;
        for (const s of allSpots) {
          const d = haversineKm(lat, lng, s.lat, s.lng);
          if (d < nearestDist) {
            nearestDist = d;
            nearestSpot = s;
          }
        }

        const label =
          nearestSpot && nearestDist <= 35
            ? `Près de ${nearestSpot.town}`
            : nearestSpot && nearestDist <= 100
            ? `Secteur ${nearestSpot.region}`
            : 'Ma position GPS';

        setGeoStatus('granted');
        saveLocation({ lat, lng, label, source: 'gps' });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGeoStatus('denied');
          setGeoError(
            'Accès GPS refusé ou bloqué par le navigateur. Sélectionnez votre ville de départ ci-dessous pour filtrer à 100 km.'
          );
        } else {
          setGeoStatus('error');
          setGeoError(
            'Impossible de capter le signal GPS pour le moment. Vous pouvez choisir votre ville de départ ci-dessous.'
          );
        }
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [allSpots, saveLocation]);

  // Auto-acquire GPS silently on first load if permission was already granted
  useEffect(() => {
    if (userLocation) return;
    if (typeof navigator === 'undefined' || !navigator.permissions?.query) return;
    let cancelled = false;
    void navigator.permissions
      .query({ name: 'geolocation' as PermissionName })
      .then((status) => {
        if (!cancelled && status.state === 'granted') {
          requestGpsLocation();
        }
      })
      .catch(() => {
        // ignore permissions API quirks
      });
    return () => {
      cancelled = true;
    };
  }, [userLocation, requestGpsLocation]);

  // 1. Firebase Auth
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);
      if (!firebaseUser) {
        setProfile(null);
        setCustomSpots([]);
        setAlertLogs([]);
        setCrews([]);
        setCrewMembers([]);
        setCrewParkingReports([]);
      }
    });
    return () => unsub();
  }, []);

  // 2. Firestore Realtime Subscriptions
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    void ensureUserProfile(
      user.uid,
      user.displayName,
      guestSurferPrefs.onboardingCompleted
        ? { prefs: guestSurferPrefs, favoriteSpotIds: guestFavorites }
        : undefined
    ).then((p) => {
      if (!cancelled) setProfile(p);
    });

    const unsubProfile = subscribeUserProfile(user.uid, (p) => {
      if (p) setProfile(p);
    });
    const unsubCustom = subscribeCustomSpots(user.uid, setCustomSpots);
    const unsubLogs = subscribeAlertLogs(user.uid, setAlertLogs);
    const unsubCrews = subscribeUserCrews(user.uid, setCrews);

    return () => {
      cancelled = true;
      unsubProfile();
      unsubCustom();
      unsubLogs();
      unsubCrews();
    };
  }, [authReady, user]);

  // 3. Active Crew Members & Live Check Parking Reports
  useEffect(() => {
    if (!authReady || !user || !activeCrew) {
      setCrewMembers([]);
      setCrewParkingReports([]);
      return;
    }
    const unsubMembers = subscribeCrewMembers(activeCrew.id, activeCrew.memberIds, setCrewMembers);
    const unsubReports = subscribeCrewParkingReports(
      activeCrew.id,
      activeCrew.memberIds,
      setCrewParkingReports
    );
    return () => {
      unsubMembers();
      unsubReports();
    };
  }, [authReady, user, activeCrew]);

  // 4. Live Open-Meteo Marine & Weather Forecasts
  const spotFetchSignature = useMemo(
    () => allSpots.map((s) => `${s.id}:${s.lat.toFixed(3)},${s.lng.toFixed(3)}`).join('|'),
    [allSpots]
  );

  const loadForecasts = useCallback(async () => {
    setLoadingForecasts(true);
    setForecastError('');
    try {
      const data = await fetchAllSpotsForecasts(allSpots);
      setForecasts(data);
      const now = new Date();
      setLastUpdatedLabel(
        `${String(now.getHours()).padStart(2, '0')}h${String(now.getMinutes()).padStart(2, '0')}`
      );
    } catch (err) {
      setForecastError(
        err instanceof Error ? err.message : 'Erreur lors du chargement des prévisions météo.'
      );
    } finally {
      setLoadingForecasts(false);
    }
  }, [allSpots]);

  useEffect(() => {
    void loadForecasts();
  }, [spotFetchSignature]); // eslint-disable-line react-hooks/exhaustive-deps

  // 5. Dawn Patrol Morning Alert Watcher
  useEffect(() => {
    if (!surferPrefs.alertEnabled || Object.keys(forecasts).length === 0) return;

    const checkMorningAlert = () => {
      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(
        now.getMinutes()
      ).padStart(2, '0')}`;
      const todayKey = getLocalDateKey(0);
      const dedupKey = `${todayKey}_${surferPrefs.alertTime}`;

      if (currentHHMM === surferPrefs.alertTime && lastTriggeredAlertKeyRef.current !== dedupKey) {
        lastTriggeredAlertKeyRef.current = dedupKey;
        const ranked = rankSpotsForDate(chosenSpots, forecasts, todayKey, surferPrefs);
        const top = ranked[0];
        setAlertModalDate(todayKey);

        if (
          top &&
          typeof window !== 'undefined' &&
          'Notification' in window &&
          Notification.permission === 'granted'
        ) {
          new Notification(`Ça Surf ? — ${top.recommendation.spotName}`, {
            body: `Créneau ${top.recommendation.windowLabel} · ${top.recommendation.summary}`,
          });
        }
      }
    };

    const interval = window.setInterval(checkMorningAlert, 30000);
    return () => window.clearInterval(interval);
  }, [surferPrefs, chosenSpots, forecasts]);

  // Handlers
  const handleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch {
      setAuthError('Connexion Google annulée ou bloquée par le navigateur.');
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  const handleToggleFavorite = async (spotId: string) => {
    const exists = favoriteSpotIds.includes(spotId);
    const next = exists
      ? favoriteSpotIds.filter((id) => id !== spotId)
      : [...favoriteSpotIds, spotId].slice(0, 15);

    if (user && profile) {
      await updateUserFavorites(
        user.uid,
        next,
        activeCrew?.id || '',
        profile.displayName,
        profile.alertTime,
        true
      );
    } else {
      setGuestFavorites(next);
      setGuestSurferPrefs((prev) => ({ ...prev, onboardingCompleted: true }));
      try {
        localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    }
  };

  const handleSaveFullProfile = async (
    next: SurferPreferences & { favoriteSpotIds: string[] }
  ) => {
    if (user && profile) {
      await saveFullSurferProfile(user.uid, next, activeCrew?.id || '');
    } else {
      const { favoriteSpotIds: nextFavs, ...restPrefs } = next;
      setGuestSurferPrefs(restPrefs);
      setGuestFavorites(nextFavs);
      try {
        localStorage.setItem(LOCAL_PREFS_KEY, JSON.stringify(restPrefs));
        localStorage.setItem(LOCAL_FAV_KEY, JSON.stringify(nextFavs));
      } catch {
        // ignore
      }
    }
  };

  const handleTriggerTestAlert = () => {
    const todayKey = getLocalDateKey(0);
    setAlertModalDate(todayKey);

    const ranked = rankSpotsForDate(chosenSpots, forecasts, todayKey, surferPrefs);
    const top = ranked[0];
    if (
      top &&
      typeof window !== 'undefined' &&
      'Notification' in window &&
      Notification.permission === 'granted'
    ) {
      new Notification(`Ça Surf ? — ${top.recommendation.spotName}`, {
        body: `Meilleur créneau : ${top.recommendation.windowLabel} · ${top.recommendation.summary}`,
      });
    }
  };

  const handleAddCustomSpot = async (input: {
    name: string;
    region: string;
    lat: number;
    lng: number;
    offshoreDeg: number;
    idealMinWave: number;
    idealMaxWave: number;
    breakType: BreakType;
    idealTide: string;
  }) => {
    if (!user || !profile) return;
    const newId = await createCustomSpot(user.uid, input);
    const nextFavs = [...profile.favoriteSpotIds, newId].slice(0, 15);
    await updateUserFavorites(
      user.uid,
      nextFavs,
      activeCrew?.id || '',
      profile.displayName,
      profile.alertTime,
      true
    );
  };

  const handleDeleteCustomSpot = async (spotId: string) => {
    if (!user || !profile) return;
    await deleteCustomSpot(user.uid, spotId);
    if (profile.favoriteSpotIds.includes(spotId)) {
      await updateUserFavorites(
        user.uid,
        profile.favoriteSpotIds.filter((id) => id !== spotId),
        activeCrew?.id || '',
        profile.displayName,
        profile.alertTime,
        true
      );
    }
    setSelectedSpotId(null);
  };

  const handleSaveAlertLog = async (rec: BestWindowRecommendation) => {
    if (!user) return;
    await logMorningAlert(user.uid, rec);
  };

  const handleJoinCrew = async (code: string) => {
    if (!profile) return { status: 'not-found' };
    const existing = crews.find((c) => c.inviteCode === code.toUpperCase());
    if (existing) {
      await switchActiveCrew(profile.uid, existing.id);
      return { status: 'already-member', crewName: existing.name };
    }
    return joinSurfCrewByCode(profile, code);
  };

  const handlePlanSessionFromSpot = async (spotId: string, slotLabel: string) => {
    if (!user || !activeCrew) return;
    await updateCrewSessionCheckIn(activeCrew.id, user.uid, spotId, slotLabel, '');
  };

  const effectiveParkingReports = activeCrew ? crewParkingReports : localParkingReports;

  const handlePublishParkingReport = async (payload: ParkingCheckSubmitPayload) => {
    const todayKey = getLocalDateKey(0);
    if (user && activeCrew) {
      await publishCrewParkingReport(activeCrew.id, user.uid, {
        authorName: surferPrefs.displayName || user.displayName || 'Surfeur',
        spotId: payload.spotId,
        spotName: payload.spotName,
        verdict: payload.verdict,
        observedWaveHeight: payload.observedWaveHeight,
        crowdLevel: payload.crowdLevel,
        windFeel: payload.windFeel,
        note: payload.note,
        dateKey: todayKey,
      });
      return;
    }

    const nextReport: ParkingReportRecord = {
      uid: user?.uid ?? 'local-guest',
      crewId: 'local',
      authorName: surferPrefs.displayName || 'Surfeur',
      spotId: payload.spotId,
      spotName: payload.spotName,
      verdict: payload.verdict,
      observedWaveHeight: payload.observedWaveHeight,
      crowdLevel: payload.crowdLevel,
      windFeel: payload.windFeel,
      note: payload.note,
      dateKey: todayKey,
      localUpdatedAtMs: Date.now(),
    };

    setLocalParkingReports((prev) => {
      const next = [nextReport, ...prev.filter((r) => r.spotId !== payload.spotId)].slice(0, 12);
      try {
        localStorage.setItem(LOCAL_PARKING_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleDeleteParkingReport = async (memberUid: string, spotId?: string) => {
    if (user && activeCrew) {
      await deleteCrewParkingReport(activeCrew.id, memberUid);
      return;
    }
    setLocalParkingReports((prev) => {
      const next = prev.filter((r) =>
        spotId ? !(r.uid === memberUid && r.spotId === spotId) : r.uid !== memberUid
      );
      try {
        localStorage.setItem(LOCAL_PARKING_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const selectedSpot = useMemo(
    () => (selectedSpotId ? allSpots.find((s) => s.id === selectedSpotId) ?? null : null),
    [allSpots, selectedSpotId]
  );

  const alertModalRanked = useMemo(() => {
    if (!alertModalDate) return [];
    const isTomorrow = alertModalDate === getLocalDateKey(1);
    return rankSpotsForDate(chosenSpots, forecasts, alertModalDate, surferPrefs, {
      morningOnly: isTomorrow,
      includePastToday: isTomorrow,
    });
  }, [alertModalDate, chosenSpots, forecasts, surferPrefs]);

  const navItems: Array<{ id: ActiveTab; label: string; shortLabel: string }> = [
    { id: 'session', label: 'Session du jour', shortLabel: 'Session' },
    { id: 'spots', label: `Autour (<${NEARBY_RADIUS_KM} km)`, shortLabel: '<100 km' },
    { id: 'crew', label: 'Groupe d’amis', shortLabel: 'Groupe' },
    { id: 'profile', label: 'Mon profil', shortLabel: 'Profil' },
  ];

  const navigateTo = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSelectedSpotId(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const viewKey = selectedSpot ? `spot-${selectedSpot.id}` : `tab-${activeTab}`;

  // Wait for auth & Firestore profile hydration so returning signed-in users never flash onboarding
  if (!authReady || (user && !profile)) {
    return (
      <div className="min-h-screen text-[#F3F7FA] flex items-center justify-center p-6">
        <div className="text-center space-y-2">
          <div className="font-display text-3xl font-extrabold tracking-wide text-[#F8FBFE]">
            Ça Surf <span className="text-[#F0A53A]">?</span>
          </div>
          <p className="text-xs text-[#8AA6B7]">Chargement de votre profil...</p>
        </div>
      </div>
    );
  }

  // Mandatory first-launch onboarding gate
  if (!surferPrefs.onboardingCompleted) {
    return (
      <OnboardingGate
        initialPrefs={surferPrefs}
        allSpots={allSpots}
        userLocation={userLocation}
        geoStatus={geoStatus}
        isSignedIn={Boolean(user)}
        onRequestGps={requestGpsLocation}
        onSignIn={() => void handleSignIn()}
        onComplete={handleSaveFullProfile}
      />
    );
  }

  return (
    <div className="min-h-screen text-[#F3F7FA] flex flex-col pb-20 md:pb-0">
      {/* Strict 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-[#060D13]/80 backdrop-blur-xl border-b border-white/10 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.9)]">
        <div className="max-w-[1240px] mx-auto h-16 px-4 sm:px-8 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => navigateTo('session')}
            className="font-display text-2xl sm:text-[26px] font-extrabold tracking-wide text-[#F8FBFE] hover:text-[#F7C266] transition-colors whitespace-nowrap shrink-0"
          >
            Ça Surf <span className="text-[#F0A53A]">?</span>
          </button>

          {/* Zone 2: 4 Clean Single-Line Text Links */}
          <nav
            className="hidden md:flex items-center gap-8 text-sm font-medium"
            aria-label="Navigation principale"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id && !selectedSpotId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateTo(item.id)}
                  className={`relative py-2 transition-colors whitespace-nowrap shrink-0 ${
                    active ? 'text-[#F8FBFE] font-semibold' : 'text-[#8AA6B7] hover:text-[#F8FBFE]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="nav-active-underline"
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="absolute inset-x-0 -bottom-[1px] h-[2px] rounded-full bg-gradient-to-r from-[#2DD4BF] to-[#F0A53A]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Dedicated Other-Spots Search Menu + Morning Alert Action */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setSearchMenuOpen(true)}
              className="surf-btn-glass inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-[#2DD4BF]" />
              <span className="hidden sm:inline">Autres spots</span>
            </button>
            <button
              type="button"
              onClick={handleTriggerTestAlert}
              className="surf-btn-primary inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
              Alerte {surferPrefs.alertTime.replace(':', 'h')}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container with Fluid View Transitions */}
      <main className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-8 py-7 sm:py-10">
        {(forecastError || authError) && (
          <div className="mb-6 px-4 py-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-[#FB7185]">
            {forecastError || authError}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={viewKey}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            {selectedSpot ? (
              <SpotDetailPanel
                spot={selectedSpot}
                allSpots={allSpots}
                forecast={forecasts[selectedSpot.id]}
                allForecasts={forecasts}
                isFavorite={favoriteSpotIds.includes(selectedSpot.id)}
                surferPrefs={surferPrefs}
                parkingReports={effectiveParkingReports}
                currentUserId={user?.uid ?? null}
                isSignedIn={Boolean(user)}
                onBack={() => setSelectedSpotId(null)}
                onSelectSpot={(id) => setSelectedSpotId(id)}
                onToggleFavorite={(id) => void handleToggleFavorite(id)}
                onDeleteCustom={(id) => void handleDeleteCustomSpot(id)}
                onPlanSession={(spotId, slot) => void handlePlanSessionFromSpot(spotId, slot)}
                onPublishParkingReport={handlePublishParkingReport}
                onDeleteParkingReport={handleDeleteParkingReport}
                onNavigateCrew={() => navigateTo('crew')}
                hasActiveCrew={Boolean(activeCrew)}
              />
            ) : activeTab === 'session' ? (
              <DashboardView
                allSpots={allSpots}
                favoriteSpotIds={favoriteSpotIds}
                forecasts={forecasts}
                loadingForecasts={loadingForecasts}
                surferPrefs={surferPrefs}
                userLocation={userLocation}
                onSelectSpot={(id) => setSelectedSpotId(id)}
                onNavigateTab={(tab) => navigateTo(tab)}
              />
            ) : activeTab === 'spots' ? (
              <SpotsCatalogView
                spots={allSpots}
                favoriteSpotIds={favoriteSpotIds}
                forecasts={forecasts}
                loadingForecasts={loadingForecasts}
                surferPrefs={surferPrefs}
                userLocation={userLocation}
                geoStatus={geoStatus}
                geoError={geoError}
                radiusKm={NEARBY_RADIUS_KM}
                isSignedIn={Boolean(user)}
                onRequestGps={requestGpsLocation}
                onSetManualLocation={saveLocation}
                onOpenOtherSpotsSearch={() => setSearchMenuOpen(true)}
                onSelectSpot={(id) => setSelectedSpotId(id)}
                onToggleFavorite={(id) => void handleToggleFavorite(id)}
                onOpenAddSpot={() => setAddSpotOpen(true)}
                onRequireAuth={() => void handleSignIn()}
                onDoneChoosing={() => navigateTo('session')}
              />
            ) : activeTab === 'crew' ? (
              <CrewView
                profile={profile}
                isSignedIn={Boolean(user)}
                crews={crews}
                activeCrew={activeCrew}
                crewMembers={crewMembers}
                parkingReports={effectiveParkingReports}
                allSpots={allSpots}
                forecasts={forecasts}
                onSignIn={() => void handleSignIn()}
                onCreateCrew={async (name) => {
                  if (profile) await createSurfCrew(profile, name);
                }}
                onJoinCrew={handleJoinCrew}
                onSwitchCrew={async (crewId) => {
                  if (user) await switchActiveCrew(user.uid, crewId);
                }}
                onLeaveCrew={async (crew) => {
                  if (user) await leaveSurfCrew(user.uid, crew);
                }}
                onUpdateCheckIn={async (spotId, slot, note) => {
                  if (user && activeCrew) {
                    await updateCrewSessionCheckIn(activeCrew.id, user.uid, spotId, slot, note);
                  }
                }}
                onPublishParkingReport={handlePublishParkingReport}
                onDeleteParkingReport={handleDeleteParkingReport}
                onSelectSpot={(id) => setSelectedSpotId(id)}
              />
            ) : (
              <SurferProfileView
                prefs={surferPrefs}
                allSpots={allSpots}
                favoriteSpotIds={favoriteSpotIds}
                forecasts={forecasts}
                alertLogs={alertLogs}
                isSignedIn={Boolean(user)}
                userEmail={user?.email ?? null}
                onSignIn={() => void handleSignIn()}
                onSignOut={() => void handleSignOut()}
                onSaveProfile={handleSaveFullProfile}
                onTriggerTestAlert={handleTriggerTestAlert}
                onDeleteAlertLog={async (logId) => {
                  if (user) await deleteAlertLog(user.uid, logId);
                }}
                onOpenCatalog={() => navigateTo('spots')}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Quiet Coastal Footer with Refresh Action */}
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-8 py-5 flex items-center justify-between gap-4 flex-wrap text-xs text-[#6D8796]">
          <div>
            Ça Surf ? · Prévisions marines gratuites Open-Meteo Marine & Weather
            {lastUpdatedLabel ? ` · Relevé ${lastUpdatedLabel}` : ''}
          </div>
          <button
            type="button"
            onClick={() => void loadForecasts()}
            disabled={loadingForecasts}
            className="inline-flex items-center gap-1.5 text-[#94ACB9] hover:text-[#F8FBFE] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingForecasts ? 'animate-spin' : ''}`} />
            {loadingForecasts ? 'Actualisation...' : 'Actualiser la météo'}
          </button>
        </div>
      </footer>

      {/* Native-Feel Mobile Bottom Tab Bar (Thumb-Friendly at the Beach) */}
      <nav
        aria-label="Navigation mobile"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-[#060D13]/92 backdrop-blur-xl border-t border-white/12 px-2 grid grid-cols-4 items-center"
      >
        {navItems.map((item) => {
          const active = activeTab === item.id && !selectedSpotId;
          const Icon =
            item.id === 'session'
              ? Waves
              : item.id === 'spots'
              ? LocateFixed
              : item.id === 'crew'
              ? Users
              : UserRound;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigateTo(item.id)}
              className={`flex flex-col items-center justify-center gap-1 py-1.5 rounded-xl transition-colors ${
                active ? 'text-[#F7C266]' : 'text-[#7D9BAC]'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[11px] font-medium leading-none">{item.shortLabel}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <OtherSpotsSearchModal
        open={searchMenuOpen}
        onClose={() => setSearchMenuOpen(false)}
        spots={allSpots}
        favoriteSpotIds={favoriteSpotIds}
        forecasts={forecasts}
        surferPrefs={surferPrefs}
        userLocation={userLocation}
        radiusKm={NEARBY_RADIUS_KM}
        isSignedIn={Boolean(user)}
        onSelectSpot={(id) => setSelectedSpotId(id)}
        onToggleFavorite={(id) => void handleToggleFavorite(id)}
        onOpenAddSpot={() => setAddSpotOpen(true)}
        onRequireAuth={() => void handleSignIn()}
      />

      <MorningAlertModal
        open={Boolean(alertModalDate)}
        onClose={() => setAlertModalDate(null)}
        prefs={surferPrefs}
        targetDateKey={alertModalDate || getLocalDateKey(0)}
        ranked={alertModalRanked}
        onSaveLog={handleSaveAlertLog}
        onSelectSpot={(id) => setSelectedSpotId(id)}
        canSaveLog={Boolean(user)}
      />

      <AddSpotModal
        open={addSpotOpen}
        onClose={() => setAddSpotOpen(false)}
        onSubmit={handleAddCustomSpot}
      />
    </div>
  );
}
