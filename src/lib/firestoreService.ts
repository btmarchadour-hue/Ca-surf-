import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { DEFAULT_FAVORITE_SPOT_IDS } from '../data/spots';
import type {
  AlertLogRecord,
  AlertPreferences,
  BestWindowRecommendation,
  BoardType,
  BreakType,
  CrewMemberRecord,
  CrowdLevel,
  CustomSpotRecord,
  ParkingReportRecord,
  ParkingVerdict,
  SurfCrewRecord,
  SurferLevel,
  SurferPreferences,
  UserProfile,
  WindQuality,
} from '../types/surf';
import { db, handleFirestoreError, OperationType } from './firebase';
import {
  clampNumber,
  generateInviteCode,
  LIMITS,
  normalizeInviteCode,
  sanitizeAlertTime,
  sanitizeId,
  sanitizeSpotIdList,
  sanitizeText,
} from './validation';

export const DEFAULT_SURFER_PREFS: SurferPreferences = {
  displayName: 'Surfeur',
  surferLevel: 'intermediate',
  boardType: 'fish',
  homeRegion: 'Presqu’île de Crozon',
  onboardingCompleted: false,
  alertEnabled: true,
  alertTime: '06:30',
  minWaveHeight: 0.8,
  maxWaveHeight: 2.0,
  maxWindSpeed: 22,
  preferOffshoreOnly: true,
};

