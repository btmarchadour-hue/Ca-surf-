import { BOARD_TYPE_LABELS, SURFER_LEVEL_LABELS } from '../data/spots';
import type {
  BestWindowRecommendation,
  BoardType,
  DaylightSpan,
  HourlySurfPoint,
  ParkingReportRecord,
  ProfileFitStatus,
  ShelterFallback,
  SpotForecast,
  SpotWebcamInfo,
  SurferLevel,
  SurferPreferences,
  SurfSpot,
  WindQuality,
} from '../types/surf';

interface MarineApiResponse {
  hourly?: {
    time: string[];
    wave_height: (number | null)[];
    wave_direction: (number | null)[];
    wave_period: (number | null)[];
    swell_wave_height: (number | null)[];
    swell_wave_direction: (number | null)[];
    swell_wave_period: (number | null)[];
    sea_surface_temperature?: (number | null)[];
  };
}

interface WeatherApiResponse {
  hourly?: {
    time: string[];
    wind_speed_10m: (number | null)[];
    wind_direction_10m: (number | null)[];
    wind_gusts_10m: (number | null)[];
    temperature_2m: (number | null)[];
    weather_code: (number | null)[];
    cloud_cover: (number | null)[];
  };
  daily?: {
    time: string[];
    sunrise: string[];
    sunset: string[];
  };
}

export interface GeoSearchResult {
  id: number;
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
}

const COMPASS_LABELS_FR = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

const LEVEL_RANK: Record<SurferLevel, number> = {
  beginner: 0,
  intermediate: 1,
  advanced: 2,
  expert: 3,
};

export function degreesToCompass(deg: number): string {
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS_LABELS_FR[Math.round(normalized / 45) % 8];
}

export function angularDifference(a: number, b: number): number {
  const diff = Math.abs((((a - b) % 360) + 360) % 360);
  return diff > 180 ? 360 - diff : diff;
}

export function classifyWindQuality(
  windSpeedKmh: number,
  windDirDeg: number,
  offshoreDeg: number
): WindQuality {
  if (windSpeedKmh <= 7) return 'glassy';
  const angle = angularDifference(windDirDeg, offshoreDeg);
  if (angle <= 50) return 'offshore';
  if (angle <= 115) return 'cross';
  return 'onshore';
}

export function windQualityLabelFr(quality: WindQuality): string {
  switch (quality) {
    case 'glassy':
      return 'Glassy';
    case 'offshore':
      return 'Offshore';
    case 'cross':
      return 'Cross-shore';
    case 'onshore':
      return 'Onshore';
  }
}

export function weatherLabelFr(code: number): string {
  if (code === 0) return 'Grand soleil';
  if (code <= 2) return 'Éclaircies';
  if (code === 3) return 'Couvert';
  if (code <= 48) return 'Brume côtière';
  if (code <= 57) return 'Bruine';
  if (code <= 67) return 'Pluie';
  if (code <= 82) return 'Averses';
  return 'Orage';
}

export function recommendWetsuitFr(waterTemp: number | null): string {
  if (waterTemp === null || !Number.isFinite(waterTemp)) return 'Combi 4/3 mm';
  if (waterTemp <= 11.5) return '5/4 mm + chaussons & cagoule';
  if (waterTemp <= 14.5) return '4/3 mm + chaussons';
  if (waterTemp <= 17.5) return '4/3 mm intégrale';
  if (waterTemp <= 20.5) return '3/2 mm intégrale';
  return 'Shorty ou boardshort';
}

export function scoreLabelFr(score: number): {
  label: string;
  tone: 'optimal' | 'good' | 'fair' | 'poor';
} {
  if (score >= 7.6) return { label: 'Session feu vert', tone: 'optimal' };
  if (score >= 5.8) return { label: 'Bonne session', tone: 'good' };
  if (score >= 4.0) return { label: 'Surfable', tone: 'fair' };
  return { label: 'Conditions dégradées', tone: 'poor' };
}

