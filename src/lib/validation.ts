// Synchronized verbatim with firebase-blueprint.json & firestore.rules

export const ID_PATTERN = /^[a-zA-Z0-9_-]+$/;
export const INVITE_CODE_PATTERN = /^[A-Z0-9]{6,12}$/;
export const ALERT_TIME_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;
export const DATE_KEY_PATTERN = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

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
  const cleaned = value.trim().replace(/\s+/g, ' ');
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

export function sanitizeId(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, LIMITS.MAX_ID_LENGTH);
  return cleaned || `id-${Date.now()}`;
}

export function sanitizeSpotIdList(ids: string[]): string[] {
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

export function sanitizeAlertTime(time: string): string {
  const trimmed = time.trim();
  return ALERT_TIME_PATTERN.test(trimmed) ? trimmed : '06:30';
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Number(value.toFixed(2))));
}

export function normalizeInviteCode(input: string): string {
  return input
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

export function generateInviteCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'HC';
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}
