// Synchronized verbatim with firebase-blueprint.json & firestore.rules
import type {
  BoardType,
  CrowdLevel,
  ParkingReportRecord,
  ParkingVerdict,
  SurferLevel,
  SurferPreferences,
  UserLocation,
  WindQuality,
} from '../types/surf';

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const INVITE_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;
export const ALERT_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const DATE_KEY_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

const VALID_SURFER_LEVELS: readonly SurferLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
];
const VALID_BOARD_TYPES: readonly BoardType[] = [
  'longboard',
  'midlength',
  'fish',
  'shortboard',
];
const VALID_PARKING_VERDICTS: readonly ParkingVerdict[] = ['go', 'moyen', 'carotte'];
const VALID_CROWD_LEVELS: readonly CrowdLevel[] = ['vide', 'tranquille', 'monde', 'blinde'];
const VALID_WIND_QUALITIES: readonly WindQuality[] = ['glassy', 'offshore', 'cross', 'onshore'];

export const LIMITS = {
  MAX_ID_LENGTH: 128,
  MAX_DISPLAY_NAME: 60,
  MAX_FAVORITE_SPOTS: 15,
  MAX_CREW_NAME: 60,
  MAX_CREW_MEMBERS: 25,
  MAX_SPOT_NAME: 80,
  MAX_REGION_NAME: 60,
  MAX_IDEAL_TIDE: 40,
  MAX_PLANNED_SLOT: 30,
  MAX_STATUS_NOTE: 120,
  MAX_PARKING_NOTE: 200,
  MAX_SUMMARY: 240,
  MIN_WAVE_MIN: 0.2,
  MIN_WAVE_MAX: 5.0,
  MAX_WAVE_MIN: 0.5,
  MAX_WAVE_MAX: 8.0,
  PARKING_WAVE_MIN: 0,
  PARKING_WAVE_MAX: 10,
  WIND_MIN: 5,
  WIND_MAX: 60,
} as const;

export function sanitizeText(value: string, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

export function sanitizeId(value: string): string {
  if (typeof value !== 'string') return generateSecureId('id');
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, LIMITS.MAX_ID_LENGTH);
  return cleaned || generateSecureId('id');
}

export function sanitizeSpotIdList(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.length > LIMITS.MAX_ID_LENGTH || !ID_PATTERN.test(trimmed)) continue;
    if (seen.has(trimmed)) continue;
    seen.add(trimmed);
    result.push(trimmed);
    if (result.length >= LIMITS.MAX_FAVORITE_SPOTS) break;
  }
  return result;
}

export function sanitizeAlertTime(time: unknown): string {
  if (typeof time !== 'string') return '06:30';
  const trimmed = time.trim();
  return ALERT_TIME_PATTERN.test(trimmed) ? trimmed : '06:30';
}

export function clampNumber(value: unknown, min: number, max: number): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.min(max, Math.max(min, Number(num.toFixed(2))));
}

export function normalizeInviteCode(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

/**
 * Generates a cryptographically unpredictable 12-character invite code (50 bits of CSPRNG entropy)
 * using a 32-character power-of-2 alphabet (zero modulo bias via byte & 31).
 */
export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 unambiguous chars (2^5)
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let code = 'CS';
  for (let i = 0; i < bytes.length; i++) {
    code += alphabet[bytes[i] & 31];
  }
  return code;
}

/**
 * Generates a cryptographically unpredictable Firestore document ID (80 bits of CSPRNG entropy).
 */
export function generateSecureId(prefix = 'id'): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < bytes.length; i++) {
    suffix += alphabet[bytes[i] % alphabet.length];
  }
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'id';
  return `${cleanPrefix}-${suffix}`.slice(0, LIMITS.MAX_ID_LENGTH);
}

/**
 * Strict URL scheme guard blocking javascript:, data:, vbscript:, and insecure http: links.
 * Returns null if the URL is invalid or uses a disallowed protocol.
 */