export function evaluateProfileFit(
  spot: SurfSpot,
  avgWaveHeight: number,
  surferLevel: SurferLevel,
  boardType: BoardType
): { fitStatus: ProfileFitStatus; multiplier: number; reason: string } {
  const userRank = LEVEL_RANK[surferLevel];
  const spotRank = LEVEL_RANK[spot.difficulty];
  const boardMatch = spot.bestBoards.includes(boardType);
  const levelLabel = SURFER_LEVEL_LABELS[surferLevel].label.toLowerCase();
  const boardLabel = BOARD_TYPE_LABELS[boardType].label;

  // Safety / coherence guard: don't send beginners into heavy expert spots or big surf
  if (spotRank - userRank >= 2 || (surferLevel === 'beginner' && avgWaveHeight > 1.7)) {
    return {
      fitStatus: 'challenging',
      multiplier: 0.58,
      reason: `Spot ou taille trop exigeants pour un profil ${levelLabel} — privilégiez un repli plus doux.`,
    };
  }

  if (spotRank - userRank === 1 && avgWaveHeight > 1.8) {
    return {
      fitStatus: 'challenging',
      multiplier: 0.76,
      reason: `Vagues solides pour un niveau ${levelLabel} ; restez vigilant sur le placement au pic.`,
    };
  }

  if (boardMatch && userRank >= spotRank) {
    return {
      fitStatus: 'ideal',
      multiplier: 1.07,
      reason: `Parfaitement cohérent avec votre niveau ${levelLabel} en ${boardLabel}.`,
    };
  }

  if (boardType === 'longboard' && avgWaveHeight <= 1.4 && spot.breakType !== 'reef') {
    return {
      fitStatus: 'ideal',
      multiplier: 1.05,
      reason: `Taille idéale pour dérouler en ${boardLabel}.`,
    };
  }

  if (boardType === 'shortboard' && avgWaveHeight < 0.75) {
    return {
      fitStatus: 'compatible',
      multiplier: 0.88,
      reason: `Un peu mou pour un shortboard ; sortez plutôt du volume ou un fish.`,
    };
  }

  return {
    fitStatus: 'compatible',
    multiplier: 1.0,
    reason: `Compatible avec votre profil ${levelLabel} (${boardLabel}).`,
  };
}

/**
 * Deterministic physics + surfer-profile surfability score (0 to 10)
 */
export function computeHourlySurfScore(
  spot: SurfSpot,
  point: {
    waveHeight: number;
    swellHeight: number;
    swellPeriod: number;
    swellDirection: number;
    windSpeed: number;
    windQuality: WindQuality;
  },
  prefs?: Partial<SurferPreferences>
): number {
  const effectiveHeight = Math.max(point.swellHeight, point.waveHeight);
  const minIdeal = prefs?.minWaveHeight ?? spot.idealMinWave;
  const maxIdeal = prefs?.maxWaveHeight ?? spot.idealMaxWave;
  const maxWind = prefs?.maxWindSpeed ?? 26;

  // 1. Wave height score (0..3.6)
  let heightScore = 0;
  if (effectiveHeight < 0.35) {
    heightScore = 0.2;
  } else if (effectiveHeight >= minIdeal && effectiveHeight <= maxIdeal) {
    heightScore = 3.6;
  } else if (effectiveHeight < minIdeal) {
    const ratio = effectiveHeight / Math.max(minIdeal, 0.4);
    heightScore = Math.max(0.4, ratio * 3.1);
  } else {
    const excess = effectiveHeight - maxIdeal;
    heightScore = Math.max(0.6, 3.4 - excess * 1.25);
  }

  // 2. Swell period score (0..2.4)
  let periodScore = 0.6;
  if (point.swellPeriod >= 14) periodScore = 2.4;
  else if (point.swellPeriod >= 12) periodScore = 2.15;
  else if (point.swellPeriod >= 10) periodScore = 1.75;
  else if (point.swellPeriod >= 8) periodScore = 1.25;
  else periodScore = 0.7;

  // 3. Wind quality & speed score (0..3.4)
  let windScore = 1.5;
  if (point.windQuality === 'glassy') {
    windScore = 3.4;
  } else if (point.windQuality === 'offshore') {
    if (point.windSpeed <= 18) windScore = 3.3;
    else if (point.windSpeed <= 28) windScore = 2.6;
    else windScore = 1.6;
  } else if (point.windQuality === 'cross') {
    if (point.windSpeed <= 14) windScore = 2.1;
    else if (point.windSpeed <= 22) windScore = 1.3;
    else windScore = 0.6;
  } else {
    if (point.windSpeed <= 12) windScore = 1.3;
    else if (point.windSpeed <= 20) windScore = 0.6;
    else windScore = 0.15;
  }

  if (
    prefs?.preferOffshoreOnly &&
    (point.windQuality === 'onshore' || point.windQuality === 'cross')
  ) {
    windScore *= 0.55;
  }
  if (point.windSpeed > maxWind) {
    windScore *= 0.6;
  }

  // 4. Swell direction alignment (0..0.6)
  const swellDiff = angularDifference(point.swellDirection, spot.idealSwellDeg);
  const swellDirScore = swellDiff <= 35 ? 0.6 : swellDiff <= 70 ? 0.4 : 0.15;

  let raw = heightScore + periodScore + windScore + swellDirScore;

  // 5. Surfer level & board coherence multiplier
  if (prefs?.surferLevel && prefs?.boardType) {
    const fit = evaluateProfileFit(spot, effectiveHeight, prefs.surferLevel, prefs.boardType);
    raw *= fit.multiplier;
  }

  return Number(Math.min(10, Math.max(0.5, raw)).toFixed(1));
}

