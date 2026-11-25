export type BreakType = 'beach' | 'reef' | 'point';

export type WindQuality = 'glassy' | 'offshore' | 'cross' | 'onshore';

export type SurferLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type BoardType = 'longboard' | 'midlength' | 'fish' | 'shortboard';

export type ProfileFitStatus = 'ideal' | 'compatible' | 'challenging';

export interface SurfSpot {
  id: string;
  name: string;
  town: string;
  region: string;
  lat: number;
  lng: number;
  /** Wind direction (degrees FROM) that is cleanly offshore */
  offshoreDeg: number;
  /** Ideal incoming swell direction (degrees FROM) */
  idealSwellDeg: number;
  idealMinWave: number;
  idealMaxWave: number;
  breakType: BreakType;
  difficulty: SurferLevel;
  bestBoards: BoardType[];
  waveCharacter: string;
  idealTide: string;
  apiProvider: string;
  imageUrl: string;
  isCustom?: boolean;
}

export interface HourlySurfPoint {
  timeIso: string;
  dateKey: string; // YYYY-MM-DD
  hour: number; // 0..23
  waveHeight: number; // meters
  waveDirection: number; // degrees
  wavePeriod: number; // seconds
  swellHeight: number;
  swellDirection: number;
  swellPeriod: number;
  waterTemp: number | null; // sea_surface_temperature Celsius
  windSpeed: number; // km/h
  windDirection: number; // degrees (blowing FROM)
  windGusts: number; // km/h
  airTemp: number; // Celsius
  weatherCode: number;
  cloudCover: number;
  windQuality: WindQuality;
  isDaylight: boolean;
  score: number; // 0..10 deterministic surfability score
}

export interface DaylightSpan {
  dateKey: string;
  sunriseIso: string;
  sunsetIso: string;
  sunriseHour: number;
  sunsetHour: number;
}

export interface BestWindowRecommendation {
  spotId: string;
  spotName: string;
  dateKey: string;
  startHour: number;
  endHour: number;
  windowLabel: string; // e.g. "07h00 – 10h00"
  avgScore: number;
  peakScore: number;
  avgWaveHeight: number;
  avgSwellPeriod: number;
  avgWindSpeed: number;
  windDirection: number;
  windQuality: WindQuality;
  airTemp: number;
  waterTemp: number | null;
  wetsuitLabel: string;
  fitStatus: ProfileFitStatus;
  coherenceNote: string;
  summary: string;
}

export interface SpotForecast {
  spotId: string;
  fetchedAt: number;
  current: HourlySurfPoint;
  hourly: HourlySurfPoint[];
  daylightByDate: Record<string, DaylightSpan>;
}

export interface AlertPreferences {
  alertEnabled: boolean;
  alertTime: string; // HH:MM
  minWaveHeight: number;
  maxWaveHeight: number;
  maxWindSpeed: number;
  preferOffshoreOnly: boolean;
}

export interface SurferPreferences extends AlertPreferences {
  displayName: string;
  surferLevel: SurferLevel;
  boardType: BoardType;
  homeRegion: string;
  onboardingCompleted: boolean;
}

export interface UserProfile extends SurferPreferences {
  uid: string;
  favoriteSpotIds: string[];
  activeCrewId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CustomSpotRecord {
  id: string;
  ownerId: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  offshoreDeg: number;
  idealMinWave: number;
  idealMaxWave: number;
  breakType: BreakType;
  idealTide: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AlertLogRecord {
  id: string;
  userId: string;
  dateKey: string;
  bestSpotId: string;
  bestSpotName: string;
  windowLabel: string;
  waveHeight: number;
  wavePeriod: number;
  windSpeed: number;
  windQuality: WindQuality;
  score: number;
  summary: string;
  createdAt?: unknown;
}

export interface SurfCrewRecord {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  memberIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CrewMemberRecord {
  uid: string;
  crewId: string;
  displayName: string;
  favoriteSpotIds: string[];
  alertTime: string;
  plannedSpotId: string;
  plannedSlot: string;
  statusNote: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type ParkingVerdict = 'go' | 'moyen' | 'carotte';

export type CrowdLevel = 'vide' | 'tranquille' | 'monde' | 'blinde';

export interface ParkingReportRecord {
  uid: string;
  crewId: string;
  authorName: string;
  spotId: string;
  spotName: string;
  verdict: ParkingVerdict;
  observedWaveHeight: number;
  crowdLevel: CrowdLevel;
  windFeel: WindQuality;
  note: string;
  dateKey: string;
  createdAt?: unknown;
  updatedAt?: unknown;
  /** Client-only timestamp for local/guest mode sorting (never written to Firestore) */
  localUpdatedAtMs?: number;
}

export interface ShelterFallback {
  spot: SurfSpot;
  recommendation: BestWindowRecommendation;
  distanceKm: number;
  trigger: 'wind' | 'swell' | 'score' | 'backup';
  reason: string;
  isActiveAlert: boolean;
}

export interface SpotWebcamInfo {
  primaryUrl: string;
  primaryLabel: string;
  secondaryUrl: string;
  secondaryLabel: string;
  note: string;
  hasDirectBeachCam: boolean;
}

export type ActiveTab = 'session' | 'spots' | 'crew' | 'profile';

