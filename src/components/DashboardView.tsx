import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Check,
  Compass,
  ExternalLink,
  Eye,
  LocateFixed,
  MapPin,
  Plus,
  Search,
  Shield,
  SlidersHorizontal,
  Video,
} from 'lucide-react';
import {
  BOARD_TYPE_LABELS,
  SURFER_LEVEL_LABELS,
} from '../data/spots';
import {
  degreesToCompass,
  findShelterFallback,
  formatFrenchDateLabel,
  formatReportAgeFr,
  getLocalDateKey,
  getSpotWebcams,
  haversineKm,
  rankSpotsForDate,
  scoreLabelFr,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type {
  ActiveTab,
  ParkingReportRecord,
  SpotForecast,
  SurferPreferences,
  SurfSpot,
  UserLocation,
} from '../types/surf';
import { CROWD_META, VERDICT_META } from './ParkingCheckCard';
import { SpotImage } from './SpotImage';
import { SurfScoreDial } from './SurfScoreDial';

interface DashboardViewProps {
  allSpots: SurfSpot[];
  favoriteSpotIds: string[];
  forecasts: Record<string, SpotForecast>;
  loadingForecasts: boolean;
  surferPrefs: SurferPreferences;
  parkingReports: ParkingReportRecord[];
  userLocation: UserLocation | null;
  geoStatus: 'idle' | 'locating' | 'granted' | 'denied' | 'error';
  onRequestGps: () => void;
  onOpenOtherSpotsSearch: () => void;
  onSelectSpot: (spotId: string) => void;
  onOpenAlertPreview: (dateKey: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
  onToggleFavorite: (spotId: string) => void;
}

export function DashboardView({
  allSpots,
  favoriteSpotIds,
  forecasts,
  loadingForecasts,
  surferPrefs,
  parkingReports,
  userLocation,
  geoStatus,
  onRequestGps,
  onOpenOtherSpotsSearch,
  onSelectSpot,
  onOpenAlertPreview,
  onNavigateTab,
  onToggleFavorite,
}: DashboardViewProps) {
  const todayKey = useMemo(() => getLocalDateKey(0), []);
  const tomorrowKey = useMemo(() => getLocalDateKey(1), []);
  const [horizon, setHorizon] = useState<'today' | 'tomorrow'>('today');

  const activeDateKey = horizon === 'today' ? todayKey : tomorrowKey;

  const chosenSpots = useMemo(() => {
    const favSet = new Set(favoriteSpotIds);
    return allSpots.filter((s) => favSet.has(s.id));
  }, [allSpots, favoriteSpotIds]);

  const rankedChosen = useMemo(
    () =>
      rankSpotsForDate(chosenSpots, forecasts, activeDateKey, surferPrefs, {
        morningOnly: horizon === 'tomorrow',
        includePastToday: horizon === 'tomorrow',
      }),
    [chosenSpots, forecasts, activeDateKey, surferPrefs, horizon]
  );

  // Discover coherent firing spots outside user's current selection (scoped to <= 100 km when GPS active)
  const discoveryPicks = useMemo(() => {
    const favSet = new Set(favoriteSpotIds);
    const others = allSpots.filter((s) => {
      if (favSet.has(s.id)) return false;
      if (userLocation) {
        return haversineKm(userLocation.lat, userLocation.lng, s.lat, s.lng) <= 100;
      }
      return true;
    });
    return rankSpotsForDate(others, forecasts, activeDateKey, surferPrefs, {
      morningOnly: horizon === 'tomorrow',
      includePastToday: horizon === 'tomorrow',
    })
      .filter((item) => item.recommendation.fitStatus !== 'challenging' && item.recommendation.avgScore >= 4.2)
      .slice(0, 3);
  }, [allSpots, favoriteSpotIds, userLocation, forecasts, activeDateKey, surferPrefs, horizon]);

  const topPick = rankedChosen[0] ?? null;
  const secondaryChosen = rankedChosen.slice(1);
  const topDistanceKm =
    topPick && userLocation
      ? haversineKm(userLocation.lat, userLocation.lng, topPick.spot.lat, topPick.spot.lng)
      : null;

  const topWebcam = useMemo(
    () => (topPick ? getSpotWebcams(topPick.spot) : null),
    [topPick]
  );

  const shelterFallback = useMemo(() => {
    if (!topPick) return null;
    return findShelterFallback(
      topPick.spot,
      topPick.recommendation,
      allSpots,
      forecasts,
      activeDateKey,
      surferPrefs,
      {
        morningOnly: horizon === 'tomorrow',
        includePastToday: horizon === 'tomorrow',
      }
    );
  }, [topPick, allSpots, forecasts, activeDateKey, surferPrefs, horizon]);

  const todayReports = useMemo(
    () => parkingReports.filter((r) => r.dateKey === todayKey),
    [parkingReports, todayKey]
  );

  const latestTerrainReport = todayReports[0] ?? null;

  const windToneClass = (q: string) => {
    if (q === 'glassy' || q === 'offshore') return 'text-[#2DD4BF]';
    if (q === 'cross') return 'text-[#F0A53A]';
    return 'text-[#FB7185]';
  };

  const fitToneClass = (fit: string) => {
    if (fit === 'ideal') return 'text-[#2DD4BF]';
    if (fit === 'compatible') return 'text-[#F0A53A]';
    return 'text-[#FB7185]';
  };

  const fitShortLabel = (fit: string) => {
    if (fit === 'ideal') return 'Idéal pour votre profil';
    if (fit === 'compatible') return 'Adapté à votre profil';
    return 'Conditions exigeantes';
  };

  return (
    <div className="space-y-9">
      {/* Non-blocking Surfer Profile Setup Prompt */}
      {!surferPrefs.onboardingCompleted && (
        <section className="surf-card-amber rounded-2xl p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[#F7C266]">
              Calibrez votre quiver en 20 secondes
            </div>
            <p className="text-sm text-[#EAF2F7]">
              Indiquez votre niveau, votre planche et vos spots habituels dans la liste API gratuite
              pour recevoir un verdict vraiment juste chaque matin.
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateTab('profile')}
              className="surf-btn-primary inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Configurer mon profil
            </button>
            <button
              type="button"
              onClick={() => onNavigateTab('spots')}
              className="surf-btn-glass inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-[#F3F7FA] rounded-lg whitespace-nowrap shrink-0"
            >
              Choisir mes spots
            </button>
          </div>
        </section>
      )}

      {/* Dominant Focal Anchor: Cinematic Surf Magazine Cover */}
      <section className="relative rounded-3xl overflow-hidden border border-white/15 shadow-[0_28px_70px_-28px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.14)] min-h-[460px] sm:min-h-[500px] flex flex-col justify-between group">
        <SpotImage
          src={topPick?.spot.imageUrl || ''}
          alt={
            topPick
              ? `${topPick.spot.town} — ${topPick.spot.name}`
              : 'Carte marine d’orientation côtière'
          }
          title={topPick ? `${topPick.spot.town} — ${topPick.spot.name}` : 'Ça Surf ?'}
          lat={topPick?.spot.lat}
          lng={topPick?.spot.lng}
          offshoreDeg={topPick?.spot.offshoreDeg}
          idealSwellDeg={topPick?.spot.idealSwellDeg}
          breakType={topPick?.spot.breakType}
          showSourceTag
          className="absolute inset-0 w-full h-full"
        />
        {/* Layered coastal atmosphere scrims */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#050C12]/96 via-[#07131D]/74 to-[#07131D]/26" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050C12]/96 via-[#06111A]/25 to-[#060F16]/45" />

        {/* Top editorial bar */}
        <div className="relative z-10 p-6 sm:p-9 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap text-xs text-[#CBD8E1]">
            <span className="font-semibold text-[#F3F7FA]">
              {SURFER_LEVEL_LABELS[surferPrefs.surferLevel].label}
            </span>
            <span className="text-white/35">·</span>
            <span className="font-medium text-[#EAF2F7]">
              {BOARD_TYPE_LABELS[surferPrefs.boardType].label}
            </span>
            <span className="text-white/35">·</span>
            <span className="font-mono tabular-nums text-[#F7C266]">
              {chosenSpots.length} spots suivis
            </span>
            <button
              type="button"
              onClick={userLocation ? () => onNavigateTab('spots') : onRequestGps}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#060E15]/80 hover:bg-[#0D1E2B] border border-white/15 text-[11px] font-medium text-[#4AE8D1] transition-colors whitespace-nowrap shrink-0"
            >
              <LocateFixed className="w-3 h-3" />
              {geoStatus === 'locating'
                ? 'Localisation GPS...'
                : userLocation
                ? `${userLocation.label} (<100 km)`
                : 'Activer GPS (<100 km)'}
            </button>
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#060E15]/85 border border-white/15 rounded-xl backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <button
              type="button"
              onClick={() => setHorizon('today')}
              className={`px-3.5 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
                horizon === 'today'
                  ? 'surf-btn-primary font-semibold'
                  : 'text-[#CBD8E1] hover:text-white font-medium'
              }`}
            >
              Aujourd’hui
            </button>
            <button
              type="button"
              onClick={() => setHorizon('tomorrow')}
              className={`px-3.5 py-1.5 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
                horizon === 'tomorrow'
                  ? 'surf-btn-primary font-semibold'
                  : 'text-[#CBD8E1] hover:text-white font-medium'
              }`}
            >
              Demain matin
            </button>
          </div>
        </div>

        {/* Bottom cover typography + sculptural SurfScoreDial */}
        <div className="relative z-10 px-6 sm:px-9 pb-7 sm:pb-9 pt-8 flex flex-col lg:flex-row lg:items-end justify-between gap-7">
          <div className="max-w-2xl">
            {loadingForecasts && !topPick ? (
              <div className="space-y-3 animate-pulse">
                <div className="h-4 bg-white/15 rounded w-52" />
                <div className="h-14 bg-white/15 rounded w-3/4" />
                <div className="h-4 bg-white/15 rounded w-full" />
              </div>
            ) : topPick ? (
              <>
                <div className="flex items-center gap-2.5 flex-wrap text-xs sm:text-sm font-medium text-[#F7C266]">
                  <span>
                    Spot n°1 {formatFrenchDateLabel(activeDateKey).toLowerCase()}
                  </span>
                  {topDistanceKm !== null && (
                    <>
                      <span className="text-white/35">·</span>
                      <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#4AE8D1]">
                        <MapPin className="w-3.5 h-3.5" />
                        {topDistanceKm} km
                      </span>
                    </>
                  )}
                  <span className="text-white/35">·</span>
                  <span className="font-mono tabular-nums text-[#F3F7FA]">
                    Créneau {topPick.recommendation.windowLabel}
                  </span>
                  <span className="text-white/35">·</span>
                  <span className={windToneClass(topPick.recommendation.windQuality)}>
                    {windQualityLabelFr(topPick.recommendation.windQuality)}
                  </span>
                </div>

                <h1 className="mt-2 font-display text-5xl sm:text-6xl lg:text-[68px] font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.95] drop-shadow-[0_6px_24px_rgba(0,0,0,0.65)]">
                  {topPick.spot.town} — {topPick.spot.name}
                </h1>

                <p className="mt-3.5 text-sm sm:text-base text-[#D3E0E8] leading-relaxed max-w-xl">
                  {topPick.recommendation.coherenceNote}{' '}
                  <span className="text-[#F8FBFE] font-medium">
                    {topPick.recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m à{' '}
                    {topPick.recommendation.avgSwellPeriod} s, vent{' '}
                    {degreesToCompass(topPick.recommendation.windDirection)}{' '}
                    {topPick.recommendation.avgWindSpeed} km/h.
                  </span>
                </p>

                <div className="mt-6 flex items-center gap-3 flex-wrap">
                  <button
                    type="button"
                    onClick={() => onSelectSpot(topPick.spot.id)}
                    className="surf-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap shrink-0"
                  >
                    Analyser & Check Parking
                    <ArrowRight className="w-4 h-4" />
                  </button>
                  {topWebcam && (
                    <a
                      href={topWebcam.primaryUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
                    >
                      <Video className="w-4 h-4 text-[#2DD4BF]" />
                      Webcam Live
                      <ExternalLink className="w-3.5 h-3.5 text-[#94ACB9]" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenAlertPreview(activeDateKey)}
                    className="surf-btn-glass inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
                  >
                    <Bell className="w-4 h-4 text-[#F0A53A]" />
                    Alerte {surferPrefs.alertTime.replace(':', 'h')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] text-balance leading-[0.98]">
                  Sélectionnez vos spots pour lancer vos prévisions
                </h1>
                <p className="mt-3 text-sm sm:text-base text-[#CBD8E1] max-w-xl">
                  Parcourez nos {allSpots.length} spots côtiers connectés en direct à l’API gratuite
                  Open-Meteo Marine et sélectionnez vos breaks habituels.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigateTab('spots')}
                  className="surf-btn-primary mt-6 inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl whitespace-nowrap shrink-0"
                >
                  <Compass className="w-4 h-4" />
                  Choisir dans la liste des spots API
                </button>
              </>
            )}
          </div>

          {topPick && (
            <div className="flex items-center lg:flex-col lg:items-end gap-4 shrink-0">
              <SurfScoreDial score={topPick.recommendation.avgScore} size="lg" />
            </div>
          )}
        </div>
      </section>

      {/* Live Buoy Telemetry Strip */}
      {topPick && (
        <section className="surf-card rounded-2xl grid grid-cols-2 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-white/10">
          <div className="p-5 sm:p-6">
            <div className="text-xs text-[#8AA6B7]">Meilleur créneau</div>
            <div className="mt-1.5 font-display text-3xl font-bold tracking-tight tabular-nums text-[#F8FBFE] leading-none">
              {topPick.recommendation.windowLabel}
            </div>
            <div className="mt-2 text-xs text-[#94ACB9]">
              {scoreLabelFr(topPick.recommendation.avgScore, topPick.recommendation.avgWaveHeight).label} ·{' '}
              {topPick.spot.idealTide}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-xs text-[#8AA6B7]">Houle & période</div>
            <div className="mt-1.5 font-display text-3xl font-bold tracking-tight tabular-nums text-[#38BDF8] leading-none">
              {topPick.recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m{' '}
              <span className="text-[#F8FBFE]">· {topPick.recommendation.avgSwellPeriod} s</span>
            </div>
            <div className="mt-2 text-xs text-[#94ACB9]">
              {topPick.recommendation.avgSwellPeriod >= 11
                ? 'Houle longue bien rangée'
                : 'Houle courte / de vent'}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-xs text-[#8AA6B7]">Vent sur le créneau</div>
            <div
              className={`mt-1.5 font-display text-3xl font-bold tracking-tight tabular-nums leading-none ${windToneClass(
                topPick.recommendation.windQuality
              )}`}
            >
              {topPick.recommendation.avgWindSpeed} km/h{' '}
              {degreesToCompass(topPick.recommendation.windDirection)}
            </div>
            <div className="mt-2 text-xs text-[#94ACB9]">
              {windQualityLabelFr(topPick.recommendation.windQuality)}
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <div className="text-xs text-[#8AA6B7]">Température eau & combi</div>
            <div className="mt-1.5 font-display text-3xl font-bold tracking-tight tabular-nums text-[#F8FBFE] leading-none">
              {topPick.recommendation.waterTemp !== null
                ? `${topPick.recommendation.waterTemp.toFixed(1).replace('.', ',')}°C`
                : `${topPick.recommendation.airTemp}°C air`}
            </div>
            <div className="mt-2 text-xs text-[#94ACB9] truncate">
              {topPick.recommendation.wetsuitLabel}
            </div>
          </div>
        </section>
      )}

      {/* Terrain > Algo Duo: Check Parking + Automatic Mode Repli */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Live Check Parking Card (clean coastal header — no fake photo) */}
        <div className="surf-card rounded-2xl overflow-hidden flex flex-col justify-between">
          <div className="px-5 sm:px-6 py-4 border-b border-white/10 bg-gradient-to-r from-[#F0A53A]/14 via-[#0C1C28]/60 to-transparent flex items-end justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F7C266]">
                <Eye className="w-3.5 h-3.5" />
                Terrain &gt; Algo
              </div>
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-white leading-none mt-1">
                Check Parking en direct
              </h2>
            </div>
            {latestTerrainReport && (
              <span className="text-xs font-mono text-[#CBD8E1]">
                {formatReportAgeFr(latestTerrainReport)}
              </span>
            )}
          </div>

          <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
            {latestTerrainReport ? (
              <div className="space-y-1.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className={`font-display text-xl font-bold tracking-tight ${
                      VERDICT_META[latestTerrainReport.verdict].textClass
                    }`}
                  >
                    {VERDICT_META[latestTerrainReport.verdict].label}
                  </span>
                  <span className="text-xs text-[#8AA6B7]">sur</span>
                  <button
                    type="button"
                    onClick={() => onSelectSpot(latestTerrainReport.spotId)}
                    className="text-sm font-semibold text-[#F8FBFE] hover:text-[#F0A53A] transition-colors"
                  >
                    {latestTerrainReport.spotName}
                  </button>
                </div>
                <div className="font-mono tabular-nums text-xs text-[#CBD8E1]">
                  Par {latestTerrainReport.authorName} ·{' '}
                  {latestTerrainReport.observedWaveHeight.toFixed(1).replace('.', ',')} m réels ·{' '}
                  {windQualityLabelFr(latestTerrainReport.windFeel)} ·{' '}
                  {CROWD_META[latestTerrainReport.crowdLevel]}
                </div>
                {latestTerrainReport.note && (
                  <p className="text-xs text-[#A9C0CE] leading-relaxed italic">
                    « {latestTerrainReport.note} »
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[#A9C0CE] leading-relaxed">
                Personne n’a encore checké la dune aujourd’hui. Le premier arrivé au parking balance
                le vrai verdict en 5 secondes pour éviter une carotte aux potes.
              </p>
            )}

            <div className="flex items-center gap-3 flex-wrap pt-1">
              <button
                type="button"
                onClick={() => (topPick ? onSelectSpot(topPick.spot.id) : onNavigateTab('crew'))}
                className="surf-btn-primary inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
              >
                Je suis sur place — Check Parking
              </button>
              <button
                type="button"
                onClick={() => onNavigateTab('crew')}
                className="text-xs font-medium text-[#A9C0CE] hover:text-[#F3F7FA] whitespace-nowrap shrink-0 transition-colors"
              >
                Fil du groupe ({todayReports.length})
              </button>
            </div>
          </div>
        </div>

        {/* Automatic Mode Repli Card with spot photography */}
        {shelterFallback ? (
          <div
            className={`${
              shelterFallback.isActiveAlert ? 'surf-card-teal' : 'surf-card'
            } rounded-2xl overflow-hidden flex flex-col justify-between`}
          >
            <div className="relative h-36 overflow-hidden">
              <SpotImage
                src={shelterFallback.spot.imageUrl}
                alt={`${shelterFallback.spot.town} — ${shelterFallback.spot.name}`}
                title={shelterFallback.spot.name}
                lat={shelterFallback.spot.lat}
                lng={shelterFallback.spot.lng}
                offshoreDeg={shelterFallback.spot.offshoreDeg}
                idealSwellDeg={shelterFallback.spot.idealSwellDeg}
                breakType={shelterFallback.spot.breakType}
                className="w-full h-full"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A1923] via-[#0A1923]/60 to-[#060E15]/30" />
              <div className="absolute bottom-3.5 left-5 right-5 flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4AE8D1]">
                    <Shield className="w-3.5 h-3.5" />
                    {shelterFallback.isActiveAlert
                      ? `Mode Repli activé · ${shelterFallback.distanceKm} km`
                      : `Radar de Repli · Plan B à ${shelterFallback.distanceKm} km`}
                  </div>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-white leading-none mt-0.5 truncate">
                    {shelterFallback.spot.town} — {shelterFallback.spot.name}
                  </h2>
                </div>
                <div className="font-display text-2xl font-extrabold tabular-nums text-[#F7C266] leading-none shrink-0">
                  {shelterFallback.recommendation.avgScore.toFixed(1).replace('.', ',')}
                  <span className="text-xs font-mono font-normal text-white/70">/10</span>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-4">
              <div className="space-y-1.5">
                <div className="font-mono tabular-nums text-xs text-[#D3E0E8]">
                  {shelterFallback.recommendation.windowLabel} ·{' '}
                  {shelterFallback.recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m ·{' '}
                  {windQualityLabelFr(shelterFallback.recommendation.windQuality)} ·{' '}
                  {shelterFallback.spot.idealTide}
                </div>
                <p className="text-sm text-[#A9C0CE] leading-relaxed">{shelterFallback.reason}</p>
              </div>

              <div className="flex items-center gap-3 flex-wrap pt-1">
                <button
                  type="button"
                  onClick={() => onSelectSpot(shelterFallback.spot.id)}
                  className="surf-btn-teal inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg whitespace-nowrap shrink-0"
                >
                  Basculer sur ce spot de repli
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="surf-card rounded-2xl p-6 flex flex-col justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#4AE8D1]">
                <Shield className="w-4 h-4" />
                Radar de Repli automatique
              </div>
              <h2 className="font-display text-2xl font-bold text-[#F8FBFE]">
                Toujours un plan B abrité sous le coude
              </h2>
              <p className="text-sm text-[#A9C0CE] leading-relaxed">
                Dès que le vent passe onshore ou que la houle sature sur votre spot principal, le
                repli abrité le plus proche s’affiche automatiquement ici.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('spots')}
              className="self-start text-xs font-semibold text-[#F7C266] hover:underline"
            >
              Explorer les replis de Crozon & Finistère →
            </button>
          </div>
        )}
      </section>

      {/* Chosen Spots Magazine Grid */}
      <section className="space-y-5">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-3xl font-extrabold text-[#F8FBFE] tracking-tight leading-none">
              Vos autres spots choisis · {formatFrenchDateLabel(activeDateKey)}
            </h2>
            <p className="text-xs text-[#8AA6B7] mt-1.5">
              Classés selon vos réglages ({surferPrefs.minWaveHeight.toFixed(1).replace('.', ',')}–
              {surferPrefs.maxWaveHeight.toFixed(1).replace('.', ',')} m · max{' '}
              {surferPrefs.maxWindSpeed} km/h).
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('spots')}
            className="text-xs font-semibold text-[#F7C266] hover:underline whitespace-nowrap shrink-0"
          >
            Modifier mes spots ({chosenSpots.length}/15)
          </button>
        </div>

        {secondaryChosen.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {secondaryChosen.map(({ spot, recommendation }, idx) => (
              <article
                key={spot.id}
                onClick={() => onSelectSpot(spot.id)}
                className="surf-card-interactive rounded-2xl overflow-hidden cursor-pointer group flex flex-col"
              >
                <div className="relative h-48 overflow-hidden">
                  <SpotImage
                    src={spot.imageUrl}
                    alt={`${spot.town} — ${spot.name}`}
                    title={spot.name}
                    lat={spot.lat}
                    lng={spot.lng}
                    offshoreDeg={spot.offshoreDeg}
                    idealSwellDeg={spot.idealSwellDeg}
                    breakType={spot.breakType}
                    className="w-full h-full group-hover:scale-[1.03] transition-transform duration-500 ease-out"
                  />
                  <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#08131C] via-[#08131C]/30 to-transparent" />
                  {userLocation && (
                    <div className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#060F16]/80 backdrop-blur-md border border-white/15 text-[11px] font-mono font-semibold tabular-nums text-[#4AE8D1]">
                      <MapPin className="w-3 h-3" />
                      {haversineKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng)} km
                    </div>
                  )}
                  <div className="absolute bottom-3.5 left-4 right-4 flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[11px] font-medium text-white/75">
                        #{idx + 2} · {spot.region}
                      </div>
                      <h3 className="font-display text-2xl font-extrabold tracking-tight text-white truncate leading-tight">
                        {spot.town} — {spot.name}
                      </h3>
                    </div>
                    <div className="font-display text-3xl font-extrabold tabular-nums text-[#F7C266] shrink-0 leading-none">
                      {recommendation.avgScore.toFixed(1).replace('.', ',')}
                      <span className="text-xs font-mono font-normal text-white/70">/10</span>
                    </div>
                  </div>
                </div>

                <div className="p-4.5 flex-1 flex flex-col justify-between gap-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-mono tabular-nums font-semibold text-[#F3F7FA]">
                        {recommendation.windowLabel}
                      </span>
                      <span className={`font-medium ${fitToneClass(recommendation.fitStatus)}`}>
                        {fitShortLabel(recommendation.fitStatus)}
                      </span>
                    </div>
                    <div className="font-mono tabular-nums text-xs text-[#CBD8E1]">
                      {recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m ·{' '}
                      {recommendation.avgSwellPeriod} s ·{' '}
                      <span className={windToneClass(recommendation.windQuality)}>
                        {recommendation.avgWindSpeed} km/h{' '}
                        {degreesToCompass(recommendation.windDirection)}{' '}
                        {windQualityLabelFr(recommendation.windQuality)}
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-[#94ACB9] leading-relaxed line-clamp-2">
                    {recommendation.coherenceNote}
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="surf-card rounded-2xl p-6 text-sm text-[#A9C0CE] flex items-center justify-between gap-4 flex-wrap">
            <span>
              Ajoutez d’autres spots dans votre liste pour comparer plusieurs options chaque matin.
            </span>
            <button
              type="button"
              onClick={() => onNavigateTab('spots')}
              className="surf-btn-glass px-4 py-2 text-xs font-medium text-[#F3F7FA] rounded-lg whitespace-nowrap shrink-0"
            >
              Parcourir les spots API
            </button>
          </div>
        )}
      </section>

      {/* Coherent Discovery Picks (< 100 km when GPS active) + Link to Other Spots Search */}
      <section className="space-y-4 pt-4 border-t border-white/10">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-display text-2xl font-extrabold text-[#F8FBFE] tracking-tight">
              {userLocation
                ? `À surveiller à moins de 100 km de ${userLocation.label}`
                : 'À surveiller aujourd’hui sur la côte (hors favoris)'}
            </h2>
            <p className="text-xs text-[#8AA6B7] mt-0.5">
              Détectés en temps réel pour votre niveau{' '}
              {SURFER_LEVEL_LABELS[surferPrefs.surferLevel].label.toLowerCase()} via Open-Meteo
              Marine.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => onNavigateTab('spots')}
              className="text-xs font-medium text-[#4AE8D1] hover:underline whitespace-nowrap shrink-0"
            >
              Tous les spots &lt; 100 km
            </button>
            <button
              type="button"
              onClick={onOpenOtherSpotsSearch}
              className="surf-btn-glass inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#F3F7FA] rounded-lg whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-[#F0A53A]" />
              Chercher d’autres spots
            </button>
          </div>
        </div>

        {discoveryPicks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {discoveryPicks.map(({ spot, recommendation }) => {
              const isChosen = favoriteSpotIds.includes(spot.id);
              const dist = userLocation
                ? haversineKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
                : null;
              return (
                <div
                  key={spot.id}
                  onClick={() => onSelectSpot(spot.id)}
                  className="surf-card-interactive rounded-xl p-4 cursor-pointer flex flex-col justify-between gap-3"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[11px] text-[#8AA6B7] flex items-center gap-1.5">
                          <span>{spot.region}</span>
                          {dist !== null && (
                            <span className="font-mono tabular-nums text-[#4AE8D1]">
                              · {dist} km
                            </span>
                          )}
                        </div>
                        <div className="font-display text-xl font-bold tracking-tight text-[#F8FBFE] truncate">
                          {spot.town} — {spot.name}
                        </div>
                      </div>
                      <span className="font-display text-2xl font-extrabold tabular-nums text-[#F7C266] shrink-0 leading-none">
                        {recommendation.avgScore.toFixed(1).replace('.', ',')}
                        <span className="text-[11px] font-mono font-normal text-[#8AA6B7]">/10</span>
                      </span>
                    </div>
                    <div className="mt-2 font-mono tabular-nums text-xs text-[#CBD8E1]">
                      {recommendation.windowLabel} ·{' '}
                      {recommendation.avgWaveHeight.toFixed(1).replace('.', ',')} m (
                      {recommendation.avgSwellPeriod} s) ·{' '}
                      {windQualityLabelFr(recommendation.windQuality)}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/10">
                    <span className="text-[11px] font-medium text-[#2DD4BF] truncate">
                      {fitShortLabel(recommendation.fitStatus)}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(spot.id);
                      }}
                      className="surf-btn-glass inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-[#F3F7FA] rounded-lg whitespace-nowrap shrink-0"
                    >
                      {isChosen ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      {isChosen ? 'Ajouté' : 'Suivre'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="surf-card rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap text-xs text-[#94ACB9]">
            <span>
              {userLocation
                ? `Pas d’autre spot hors favoris en feu vert à moins de 100 km de ${userLocation.label}.`
                : 'Utilisez le menu de recherche pour explorer les conditions sur toute la côte.'}
            </span>
            <button
              type="button"
              onClick={onOpenOtherSpotsSearch}
              className="text-xs font-semibold text-[#F7C266] hover:underline whitespace-nowrap shrink-0"
            >
              Rechercher sur les {allSpots.length} spots →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