function parseIsoHour(iso: string): number {
  const timePart = iso.split('T')[1] ?? '00:00';
  const [hStr, mStr] = timePart.split(':');
  return Number(hStr) + Number(mStr ?? 0) / 60;
}

export function getLocalDateKey(offsetDays = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFrenchDateLabel(dateKey: string): string {
  const today = getLocalDateKey(0);
  const tomorrow = getLocalDateKey(1);
  if (dateKey === today) return 'Aujourd’hui';
  if (dateKey === tomorrow) return 'Demain';
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(dt);
}

export function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, '0')}h00`;
}

async function fetchSpotChunk(spots: SurfSpot[]): Promise<Record<string, SpotForecast>> {
  const lats = spots.map((s) => s.lat.toFixed(4)).join(',');
  const lngs = spots.map((s) => s.lng.toFixed(4)).join(',');

  const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lats}&longitude=${lngs}&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,sea_surface_temperature&timezone=auto&forecast_days=4`;
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lngs}&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,weather_code,cloud_cover&daily=sunrise,sunset&timezone=auto&forecast_days=4`;

  const [marineRes, weatherRes] = await Promise.all([fetch(marineUrl), fetch(weatherUrl)]);

  if (!marineRes.ok || !weatherRes.ok) {
    throw new Error('Impossible de récupérer les données marines Open-Meteo pour le moment.');
  }

  const marineJson = (await marineRes.json()) as MarineApiResponse | MarineApiResponse[];
  const weatherJson = (await weatherRes.json()) as WeatherApiResponse | WeatherApiResponse[];

  const marineList: MarineApiResponse[] = Array.isArray(marineJson) ? marineJson : [marineJson];
  const weatherList: WeatherApiResponse[] = Array.isArray(weatherJson) ? weatherJson : [weatherJson];

  const now = new Date();
  const nowDateKey = getLocalDateKey(0);
  const nowHour = now.getHours();
  const fetchedAt = Date.now();

  const results: Record<string, SpotForecast> = {};

  spots.forEach((spot, index) => {
    const marine = marineList[index]?.hourly;
    const weather = weatherList[index]?.hourly;
    const daily = weatherList[index]?.daily;

    if (!marine || !weather) return;

    const daylightByDate: Record<string, DaylightSpan> = {};
    if (daily) {
      daily.time.forEach((dateKey, dIdx) => {
        const sunriseIso = daily.sunrise[dIdx] ?? `${dateKey}T07:30`;
        const sunsetIso = daily.sunset[dIdx] ?? `${dateKey}T18:30`;
        daylightByDate[dateKey] = {
          dateKey,
          sunriseIso,
          sunsetIso,
          sunriseHour: parseIsoHour(sunriseIso),
          sunsetHour: parseIsoHour(sunsetIso),
        };
      });
    }

    const hourly: HourlySurfPoint[] = marine.time.map((timeIso, hIdx) => {
      const [dateKey, timePart = '00:00'] = timeIso.split('T');
      const hour = Number(timePart.split(':')[0]);
      const waveHeight = Number((marine.wave_height[hIdx] ?? 0).toFixed(2));
      const waveDirection = Math.round(marine.wave_direction[hIdx] ?? spot.idealSwellDeg);
      const wavePeriod = Number((marine.wave_period[hIdx] ?? 8).toFixed(1));
      const swellHeight = Number((marine.swell_wave_height[hIdx] ?? waveHeight).toFixed(2));
      const swellDirection = Math.round(marine.swell_wave_direction[hIdx] ?? waveDirection);
      const swellPeriod = Number((marine.swell_wave_period[hIdx] ?? wavePeriod).toFixed(1));
      const rawWater = marine.sea_surface_temperature?.[hIdx];
      const waterTemp =
        rawWater !== null && rawWater !== undefined && Number.isFinite(rawWater)
          ? Number(rawWater.toFixed(1))
          : null;

      const windSpeed = Math.round(weather.wind_speed_10m[hIdx] ?? 0);
      const windDirection = Math.round(weather.wind_direction_10m[hIdx] ?? 0);
      const windGusts = Math.round(weather.wind_gusts_10m[hIdx] ?? windSpeed);
      const airTemp = Math.round(weather.temperature_2m[hIdx] ?? 15);
      const weatherCode = weather.weather_code[hIdx] ?? 1;
      const cloudCover = Math.round(weather.cloud_cover[hIdx] ?? 30);

      const windQuality = classifyWindQuality(windSpeed, windDirection, spot.offshoreDeg);
      const span = daylightByDate[dateKey];
      const isDaylight = span
        ? hour >= Math.floor(span.sunriseHour) && hour <= Math.ceil(span.sunsetHour)
        : hour >= 7 && hour <= 19;

      const score = computeHourlySurfScore(spot, {
        waveHeight,
        swellHeight,
        swellPeriod,
        swellDirection,
        windSpeed,
        windQuality,
      });

      return {
        timeIso,
        dateKey,
        hour,
        waveHeight,
        waveDirection,
        wavePeriod,
        swellHeight,
        swellDirection,
        swellPeriod,
        waterTemp,
        windSpeed,
        windDirection,
        windGusts,
        airTemp,
        weatherCode,
        cloudCover,
        windQuality,
        isDaylight,
        score,
      };
    });

    const currentPoint =
      hourly.find((p) => p.dateKey === nowDateKey && p.hour === nowHour) ??
      hourly.find((p) => p.dateKey === nowDateKey && p.isDaylight) ??
      hourly[0];

    if (currentPoint) {
      results[spot.id] = {
        spotId: spot.id,
        fetchedAt,
        current: currentPoint,
        hourly,
        daylightByDate,
      };
    }
  });

  return results;
}

export async function fetchAllSpotsForecasts(
  spots: SurfSpot[]
): Promise<Record<string, SpotForecast>> {
  if (spots.length === 0) return {};

  const chunkSize = 18;
  const chunks: SurfSpot[][] = [];
  for (let i = 0; i < spots.length; i += chunkSize) {
    chunks.push(spots.slice(i, i + chunkSize));
  }

  const settled = await Promise.allSettled(chunks.map((c) => fetchSpotChunk(c)));
  const merged: Record<string, SpotForecast> = {};
  let succeeded = 0;

  for (const res of settled) {
    if (res.status === 'fulfilled') {
      Object.assign(merged, res.value);
      succeeded++;
    }
  }

  if (succeeded === 0) {
    throw new Error('Impossible de récupérer les données marines Open-Meteo pour le moment.');
  }

  return merged;
}

/**
 * Finds the best contiguous 3-hour daylight surf window tailored to the surfer's profile.
 */
export function findBestWindowForSpot(
  spot: SurfSpot,
  forecast: SpotForecast | undefined,
  dateKey: string,
  prefs?: Partial<SurferPreferences>,
  options?: { morningOnly?: boolean; includePastToday?: boolean }
): BestWindowRecommendation | null {
  if (!forecast) return null;

  const todayKey = getLocalDateKey(0);
  const currentHour = new Date().getHours();

  const dayPoints = forecast.hourly.filter((p) => {
    if (p.dateKey !== dateKey || !p.isDaylight) return false;
    if (options?.morningOnly && p.hour > 13) return false;
    if (dateKey === todayKey && !options?.includePastToday && p.hour < currentHour - 1) {
      return false;
    }
    return true;
  });

  const candidatePoints =
    dayPoints.length > 0
      ? dayPoints
      : forecast.hourly.filter(
          (p) => p.dateKey === dateKey && p.isDaylight && (!options?.morningOnly || p.hour <= 13)
        );

  if (candidatePoints.length === 0) return null;

  const scored = candidatePoints.map((p) => ({
    ...p,
    score: prefs ? computeHourlySurfScore(spot, p, prefs) : p.score,
  }));

  const windowSize = Math.min(3, scored.length);
  let bestSlice = scored.slice(0, windowSize);
  let bestAvg = -1;

  for (let i = 0; i <= scored.length - windowSize; i++) {
    const slice = scored.slice(i, i + windowSize);
    const avg = slice.reduce((acc, item) => acc + item.score, 0) / slice.length;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestSlice = slice;
    }
  }

  const startHour = bestSlice[0].hour;
  const endHour = bestSlice[bestSlice.length - 1].hour + 1;
  const avgWaveHeight = Number(
    (bestSlice.reduce((s, p) => s + p.waveHeight, 0) / bestSlice.length).toFixed(1)
  );
  const avgSwellPeriod = Math.round(
    bestSlice.reduce((s, p) => s + p.swellPeriod, 0) / bestSlice.length
  );
  const avgWindSpeed = Math.round(
    bestSlice.reduce((s, p) => s + p.windSpeed, 0) / bestSlice.length
  );
  const midPoint = bestSlice[Math.floor(bestSlice.length / 2)];
  const peakScore = Math.max(...bestSlice.map((p) => p.score));
  const avgScore = Number(bestAvg.toFixed(1));
  const windowLabel = `${formatHourLabel(startHour)} – ${formatHourLabel(endHour)}`;
  const windDirLabel = degreesToCompass(midPoint.windDirection);
  const windQualLabel = windQualityLabelFr(midPoint.windQuality);
  const waterTemp = midPoint.waterTemp;
  const wetsuitLabel = recommendWetsuitFr(waterTemp);

  const fit = evaluateProfileFit(
    spot,
    avgWaveHeight,
    prefs?.surferLevel ?? 'intermediate',
    prefs?.boardType ?? 'fish'
  );

  const summary = `${avgWaveHeight.toFixed(1).replace('.', ',')} m à ${avgSwellPeriod} s · Vent ${windQualLabel.toLowerCase()} ${windDirLabel} ${avgWindSpeed} km/h · ${windowLabel}`;

  return {
    spotId: spot.id,
    spotName: `${spot.town} — ${spot.name}`,
    dateKey,
    startHour,
    endHour,
    windowLabel,
    avgScore,
    peakScore,
    avgWaveHeight,
    avgSwellPeriod,
    avgWindSpeed,
    windDirection: midPoint.windDirection,
    windQuality: midPoint.windQuality,
    airTemp: midPoint.airTemp,
    waterTemp,
    wetsuitLabel,
    fitStatus: fit.fitStatus,
    coherenceNote: fit.reason,
    summary,
  };
}

export function rankSpotsForDate(
  spots: SurfSpot[],
  forecasts: Record<string, SpotForecast>,
  dateKey: string,
  prefs?: Partial<SurferPreferences>,
  options?: { morningOnly?: boolean; includePastToday?: boolean }
): Array<{ spot: SurfSpot; recommendation: BestWindowRecommendation }> {
  const ranked: Array<{ spot: SurfSpot; recommendation: BestWindowRecommendation }> = [];

  for (const spot of spots) {
    const rec = findBestWindowForSpot(spot, forecasts[spot.id], dateKey, prefs, options);
    if (rec) {
      ranked.push({ spot, recommendation: rec });
    }
  }

  return ranked.sort((a, b) => b.recommendation.avgScore - a.recommendation.avgScore);
}

export async function searchCoastalLocation(query: string): Promise<GeoSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
    trimmed
  )}&count=6&language=fr&format=json`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = (await res.json()) as { results?: GeoSearchResult[] };
  return data.results ?? [];
}