export function toSafeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function sanitizeSurferPrefs(
  raw: unknown,
  fallback: SurferPreferences
): SurferPreferences {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const surferLevel = VALID_SURFER_LEVELS.includes(obj.surferLevel as SurferLevel)
    ? (obj.surferLevel as SurferLevel)
    : fallback.surferLevel;
  const boardType = VALID_BOARD_TYPES.includes(obj.boardType as BoardType)
    ? (obj.boardType as BoardType)
    : fallback.boardType;
  const minWaveHeight = clampNumber(
    obj.minWaveHeight ?? fallback.minWaveHeight,
    LIMITS.MIN_WAVE_MIN,
    LIMITS.MIN_WAVE_MAX
  );
  const maxWaveHeight = clampNumber(
    Math.max(Number(obj.maxWaveHeight ?? fallback.maxWaveHeight) || fallback.maxWaveHeight, minWaveHeight),
    LIMITS.MAX_WAVE_MIN,
    LIMITS.MAX_WAVE_MAX
  );

  return {
    displayName: sanitizeText(
      typeof obj.displayName === 'string' ? obj.displayName : '',
      LIMITS.MAX_DISPLAY_NAME,
      fallback.displayName
    ),
    surferLevel,
    boardType,
    homeRegion: sanitizeText(
      typeof obj.homeRegion === 'string' ? obj.homeRegion : '',
      LIMITS.MAX_REGION_NAME,
      fallback.homeRegion
    ),
    onboardingCompleted: Boolean(obj.onboardingCompleted),
    alertEnabled: typeof obj.alertEnabled === 'boolean' ? obj.alertEnabled : fallback.alertEnabled,
    alertTime: sanitizeAlertTime(obj.alertTime ?? fallback.alertTime),
    minWaveHeight,
    maxWaveHeight,
    maxWindSpeed: clampNumber(
      obj.maxWindSpeed ?? fallback.maxWindSpeed,
      LIMITS.WIND_MIN,
      LIMITS.WIND_MAX
    ),
    preferOffshoreOnly:
      typeof obj.preferOffshoreOnly === 'boolean'
        ? obj.preferOffshoreOnly
        : fallback.preferOffshoreOnly,
  };
}

export function sanitizeParkingReports(raw: unknown): ParkingReportRecord[] {
  if (!Array.isArray(raw)) return [];
  const result: ParkingReportRecord[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as Record<string, unknown>;
    if (
      typeof obj.spotId !== 'string' ||
      !ID_PATTERN.test(obj.spotId) ||
      typeof obj.verdict !== 'string' ||
      !VALID_PARKING_VERDICTS.includes(obj.verdict as ParkingVerdict) ||
      typeof obj.crowdLevel !== 'string' ||
      !VALID_CROWD_LEVELS.includes(obj.crowdLevel as CrowdLevel) ||
      typeof obj.windFeel !== 'string' ||
      !VALID_WIND_QUALITIES.includes(obj.windFeel as WindQuality) ||
      typeof obj.dateKey !== 'string' ||
      !DATE_KEY_PATTERN.test(obj.dateKey)
    ) {
      continue;
    }

    result.push({
      uid: typeof obj.uid === 'string' && ID_PATTERN.test(obj.uid) ? obj.uid.slice(0, LIMITS.MAX_ID_LENGTH) : 'local-guest',
      crewId: typeof obj.crewId === 'string' && ID_PATTERN.test(obj.crewId) ? obj.crewId.slice(0, LIMITS.MAX_ID_LENGTH) : 'local',
      authorName: sanitizeText(typeof obj.authorName === 'string' ? obj.authorName : '', LIMITS.MAX_DISPLAY_NAME, 'Surfeur'),
      spotId: obj.spotId.slice(0, LIMITS.MAX_ID_LENGTH),
      spotName: sanitizeText(typeof obj.spotName === 'string' ? obj.spotName : '', LIMITS.MAX_SPOT_NAME, 'Spot'),
      verdict: obj.verdict as ParkingVerdict,
      observedWaveHeight: clampNumber(obj.observedWaveHeight, LIMITS.PARKING_WAVE_MIN, LIMITS.PARKING_WAVE_MAX),
      crowdLevel: obj.crowdLevel as CrowdLevel,
      windFeel: obj.windFeel as WindQuality,
      note: sanitizeText(typeof obj.note === 'string' ? obj.note : '', LIMITS.MAX_PARKING_NOTE, ''),
      dateKey: obj.dateKey,
      localUpdatedAtMs:
        typeof obj.localUpdatedAtMs === 'number' && Number.isFinite(obj.localUpdatedAtMs)
          ? obj.localUpdatedAtMs
          : undefined,
    });
    if (result.length >= 12) break;
  }
  return result;
}

export function sanitizeUserLocation(raw: unknown): UserLocation | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.lat !== 'number' ||
    typeof obj.lng !== 'number' ||
    !Number.isFinite(obj.lat) ||
    !Number.isFinite(obj.lng) ||
    obj.lat < -90 ||
    obj.lat > 90 ||
    obj.lng < -180 ||
    obj.lng > 180
  ) {
    return null;
  }
  const source = obj.source === 'gps' || obj.source === 'city' ? obj.source : 'city';
  return {
    lat: Number(obj.lat.toFixed(4)),
    lng: Number(obj.lng.toFixed(4)),
    label: sanitizeText(typeof obj.label === 'string' ? obj.label : '', 80, 'Ma position'),
    source,
  };
}