function normalizeLoadedProfile(raw: Partial<UserProfile>, uid: string): UserProfile {
  return {
    uid: raw.uid || uid,
    displayName: raw.displayName || 'Surfeur',
    surferLevel: (raw.surferLevel as SurferLevel) || 'intermediate',
    boardType: (raw.boardType as BoardType) || 'fish',
    homeRegion: raw.homeRegion || 'Presqu’île de Crozon',
    onboardingCompleted: Boolean(raw.onboardingCompleted),
    favoriteSpotIds: Array.isArray(raw.favoriteSpotIds)
      ? raw.favoriteSpotIds
      : DEFAULT_FAVORITE_SPOT_IDS,
    alertEnabled: raw.alertEnabled ?? true,
    alertTime: raw.alertTime || '06:30',
    minWaveHeight: raw.minWaveHeight ?? 0.8,
    maxWaveHeight: raw.maxWaveHeight ?? 2.0,
    maxWindSpeed: raw.maxWindSpeed ?? 22,
    preferOffshoreOnly: raw.preferOffshoreOnly ?? true,
    activeCrewId: raw.activeCrewId || '',
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}

export async function ensureUserProfile(
  uid: string,
  displayNameRaw: string | null
): Promise<UserProfile> {
  const path = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      return normalizeLoadedProfile(snap.data() as Partial<UserProfile>, uid);
    }

    const displayName = sanitizeText(displayNameRaw || 'Surfeur', LIMITS.MAX_DISPLAY_NAME, 'Surfeur');
    const newProfile = {
      uid,
      displayName,
      surferLevel: DEFAULT_SURFER_PREFS.surferLevel,
      boardType: DEFAULT_SURFER_PREFS.boardType,
      homeRegion: DEFAULT_SURFER_PREFS.homeRegion,
      onboardingCompleted: false,
      favoriteSpotIds: sanitizeSpotIdList(DEFAULT_FAVORITE_SPOT_IDS),
      alertEnabled: DEFAULT_SURFER_PREFS.alertEnabled,
      alertTime: DEFAULT_SURFER_PREFS.alertTime,
      minWaveHeight: DEFAULT_SURFER_PREFS.minWaveHeight,
      maxWaveHeight: DEFAULT_SURFER_PREFS.maxWaveHeight,
      maxWindSpeed: DEFAULT_SURFER_PREFS.maxWindSpeed,
      preferOffshoreOnly: DEFAULT_SURFER_PREFS.preferOffshoreOnly,
      activeCrewId: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(userRef, newProfile);
    return {
      ...newProfile,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeUserProfile(
  uid: string,
  onData: (profile: UserProfile | null) => void
): Unsubscribe {
  const path = `users/${uid}`;
  return onSnapshot(
    doc(db, 'users', uid),
    (snap) => {
      onData(snap.exists() ? normalizeLoadedProfile(snap.data() as Partial<UserProfile>, uid) : null);
    },
    (error) => {
      handleFirestoreError(error, OperationType.GET, path);
    }
  );
}

export async function updateUserFavorites(
  uid: string,
  favoriteSpotIds: string[],
  activeCrewId: string,
  displayName: string,
  alertTime: string,
  markOnboardingCompleted = true
): Promise<void> {
  const sanitized = sanitizeSpotIdList(favoriteSpotIds);
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      favoriteSpotIds: sanitized,
      onboardingCompleted: Boolean(markOnboardingCompleted),
      updatedAt: serverTimestamp(),
    });
    if (activeCrewId) {
      await syncCrewMemberFavorites(activeCrewId, uid, displayName, sanitized, alertTime);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function saveFullSurferProfile(
  uid: string,
  next: SurferPreferences & { favoriteSpotIds: string[] },
  activeCrewId: string
): Promise<void> {
  const displayName = sanitizeText(next.displayName, LIMITS.MAX_DISPLAY_NAME, 'Surfeur');
  const homeRegion = sanitizeText(next.homeRegion, LIMITS.MAX_REGION_NAME, 'Pays Basque');
  const favoriteSpotIds = sanitizeSpotIdList(next.favoriteSpotIds);
  const minWaveHeight = clampNumber(next.minWaveHeight, LIMITS.MIN_WAVE_MIN, LIMITS.MIN_WAVE_MAX);
  const maxWaveHeight = clampNumber(
    Math.max(next.maxWaveHeight, minWaveHeight),
    LIMITS.MAX_WAVE_MIN,
    LIMITS.MAX_WAVE_MAX
  );
  const maxWindSpeed = clampNumber(next.maxWindSpeed, LIMITS.WIND_MIN, LIMITS.WIND_MAX);
  const alertTime = sanitizeAlertTime(next.alertTime);

  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      displayName,
      surferLevel: next.surferLevel,
      boardType: next.boardType,
      homeRegion,
      onboardingCompleted: Boolean(next.onboardingCompleted),
      favoriteSpotIds,
      alertEnabled: Boolean(next.alertEnabled),
      alertTime,
      minWaveHeight,
      maxWaveHeight,
      maxWindSpeed,
      preferOffshoreOnly: Boolean(next.preferOffshoreOnly),
      updatedAt: serverTimestamp(),
    });
    if (activeCrewId) {
      await syncCrewMemberFavorites(activeCrewId, uid, displayName, favoriteSpotIds, alertTime);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateUserAlertPreferences(
  uid: string,
  prefs: AlertPreferences,
  activeCrewId: string,
  displayName: string,
  favoriteSpotIds: string[]
): Promise<void> {
  const minWaveHeight = clampNumber(prefs.minWaveHeight, LIMITS.MIN_WAVE_MIN, LIMITS.MIN_WAVE_MAX);
  const maxWaveHeight = clampNumber(
    Math.max(prefs.maxWaveHeight, minWaveHeight),
    LIMITS.MAX_WAVE_MIN,
    LIMITS.MAX_WAVE_MAX
  );
  const maxWindSpeed = clampNumber(prefs.maxWindSpeed, LIMITS.WIND_MIN, LIMITS.WIND_MAX);
  const alertTime = sanitizeAlertTime(prefs.alertTime);

  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      alertEnabled: Boolean(prefs.alertEnabled),
      alertTime,
      minWaveHeight,
      maxWaveHeight,
      maxWindSpeed,
      preferOffshoreOnly: Boolean(prefs.preferOffshoreOnly),
      updatedAt: serverTimestamp(),
    });
    if (activeCrewId) {
      await syncCrewMemberFavorites(
        activeCrewId,
        uid,
        displayName,
        sanitizeSpotIdList(favoriteSpotIds),
        alertTime
      );
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// Custom Surf Spots
// ============================================================================
export function subscribeCustomSpots(
  uid: string,
  onData: (spots: CustomSpotRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/customSpots`;
  const q = query(collection(db, 'users', uid, 'customSpots'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as CustomSpotRecord));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function createCustomSpot(
  uid: string,
  input: {
    name: string;
    region: string;
    lat: number;
    lng: number;
    offshoreDeg: number;
    idealMinWave: number;
    idealMaxWave: number;
    breakType: BreakType;
    idealTide: string;
  }
): Promise<string> {
  const id = sanitizeId(`custom-${input.name.toLowerCase()}-${Date.now().toString(36)}`);
  const path = `users/${uid}/customSpots/${id}`;
  const minWave = clampNumber(input.idealMinWave, LIMITS.MIN_WAVE_MIN, LIMITS.MIN_WAVE_MAX);
  const maxWave = clampNumber(
    Math.max(input.idealMaxWave, minWave),
    LIMITS.MAX_WAVE_MIN,
    LIMITS.MAX_WAVE_MAX
  );

  try {
    await setDoc(doc(db, 'users', uid, 'customSpots', id), {
      id,
      ownerId: uid,
      name: sanitizeText(input.name, LIMITS.MAX_SPOT_NAME, 'Spot perso'),
      region: sanitizeText(input.region, LIMITS.MAX_REGION_NAME, 'Côte Atlantique'),
      lat: clampNumber(input.lat, -90, 90),
      lng: clampNumber(input.lng, -180, 180),
      offshoreDeg: clampNumber(input.offshoreDeg, 0, 360),
      idealMinWave: minWave,
      idealMaxWave: maxWave,
      breakType: input.breakType,
      idealTide: sanitizeText(input.idealTide, LIMITS.MAX_IDEAL_TIDE, 'Toutes marées'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteCustomSpot(uid: string, spotId: string): Promise<void> {
  const path = `users/${uid}/customSpots/${spotId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'customSpots', spotId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// Morning Alert Logs
// ============================================================================
export function subscribeAlertLogs(
  uid: string,
  onData: (logs: AlertLogRecord[]) => void
): Unsubscribe {
  const path = `users/${uid}/alertLogs`;
  const q = query(collection(db, 'users', uid, 'alertLogs'), where('userId', '==', uid));
  return onSnapshot(
    q,
    (snap) => {
      const items = snap.docs.map((d) => d.data() as AlertLogRecord);
      items.sort((a, b) => {
        const ta =
          a.createdAt && typeof a.createdAt === 'object' && 'toMillis' in a.createdAt
            ? (a.createdAt as { toMillis: () => number }).toMillis()
            : 0;
        const tb =
          b.createdAt && typeof b.createdAt === 'object' && 'toMillis' in b.createdAt
            ? (b.createdAt as { toMillis: () => number }).toMillis()
            : 0;
        return tb - ta;
      });
      onData(items);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function logMorningAlert(
  uid: string,
  recommendation: BestWindowRecommendation
): Promise<void> {
  const id = sanitizeId(`alert-${recommendation.dateKey}-${Date.now().toString(36)}`);
  const path = `users/${uid}/alertLogs/${id}`;

  try {
    await setDoc(doc(db, 'users', uid, 'alertLogs', id), {
      id,
      userId: uid,
      dateKey: recommendation.dateKey,
      bestSpotId: sanitizeId(recommendation.spotId),
      bestSpotName: sanitizeText(recommendation.spotName, LIMITS.MAX_SPOT_NAME, 'Spot'),
      windowLabel: sanitizeText(recommendation.windowLabel, LIMITS.MAX_PLANNED_SLOT, '08h00 – 11h00'),
      waveHeight: clampNumber(recommendation.avgWaveHeight, 0, 20),
      wavePeriod: clampNumber(recommendation.avgSwellPeriod, 0, 30),
      windSpeed: clampNumber(recommendation.avgWindSpeed, 0, 150),
      windQuality: recommendation.windQuality,
      score: clampNumber(recommendation.avgScore, 0, 10),
      summary: sanitizeText(recommendation.summary, LIMITS.MAX_SUMMARY, 'Alerte matinale'),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function deleteAlertLog(uid: string, logId: string): Promise<void> {
  const path = `users/${uid}/alertLogs/${logId}`;
  try {
    await deleteDoc(doc(db, 'users', uid, 'alertLogs', logId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

// ============================================================================
// Surf Crews (Friends)
// ============================================================================
export function subscribeUserCrews(
  uid: string,
  onData: (crews: SurfCrewRecord[]) => void
): Unsubscribe {
  const path = 'crews';
  const q = query(collection(db, 'crews'), where('memberIds', 'array-contains', uid));
  return onSnapshot(
    q,
    (snap) => {
      onData(snap.docs.map((d) => d.data() as SurfCrewRecord));
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeCrewMembers(
  crewId: string,
  memberIds: string[],
  onData: (members: CrewMemberRecord[]) => void
): Unsubscribe {
  if (!crewId || memberIds.length === 0) {
    onData([]);
    return () => {};
  }

  const memberMap = new Map<string, CrewMemberRecord>();
  const unsubs: Unsubscribe[] = [];

  for (const memberUid of memberIds) {
    const path = `crews/${crewId}/members/${memberUid}`;
    const unsub = onSnapshot(
      doc(db, 'crews', crewId, 'members', memberUid),
      (snap) => {
        if (snap.exists()) {
          memberMap.set(memberUid, snap.data() as CrewMemberRecord);
        } else {
          memberMap.delete(memberUid);
        }
        onData(Array.from(memberMap.values()));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function createSurfCrew(
  profile: UserProfile,
  crewNameRaw: string
): Promise<SurfCrewRecord> {
  const crewName = sanitizeText(crewNameRaw, LIMITS.MAX_CREW_NAME, 'Mon groupe surf');
  const crewId = sanitizeId(`crew-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`);
  const inviteCode = generateInviteCode();

  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.set(doc(db, 'crews', crewId), {
    id: crewId,
    name: crewName,
    inviteCode,
    ownerId: profile.uid,
    memberIds: [profile.uid],
    createdAt: now,
    updatedAt: now,
  });

  batch.set(doc(db, 'crewInvites', inviteCode), {
    inviteCode,
    crewId,
    crewName,
    ownerId: profile.uid,
    createdAt: now,
  });

  batch.set(doc(db, 'crews', crewId, 'members', profile.uid), {
    uid: profile.uid,
    crewId,
    displayName: sanitizeText(profile.displayName, LIMITS.MAX_DISPLAY_NAME, 'Surfeur'),
    favoriteSpotIds: sanitizeSpotIdList(profile.favoriteSpotIds),
    alertTime: sanitizeAlertTime(profile.alertTime),
    plannedSpotId: '',
    plannedSlot: '',
    statusNote: '',
    createdAt: now,
    updatedAt: now,
  });

  batch.update(doc(db, 'users', profile.uid), {
    activeCrewId: crewId,
    updatedAt: now,
  });

  try {
    await batch.commit();
    return {
      id: crewId,
      name: crewName,
      inviteCode,
      ownerId: profile.uid,
      memberIds: [profile.uid],
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `crews/${crewId}`);
  }
}

export async function joinSurfCrewByCode(
  profile: UserProfile,
  rawCode: string
): Promise<{ status: 'joined' | 'already-member' | 'not-found' | 'full'; crewName?: string }> {
  const code = normalizeInviteCode(rawCode);
  if (code.length < 6) return { status: 'not-found' };

  let inviteSnap;
  try {
    inviteSnap = await getDoc(doc(db, 'crewInvites', code));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `crewInvites/${code}`);
  }

  if (!inviteSnap.exists()) return { status: 'not-found' };

  const inviteData = inviteSnap.data() as { crewId: string; crewName: string };
  const crewId = inviteData.crewId;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.update(doc(db, 'crews', crewId), {
    memberIds: arrayUnion(profile.uid),
    updatedAt: now,
  });

  batch.set(doc(db, 'crews', crewId, 'members', profile.uid), {
    uid: profile.uid,
    crewId,
    displayName: sanitizeText(profile.displayName, LIMITS.MAX_DISPLAY_NAME, 'Surfeur'),
    favoriteSpotIds: sanitizeSpotIdList(profile.favoriteSpotIds),
    alertTime: sanitizeAlertTime(profile.alertTime),
    plannedSpotId: '',
    plannedSlot: '',
    statusNote: '',
    createdAt: now,
    updatedAt: now,
  });

  batch.update(doc(db, 'users', profile.uid), {
    activeCrewId: crewId,
    updatedAt: now,
  });

  try {
    await batch.commit();
    return { status: 'joined', crewName: inviteData.crewName };
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `crews/${crewId}`);
  }
}

export async function leaveSurfCrew(uid: string, crew: SurfCrewRecord): Promise<void> {
  if (crew.ownerId === uid) return;

  const batch = writeBatch(db);
  const now = serverTimestamp();

  batch.update(doc(db, 'crews', crew.id), {
    memberIds: arrayRemove(uid),
    updatedAt: now,
  });
  batch.delete(doc(db, 'crews', crew.id, 'members', uid));
  batch.update(doc(db, 'users', uid), {
    activeCrewId: '',
    updatedAt: now,
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `crews/${crew.id}`);
  }
}

export async function switchActiveCrew(uid: string, crewId: string): Promise<void> {
  const path = `users/${uid}`;
  try {
    await updateDoc(doc(db, 'users', uid), {
      activeCrewId: crewId ? sanitizeId(crewId) : '',
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function syncCrewMemberFavorites(
  crewId: string,
  uid: string,
  displayName: string,
  favoriteSpotIds: string[],
  alertTime: string
): Promise<void> {
  try {
    await updateDoc(doc(db, 'crews', crewId, 'members', uid), {
      displayName: sanitizeText(displayName, LIMITS.MAX_DISPLAY_NAME, 'Surfeur'),
      favoriteSpotIds: sanitizeSpotIdList(favoriteSpotIds),
      alertTime: sanitizeAlertTime(alertTime),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Background sync ignore if user left crew
  }
}

export async function updateCrewSessionCheckIn(
  crewId: string,
  uid: string,
  plannedSpotId: string,
  plannedSlot: string,
  statusNote: string
): Promise<void> {
  const path = `crews/${crewId}/members/${uid}`;
  try {
    await updateDoc(doc(db, 'crews', crewId, 'members', uid), {
      plannedSpotId: plannedSpotId ? sanitizeId(plannedSpotId) : '',
      plannedSlot: sanitizeText(plannedSlot, LIMITS.MAX_PLANNED_SLOT, ''),
      statusNote: sanitizeText(statusNote, LIMITS.MAX_STATUS_NOTE, ''),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ============================================================================
// Crew Live Check Parking Reports (Terrain > Algo)
// ============================================================================
function extractTimestampMs(ts: unknown, fallbackMs = 0): number {
  if (ts && typeof ts === 'object' && 'toMillis' in ts) {
    return (ts as { toMillis: () => number }).toMillis();
  }
  if (ts instanceof Date) return ts.getTime();
  return fallbackMs;
}

export function subscribeCrewParkingReports(
  crewId: string,
  memberIds: string[],
  onData: (reports: ParkingReportRecord[]) => void
): Unsubscribe {
  if (!crewId || memberIds.length === 0) {
    onData([]);
    return () => {};
  }

  const reportMap = new Map<string, ParkingReportRecord>();
  const unsubs: Unsubscribe[] = [];

  const emitSorted = () => {
    const items = Array.from(reportMap.values()).sort(
      (a, b) =>
        extractTimestampMs(b.updatedAt, b.localUpdatedAtMs ?? 0) -
        extractTimestampMs(a.updatedAt, a.localUpdatedAtMs ?? 0)
    );
    onData(items);
  };

  for (const memberUid of memberIds) {
    const path = `crews/${crewId}/parkingReports/${memberUid}`;
    const unsub = onSnapshot(
      doc(db, 'crews', crewId, 'parkingReports', memberUid),
      (snap) => {
        if (snap.exists()) {
          reportMap.set(memberUid, snap.data() as ParkingReportRecord);
        } else {
          reportMap.delete(memberUid);
        }
        emitSorted();
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, path);
      }
    );
    unsubs.push(unsub);
  }

  return () => {
    unsubs.forEach((u) => u());
  };
}

export async function publishCrewParkingReport(
  crewId: string,
  uid: string,
  input: {
    authorName: string;
    spotId: string;
    spotName: string;
    verdict: ParkingVerdict;
    observedWaveHeight: number;
    crowdLevel: CrowdLevel;
    windFeel: WindQuality;
    note: string;
    dateKey: string;
  }
): Promise<void> {
  const path = `crews/${crewId}/parkingReports/${uid}`;
  const reportRef = doc(db, 'crews', crewId, 'parkingReports', uid);

  const sanitizedBase = {
    authorName: sanitizeText(input.authorName, LIMITS.MAX_DISPLAY_NAME, 'Surfeur'),
    spotId: sanitizeId(input.spotId),
    spotName: sanitizeText(input.spotName, LIMITS.MAX_SPOT_NAME, 'Spot'),
    verdict: input.verdict,
    observedWaveHeight: clampNumber(
      input.observedWaveHeight,
      LIMITS.PARKING_WAVE_MIN,
      LIMITS.PARKING_WAVE_MAX
    ),
    crowdLevel: input.crowdLevel,
    windFeel: input.windFeel,
    note: sanitizeText(input.note, LIMITS.MAX_PARKING_NOTE, ''),
    dateKey: input.dateKey,
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(reportRef);
    if (existingSnap.exists()) {
      await updateDoc(reportRef, sanitizedBase);
    } else {
      await setDoc(reportRef, {
        uid,
        crewId,
        ...sanitizedBase,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCrewParkingReport(crewId: string, memberUid: string): Promise<void> {
  const path = `crews/${crewId}/parkingReports/${memberUid}`;
  try {
    await deleteDoc(doc(db, 'crews', crewId, 'parkingReports', memberUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