// ============================================================================
// Mode Repli — Automatic Coastal Shelter Engine (Crozon, Finistère & Coast)
// ============================================================================
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

const WIND_QUALITY_RANK: Record<WindQuality, number> = {
  glassy: 3,
  offshore: 2,
  cross: 1,
  onshore: 0,
};

export function findShelterFallback(
  targetSpot: SurfSpot,
  targetRec: BestWindowRecommendation | null,
  allSpots: SurfSpot[],
  forecasts: Record<string, SpotForecast>,
  dateKey: string,
  prefs?: Partial<SurferPreferences>,
  options?: { morningOnly?: boolean; includePastToday?: boolean }
): ShelterFallback | null {
  if (!targetRec) return null;

  const maxWind = prefs?.maxWindSpeed ?? 24;
  const maxWave = prefs?.maxWaveHeight ?? targetSpot.idealMaxWave;

  const isBadWind =
    targetRec.windQuality === 'onshore' ||
    (targetRec.windQuality === 'cross' && targetRec.avgWindSpeed > maxWind * 0.85) ||
    targetRec.avgWindSpeed > maxWind;
  const isTooBig =
    targetRec.fitStatus === 'challenging' ||
    targetRec.avgWaveHeight > Math.min(targetSpot.idealMaxWave, maxWave) + 0.25;
  const isLowScore = targetRec.avgScore < 6.0;
  const isActiveAlert = isBadWind || isTooBig || isLowScore;

  const nearbyCandidates: Array<{
    spot: SurfSpot;
    rec: BestWindowRecommendation;
    distanceKm: number;
    angleDiff: number;
    rankScore: number;
  }> = [];

  for (const candidate of allSpots) {
    if (candidate.id === targetSpot.id) continue;
    const distanceKm = haversineKm(targetSpot.lat, targetSpot.lng, candidate.lat, candidate.lng);
    if (distanceKm > 55) continue;

    const rec = findBestWindowForSpot(candidate, forecasts[candidate.id], dateKey, prefs, options);
    if (!rec) continue;

    const angleDiff = angularDifference(candidate.offshoreDeg, targetSpot.offshoreDeg);
    const windGain =
      WIND_QUALITY_RANK[rec.windQuality] - WIND_QUALITY_RANK[targetRec.windQuality];
    const scoreGain = rec.avgScore - targetRec.avgScore;

    // Require genuine shelter advantage when in active alert mode
    if (isActiveAlert) {
      const helpsWind = isBadWind && (windGain > 0 || angleDiff >= 35);
      const helpsSwell =
        isTooBig &&
        (rec.fitStatus !== 'challenging' ||
          candidate.idealMaxWave <= targetSpot.idealMaxWave ||
          angleDiff >= 35);
      const helpsScore = scoreGain >= 0.3;

      if (!helpsWind && !helpsSwell && !helpsScore) continue;
    }

    const orientationBonus = angleDiff >= 45 ? 1.35 : angleDiff >= 25 ? 0.6 : 0;
    const windBonus = windGain > 0 ? windGain * 0.9 : 0;
    const swellReliefBonus =
      isTooBig && rec.fitStatus !== 'challenging' ? 1.2 : 0;
    const proximityBonus = distanceKm <= 18 ? 0.9 : distanceKm <= 32 ? 0.45 : 0;

    const rankScore =
      rec.avgScore + orientationBonus + windBonus + swellReliefBonus + proximityBonus;

    nearbyCandidates.push({
      spot: candidate,
      rec,
      distanceKm,
      angleDiff,
      rankScore,
    });
  }

  if (nearbyCandidates.length === 0) return null;

  nearbyCandidates.sort((a, b) => b.rankScore - a.rankScore);
  const best = nearbyCandidates[0];

  let trigger: ShelterFallback['trigger'] = 'backup';
  let reason = `Repli le plus proche (${best.distanceKm} km) avec une orientation différente si le vent tourne.`;

  if (isBadWind) {
    trigger = 'wind';
    reason = `Vent ${windQualityLabelFr(targetRec.windQuality).toLowerCase()} (${targetRec.avgWindSpeed} km/h ${degreesToCompass(targetRec.windDirection)}) sur ${targetSpot.name} — ${best.spot.name} (${best.distanceKm} km) est mieux abrité (${windQualityLabelFr(best.rec.windQuality).toLowerCase()}, ${best.spot.idealTide.toLowerCase()}).`;
  } else if (isTooBig) {
    trigger = 'swell';
    reason = `Houle solide (${targetRec.avgWaveHeight.toFixed(1).replace('.', ',')} m) sur ${targetSpot.name} — basculez sur ${best.spot.name} (${best.distanceKm} km), repli plus doux calé sur ${best.spot.idealTide.toLowerCase()}.`;
  } else if (isLowScore) {
    trigger = 'score';
    reason = `Conditions moyennes sur ${targetSpot.name} — ${best.spot.name} à ${best.distanceKm} km offre un meilleur créneau (${best.rec.windowLabel}) et ${best.rec.avgScore.toFixed(1).replace('.', ',')}/10.`;
  }

  return {
    spot: best.spot,
    recommendation: best.rec,
    distanceKm: best.distanceKm,
    trigger,
    reason,
    isActiveAlert,
  };
}

// ============================================================================
// Verified Live Webcams Lookup (Honest Local Coverage + Windy GPS Cam Radar)
// ============================================================================
const DIRECT_WEBCAM_INFO: Record<
  string,
  { label: string; url: string; note: string; hasDirectBeachCam: boolean }
> = {
  'crozon-goulien': {
    label: 'Webcam HD Goulien (Skaping)',
    url: 'https://www.skaping.com/crozon/goulien',
    note: 'Caméra HD Skaping directement sur la plage de Goulien pour checker les séries et le vent.',
    hasDirectBeachCam: true,
  },
  'crozon-kersiguenou': {
    label: 'Webcam HD Goulien / Anse de Dinan',
    url: 'https://www.skaping.com/crozon/goulien',
    note: 'Même baie que Kersiguénou : la caméra HD Skaping de Goulien donne la lecture exacte de l’anse.',
    hasDirectBeachCam: true,
  },
  'crozon-la-palue': {
    label: 'Caméra proche : Goulien (Presqu’île)',
    url: 'https://www.skaping.com/crozon/goulien',
    note: 'Site naturel protégé sans caméra fixe sur la plage — croisez avec Goulien et le Check Parking du crew.',
    hasDirectBeachCam: false,
  },
  'crozon-lostmarch': {
    label: 'Caméra proche : Goulien (Presqu’île)',
    url: 'https://www.skaping.com/crozon/goulien',
    note: 'Plage sauvage sans caméra fixe — utilisez la vue proche de Goulien + le Check Parking sur place.',
    hasDirectBeachCam: false,
  },
  'crozon-morgat': {
    label: 'Webcams Crozon / Morgat (Viewsurf)',
    url: 'https://www.viewsurf.com/univers/surf',
    note: 'Flux panoramique Viewsurf sur la baie de Morgat pour vérifier la taille qui rentre en repli.',
    hasDirectBeachCam: true,
  },
  'crozon-aber': {
    label: 'Webcams Baie de Douarnenez',
    url: 'https://www.viewsurf.com/univers/surf',
    note: 'Pas de caméra fixe sur l’Aber — utilisez la carte des webcams locales autour de Morgat / Pentrez.',
    hasDirectBeachCam: false,
  },
  'la-torche': {
    label: 'Webcam Pointe de la Torche (Viewsurf)',
    url: 'https://www.viewsurf.com/univers/surf',
    note: 'Vue live sur la baie d’Audierne et la Pointe de la Torche avant de prendre la route.',
    hasDirectBeachCam: true,
  },
  'penmarch-pors-carn': {
    label: 'Webcam Pors Carn / La Torche',
    url: 'https://www.viewsurf.com/univers/surf',
    note: 'Vue directe sur le côté sud de la Pointe de la Torche et Pors Carn.',
    hasDirectBeachCam: true,
  },
  'plouzane-petit-minou': {
    label: 'Caméras Goulet de Brest / Iroise',
    url: 'https://www.viewsurf.com/univers/surf',
    note: 'Vérifiez le plan d’eau du Petit Minou et la rade de Brest avant d’enfiler la combi.',
    hasDirectBeachCam: true,
  },
  'conquet-blancs-sablons': {
    label: 'Caméras Pays d’Iroise / Le Conquet',
    url: 'https://www.viewsurf.com/univers/surf',
    note: 'Webcams côtières autour du Conquet et de l’entrée de la mer d’Iroise.',
    hasDirectBeachCam: true,
  },
};

export function getSpotWebcams(spot: SurfSpot): SpotWebcamInfo {
  const lat = spot.lat.toFixed(3);
  const lng = spot.lng.toFixed(3);
  const windyCamsUrl = `https://www.windy.com/-Webcams/webcams?${lat},${lng},12`;
  const windyWavesUrl = `https://www.windy.com/${lat}/${lng}?waves,${lat},${lng},11`;

  const known = DIRECT_WEBCAM_INFO[spot.id];
  if (known) {
    return {
      primaryUrl: known.hasDirectBeachCam ? known.url : windyCamsUrl,
      primaryLabel: known.hasDirectBeachCam ? known.label : 'Carte Webcams Live autour du spot',
      secondaryUrl: known.hasDirectBeachCam ? windyCamsUrl : known.url,
      secondaryLabel: known.hasDirectBeachCam ? 'Radar Webcams Windy' : known.label,
      note: known.note,
      hasDirectBeachCam: known.hasDirectBeachCam,
    };
  }

  return {
    primaryUrl: windyCamsUrl,
    primaryLabel: 'Voir les Webcams Live (Windy)',
    secondaryUrl: windyWavesUrl,
    secondaryLabel: 'Carte houle & vent live',
    note: `Affiche toutes les webcams côtières actives autour de ${spot.town} (${spot.name}) avant de partir.`,
    hasDirectBeachCam: false,
  };
}

export function formatReportAgeFr(report: ParkingReportRecord): string {
  let ms = report.localUpdatedAtMs ?? 0;
  if (
    report.updatedAt &&
    typeof report.updatedAt === 'object' &&
    'toMillis' in report.updatedAt
  ) {
    ms = (report.updatedAt as { toMillis: () => number }).toMillis();
  } else if (report.updatedAt instanceof Date) {
    ms = report.updatedAt.getTime();
  }

  if (!ms) return 'Aujourd’hui';
  const diffMin = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (diffMin < 2) return 'À l’instant';
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const dt = new Date(ms);
  const hh = String(dt.getHours()).padStart(2, '0');
  const mm = String(dt.getMinutes()).padStart(2, '0');
  if (report.dateKey === getLocalDateKey(0)) {
    return `Aujourd’hui à ${hh}h${mm}`;
  }
  return `${formatFrenchDateLabel(report.dateKey)} à ${hh}h${mm}`;
}

