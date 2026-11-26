import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CalendarDays,
  Compass,
  Flame,
  MapPin,
  SlidersHorizontal,
  Waves,
  Wind,
} from 'lucide-react';
import {
  buildDailySpotForecast,
  degreesToCompass,
  formatFrenchDateLabel,
  formatShortDayHeader,
  getForecastDateKeys,
  haversineKm,
  scoreLabelFr,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type {
  ActiveTab,
  DailySpotForecast,
  SpotForecast,
  SurferPreferences,
  SurfSpot,
  UserLocation,
  WindQuality,
} from '../types/surf';

interface ForecastPlannerViewProps {
  allSpots: SurfSpot[];
  favoriteSpotIds: string[];
  forecasts: Record<string, SpotForecast>;
  loadingForecasts: boolean;
  surferPrefs: SurferPreferences;
  userLocation: UserLocation | null;
  radiusKm: number;
  onSelectSpot: (spotId: string, dateKey?: string) => void;
  onNavigateTab: (tab: ActiveTab) => void;
}

type ForecastScope = 'favorites' | 'nearby';

interface RankedDayEntry {
  spot: SurfSpot;
  daily: DailySpotForecast;
  distanceKm: number | null;
}

function scoreColorClass(score: number): string {
  if (score >= 7.5) return 'text-[#2DD4BF]';
  if (score >= 5.8) return 'text-[#F7C266]';
  if (score >= 4.2) return 'text-[#38BDF8]';
  return 'text-[#7D9BAC]';
}

function scoreBarHex(score: number): string {
  if (score >= 7.5) return '#2DD4BF';
  if (score >= 5.8) return '#F0A53A';
  if (score >= 4.2) return '#38BDF8';
  return '#476273';
}

function windQualityTextClass(q: WindQuality): string {
  if (q === 'glassy' || q === 'offshore') return 'text-[#2DD4BF]';
  if (q === 'cross') return 'text-[#F7C266]';
  return 'text-[#FB7185]';
}

export function ForecastPlannerView({
  allSpots,
  favoriteSpotIds,
  forecasts,
  loadingForecasts,
  surferPrefs,
  userLocation,
  radiusKm,
  onSelectSpot,
  onNavigateTab,
}: ForecastPlannerViewProps) {
  const dateKeys = useMemo(() => getForecastDateKeys(7), []);
  const [selectedDate, setSelectedDate] = useState<string>(dateKeys[0]);
  const [scope, setScope] = useState<ForecastScope>('favorites');
  const [chartSpotId, setChartSpotId] = useState<string>('');

  const favoriteSpots = useMemo(() => {
    const set = new Set(favoriteSpotIds);
    return allSpots.filter((s) => set.has(s.id));
  }, [allSpots, favoriteSpotIds]);

  const nearbyOrRegionSpots = useMemo(() => {
    if (userLocation) {
      const within = allSpots
        .map((spot) => ({
          spot,
          dist: haversineKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng),
        }))
        .filter((x) => x.dist <= radiusKm)
        .sort((a, b) => a.dist - b.dist)
        .map((x) => x.spot);
      if (within.length > 0) return within.slice(0, 18);
    }
    const regional = allSpots.filter((s) => s.region === surferPrefs.homeRegion);
    return regional.length > 0 ? regional : allSpots.slice(0, 12);
  }, [allSpots, userLocation, radiusKm, surferPrefs.homeRegion]);

  const activeSpots = useMemo(() => {
    if (scope === 'favorites' && favoriteSpots.length > 0) return favoriteSpots;
    return nearbyOrRegionSpots;
  }, [scope, favoriteSpots, nearbyOrRegionSpots]);

  // Build full 7-day matrix: dateKey -> ranked entries for activeSpots
  const matrixByDate = useMemo(() => {
    const map: Record<string, RankedDayEntry[]> = {};
    for (const dk of dateKeys) {
      const entries: RankedDayEntry[] = [];
      for (const spot of activeSpots) {
        const daily = buildDailySpotForecast(spot, forecasts[spot.id], dk, surferPrefs);
        if (!daily) continue;
        const distanceKm = userLocation
          ? haversineKm(userLocation.lat, userLocation.lng, spot.lat, spot.lng)
          : null;
        entries.push({ spot, daily, distanceKm });
      }
      entries.sort((a, b) => b.daily.recommendation.avgScore - a.daily.recommendation.avgScore);
      map[dk] = entries;
    }
    return map;
  }, [activeSpots, dateKeys, forecasts, surferPrefs, userLocation]);

  // Best single session across the entire 7-day horizon
  const bestOfWeek = useMemo(() => {
    let best: { dateKey: string; entry: RankedDayEntry } | null = null;
    for (const dk of dateKeys) {
      const top = matrixByDate[dk]?.[0];
      if (!top) continue;
      if (!best || top.daily.recommendation.avgScore > best.entry.daily.recommendation.avgScore) {
        best = { dateKey: dk, entry: top };
      }
    }
    return best;
  }, [dateKeys, matrixByDate]);

  // Keep chartSpotId valid inside activeSpots (default to best spot of the week)
  useEffect(() => {
    const stillValid = activeSpots.some((s) => s.id === chartSpotId);
    if (!stillValid) {
      setChartSpotId(bestOfWeek?.entry.spot.id ?? activeSpots[0]?.id ?? '');
    }
  }, [activeSpots, chartSpotId, bestOfWeek]);

  const focusedChartSpot = useMemo(
    () => activeSpots.find((s) => s.id === chartSpotId) ?? activeSpots[0] ?? null,
    [activeSpots, chartSpotId]
  );

  // Build 7-day trend points (Matin/Midi/Soir per day = up to 21 points) for the focused spot
  const chartData = useMemo(() => {
    if (!focusedChartSpot) return { days: [], maxWave: 2.5 };
    const days = dateKeys.map((dk) => {
      const daily = buildDailySpotForecast(
        focusedChartSpot,
        forecasts[focusedChartSpot.id],
        dk,
        surferPrefs
      );
      return { dateKey: dk, daily };
    });
    let maxWave = 2.0;
    for (const d of days) {
      if (!d.daily) continue;
      for (const p of d.daily.parts) {
        if (p.waveHeight > maxWave) maxWave = p.waveHeight;
      }
    }
    return { days, maxWave: Math.max(2.0, Number((maxWave * 1.18).toFixed(1))) };
  }, [focusedChartSpot, dateKeys, forecasts, surferPrefs]);

  const selectedDayEntries = matrixByDate[selectedDate] ?? [];
  const hasForecastData = Object.keys(forecasts).length > 0;

  // SVG chart geometry
  const svgW = 840;
  const svgH = 200;
  const padL = 38;
  const padR = 16;
  const padT = 24;
  const padB = 34;
  const innerW = svgW - padL - padR;
  const innerH = svgH - padT - padB;
  const dayColW = innerW / 7;

  const flatPoints = useMemo(() => {
    const pts: Array<{
      x: number;
      y: number;
      dateKey: string;
      partLabel: string;
      waveHeight: number;
      swellPeriod: number;
      score: number;
    }> = [];
    chartData.days.forEach((d, dayIdx) => {
      if (!d.daily) return;
      const parts = d.daily.parts;
      parts.forEach((part, pIdx) => {
        const subRatio = parts.length > 1 ? (pIdx + 0.5) / parts.length : 0.5;
        const x = padL + (dayIdx + subRatio) * dayColW;
        const y = padT + innerH - (part.waveHeight / chartData.maxWave) * innerH;
        pts.push({
          x,
          y,
          dateKey: d.dateKey,
          partLabel: part.label,
          waveHeight: part.waveHeight,
          swellPeriod: part.swellPeriod,
          score: part.score,
        });
      });
    });
    return pts;
  }, [chartData, dayColW, innerH]);

  const linePath = useMemo(() => {
    if (flatPoints.length === 0) return '';
    return flatPoints
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(' ');
  }, [flatPoints]);

  const areaPath = useMemo(() => {
    if (flatPoints.length === 0) return '';
    const baseY = padT + innerH;
    const first = flatPoints[0];
    const last = flatPoints[flatPoints.length - 1];
    return `${linePath} L ${last.x.toFixed(1)} ${baseY.toFixed(1)} L ${first.x.toFixed(1)} ${baseY.toFixed(1)} Z`;
  }, [flatPoints, linePath, innerH]);

  return (
    <div className="space-y-8">
      {/* Header + Scope Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium text-[#2DD4BF]">
            <CalendarDays className="w-3.5 h-3.5" />
            Planificateur multi-jours · Open-Meteo Marine
          </div>
          <h1 className="mt-1 font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#F8FBFE] leading-[0.98]">
            Prévisions sur 7 jours
          </h1>
          <p className="mt-1.5 text-sm text-[#8AA6B7]">
            Repérez les meilleures houles de la semaine, comparez Matin / Midi / Soir et ouvrez le
            détail horaire en un clic.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-[#071119] border border-white/10 rounded-xl self-start md:self-auto">
          <button
            type="button"
            onClick={() => setScope('favorites')}
            className={`px-3.5 py-2 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
              scope === 'favorites'
                ? 'surf-btn-primary font-semibold'
                : 'text-[#94ACB9] hover:text-[#F3F7FA] font-medium'
            }`}
          >
            Mes favoris ({favoriteSpots.length})
          </button>
          <button
            type="button"
            onClick={() => setScope('nearby')}
            className={`px-3.5 py-2 text-xs rounded-lg transition-all whitespace-nowrap shrink-0 ${
              scope === 'nearby'
                ? 'surf-btn-primary font-semibold'
                : 'text-[#94ACB9] hover:text-[#F3F7FA] font-medium'
            }`}
          >
            {userLocation ? `Autour (<${radiusKm} km)` : `Secteur ${surferPrefs.homeRegion}`}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loadingForecasts && !hasForecastData ? (
        <div className="surf-card rounded-3xl p-10 text-center space-y-3">
          <Waves className="w-7 h-7 text-[#2DD4BF] mx-auto animate-pulse" />
          <div className="text-sm font-medium text-[#F3F7FA]">
            Calcul des prévisions houle & vent sur 7 jours...
          </div>
          <p className="text-xs text-[#8AA6B7]">
            Synchronisation Open-Meteo Marine (168 heures par spot).
          </p>
        </div>
      ) : activeSpots.length === 0 ? (
        <div className="surf-card rounded-3xl p-10 text-center space-y-4">
          <p className="text-sm text-[#CBD8E1]">
            Ajoutez au moins un spot favori pour suivre vos prévisions sur 7 jours.
          </p>
          <button
            type="button"
            onClick={() => onNavigateTab('spots')}
            className="surf-btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold rounded-xl"
          >
            Choisir mes spots
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <>
          {/* Hero Banner — Meilleur créneau de la semaine */}
          {bestOfWeek && (
            <section className="surf-card-teal rounded-3xl p-6 sm:p-7 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
              <div className="space-y-2 min-w-0">
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#4AE8D1]">
                  <Flame className="w-3.5 h-3.5 text-[#F0A53A]" />
                  Meilleure session des 7 prochains jours ·{' '}
                  {formatFrenchDateLabel(bestOfWeek.dateKey)}
                </div>

                <div className="flex items-baseline gap-3.5 flex-wrap">
                  <h2 className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-[#F8FBFE] leading-none">
                    {bestOfWeek.entry.spot.town} — {bestOfWeek.entry.spot.name}
                  </h2>
                  <span
                    className={`font-display text-3xl font-extrabold tabular-nums leading-none ${scoreColorClass(
                      bestOfWeek.entry.daily.recommendation.avgScore
                    )}`}
                  >
                    {bestOfWeek.entry.daily.recommendation.avgScore.toFixed(1).replace('.', ',')}
                    <span className="text-base text-[#8AA6B7] font-semibold">/10</span>
                  </span>
                </div>

                <div className="flex items-center gap-x-5 gap-y-1.5 flex-wrap text-xs sm:text-sm text-[#D3E0E8]">
                  <span className="font-mono tabular-nums font-semibold text-[#F8FBFE]">
                    {bestOfWeek.entry.daily.recommendation.windowLabel}
                  </span>
                  <span className="font-mono tabular-nums text-[#38BDF8]">
                    {bestOfWeek.entry.daily.recommendation.avgWaveHeight
                      .toFixed(1)
                      .replace('.', ',')}{' '}
                    m · {bestOfWeek.entry.daily.recommendation.avgSwellPeriod} s
                  </span>
                  <span
                    className={`font-medium ${windQualityTextClass(
                      bestOfWeek.entry.daily.recommendation.windQuality
                    )}`}
                  >
                    Vent {windQualityLabelFr(bestOfWeek.entry.daily.recommendation.windQuality).toLowerCase()}{' '}
                    {bestOfWeek.entry.daily.recommendation.avgWindSpeed} km/h{' '}
                    {degreesToCompass(bestOfWeek.entry.daily.recommendation.windDirection)}
                  </span>
                  <span className="text-[#94ACB9]">
                    {
                      scoreLabelFr(
                        bestOfWeek.entry.daily.recommendation.avgScore,
                        bestOfWeek.entry.daily.recommendation.avgWaveHeight
                      ).label
                    }
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                {selectedDate !== bestOfWeek.dateKey && (
                  <button
                    type="button"
                    onClick={() => setSelectedDate(bestOfWeek.dateKey)}
                    className="surf-btn-glass px-4 py-2.5 text-xs font-medium text-[#F3F7FA] rounded-xl whitespace-nowrap shrink-0"
                  >
                    Comparer ce jour
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onSelectSpot(bestOfWeek.entry.spot.id, bestOfWeek.dateKey)}
                  className="surf-btn-primary inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0"
                >
                  Ouvrir le détail horaire
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </section>
          )}

          {/* Interactive 7-Day Strip */}
          <section aria-label="Calendrier 7 jours" className="space-y-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
                Vue semaine — choisissez un jour
              </h2>
              <span className="text-xs text-[#8AA6B7]">
                Score du meilleur spot pour chaque journée
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
              {dateKeys.map((dk) => {
                const header = formatShortDayHeader(dk);
                const top = matrixByDate[dk]?.[0];
                const isSelected = dk === selectedDate;
                const isBestDay = bestOfWeek?.dateKey === dk;
                const score = top?.daily.recommendation.avgScore ?? 0;

                return (
                  <button
                    key={dk}
                    type="button"
                    onClick={() => setSelectedDate(dk)}
                    className={`group text-left rounded-2xl p-3.5 transition-all border flex flex-col justify-between gap-2.5 ${
                      isSelected
                        ? 'bg-[#0F2433] border-[#2DD4BF]/70 shadow-[0_0_0_1px_rgba(45,212,191,0.35),0_14px_30px_-18px_rgba(45,212,191,0.55)]'
                        : 'bg-[#08131D]/90 border-white/10 hover:border-white/25 hover:bg-[#0B1A27]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div>
                        <div
                          className={`text-xs font-semibold ${
                            isSelected
                              ? 'text-[#4AE8D1]'
                              : header.isToday
                              ? 'text-[#F7C266]'
                              : 'text-[#F3F7FA]'
                          }`}
                        >
                          {header.weekday}
                        </div>
                        <div className="text-[11px] font-mono tabular-nums text-[#8AA6B7]">
                          {header.dayNum}
                        </div>
                      </div>
                      {isBestDay && (
                        <Flame
                          className="w-3.5 h-3.5 text-[#F0A53A] shrink-0"
                          aria-label="Meilleur jour"
                        />
                      )}
                    </div>

                    {top ? (
                      <>
                        <div className="flex items-baseline justify-between gap-1">
                          <span
                            className={`font-display text-3xl font-extrabold tabular-nums leading-none ${scoreColorClass(
                              score
                            )}`}
                          >
                            {score.toFixed(1).replace('.', ',')}
                          </span>
                          <span className="font-mono tabular-nums text-xs text-[#38BDF8]">
                            {top.daily.recommendation.avgWaveHeight.toFixed(1).replace('.', ',')}m
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          <div className="h-1.5 w-full rounded-full bg-white/8 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(100, Math.max(8, score * 10))}%`,
                                backgroundColor: scoreBarHex(score),
                              }}
                            />
                          </div>
                          <div className="flex items-center justify-between gap-1 text-[11px]">
                            <span className="truncate text-[#CBD8E1] font-medium">
                              {top.spot.name}
                            </span>
                            <span
                              className={`shrink-0 font-mono tabular-nums ${windQualityTextClass(
                                top.daily.recommendation.windQuality
                              )}`}
                            >
                              {top.daily.recommendation.avgSwellPeriod}s
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-xs text-[#6D8796] py-3">—</div>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 7-Day Swell & Surfability Trend Chart for Focused Spot */}
          {focusedChartSpot && flatPoints.length > 0 && (
            <section className="surf-card rounded-3xl p-5 sm:p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-[#8AA6B7]">
                    Courbe de houle (Matin / Midi / Soir) & qualité de session
                  </div>
                  <h2 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE]">
                    Évolution sur 7 jours — {focusedChartSpot.town} ({focusedChartSpot.name})
                  </h2>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                  <label className="sr-only" htmlFor="forecast-spot-select">
                    Spot affiché sur la courbe 7 jours
                  </label>
                  <div className="inline-flex items-center gap-2 bg-[#071119] border border-white/12 rounded-xl px-3 py-1.5">
                    <SlidersHorizontal className="w-3.5 h-3.5 text-[#2DD4BF] shrink-0" />
                    <select
                      id="forecast-spot-select"
                      value={focusedChartSpot.id}
                      onChange={(e) => setChartSpotId(e.target.value)}
                      className="bg-transparent text-xs font-medium text-[#F3F7FA] focus:outline-none pr-1"
                    >
                      {activeSpots.map((s) => (
                        <option key={s.id} value={s.id} className="bg-[#08131D] text-[#F3F7FA]">
                          {s.town} — {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${svgW} ${svgH}`}
                  className="w-full min-w-[580px] h-auto select-none"
                  role="img"
                  aria-label={`Évolution de la houle sur 7 jours à ${focusedChartSpot.name}`}
                >
                  <defs>
                    <linearGradient id="swellAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.34" />
                      <stop offset="100%" stopColor="#38BDF8" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {/* Clickable Day Columns + Highlight */}
                  {dateKeys.map((dk, idx) => {
                    const x = padL + idx * dayColW;
                    const isSel = dk === selectedDate;
                    const header = formatShortDayHeader(dk);
                    return (
                      <g
                        key={dk}
                        onClick={() => setSelectedDate(dk)}
                        className="cursor-pointer"
                      >
                        <rect
                          x={x}
                          y={padT - 8}
                          width={dayColW}
                          height={innerH + 14}
                          rx={8}
                          fill={isSel ? 'rgba(45, 212, 191, 0.10)' : 'transparent'}
                          stroke={isSel ? 'rgba(45, 212, 191, 0.35)' : 'rgba(255,255,255,0.04)'}
                          strokeWidth={1}
                        />
                        <text
                          x={x + dayColW / 2}
                          y={svgH - 12}
                          textAnchor="middle"
                          fontSize="11"
                          fontWeight={isSel ? 700 : 500}
                          fill={isSel ? '#4AE8D1' : '#8AA6B7'}
                        >
                          {header.weekday} {header.dayNum.split(' ')[0]}
                        </text>
                      </g>
                    );
                  })}

                  {/* Horizontal Y-Axis Gridlines */}
                  {[0, 0.5, 1].map((ratio) => {
                    const val = Number((chartData.maxWave * ratio).toFixed(1));
                    const y = padT + innerH - ratio * innerH;
                    return (
                      <g key={ratio}>
                        <line
                          x1={padL}
                          x2={svgW - padR}
                          y1={y}
                          y2={y}
                          stroke="rgba(255,255,255,0.08)"
                          strokeDasharray={ratio === 0 ? undefined : '3 4'}
                        />
                        <text
                          x={padL - 8}
                          y={y + 4}
                          textAnchor="end"
                          fontSize="10"
                          fill="#6D8796"
                          fontFamily="monospace"
                        >
                          {val.toFixed(1).replace('.', ',')}m
                        </text>
                      </g>
                    );
                  })}

                  {/* Swell Area & Line */}
                  {areaPath && <path d={areaPath} fill="url(#swellAreaGrad)" />}
                  {linePath && (
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth={2.2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Data Points Colored by Surfability Score */}
                  {flatPoints.map((pt, idx) => (
                    <g
                      key={`${pt.dateKey}-${pt.partLabel}-${idx}`}
                      onClick={() => setSelectedDate(pt.dateKey)}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={pt.dateKey === selectedDate ? 5 : 3.6}
                        fill={scoreBarHex(pt.score)}
                        stroke="#060D13"
                        strokeWidth={1.6}
                      >
                        <title>
                          {formatFrenchDateLabel(pt.dateKey)} · {pt.partLabel} :{' '}
                          {pt.waveHeight.toFixed(1).replace('.', ',')} m ({pt.swellPeriod} s) · Note{' '}
                          {pt.score.toFixed(1).replace('.', ',')}/10
                        </title>
                      </circle>
                    </g>
                  ))}
                </svg>
              </div>

              <div className="flex items-center justify-between gap-4 flex-wrap text-[11px] text-[#8AA6B7] pt-1 border-t border-white/8">
                <div className="flex items-center gap-4 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#2DD4BF]" />
                    Feu vert (≥ 7,5)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#F0A53A]" />
                    Bon (5,8 – 7,4)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#38BDF8]" />
                    Surfable (4,2 – 5,7)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#476273]" />
                    Mou / Agité
                  </span>
                </div>
                <span className="text-[#94ACB9]">
                  Cliquez sur une colonne pour basculer le comparatif ci-dessous
                </span>
              </div>
            </section>
          )}

          {/* Selected Day Comparative Matrix — Matin / Midi / Soir */}
          <section className="space-y-4">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-xs font-medium text-[#F7C266]">
                  Comparatif détaillé · Matin (7h–11h) · Midi (12h–15h) · Soir (16h–20h)
                </div>
                <h2 className="mt-0.5 font-display text-3xl font-extrabold tracking-tight text-[#F8FBFE]">
                  {formatFrenchDateLabel(selectedDate)}
                </h2>
              </div>
              <div className="text-xs font-mono tabular-nums text-[#8AA6B7]">
                {selectedDayEntries.length}{' '}
                {selectedDayEntries.length > 1 ? 'spots classés' : 'spot classé'}
              </div>
            </div>

            <div className="space-y-3">
              {selectedDayEntries.map((entry, idx) => {
                const { spot, daily, distanceKm } = entry;
                const rec = daily.recommendation;
                const status = scoreLabelFr(rec.avgScore, rec.avgWaveHeight);

                return (
                  <article
                    key={spot.id}
                    className={`rounded-2xl p-4 sm:p-5 transition-colors border ${
                      idx === 0
                        ? 'bg-[#0A1B27] border-[#2DD4BF]/35'
                        : 'bg-[#08131D]/90 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
                      {/* Spot Identity & Best 3h Window */}
                      <div className="lg:col-span-4 space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 text-xs text-[#8AA6B7]">
                          <span className="font-mono tabular-nums font-semibold text-[#F7C266]">
                            #{idx + 1}
                          </span>
                          <span className="truncate">{spot.region}</span>
                          {distanceKm !== null && (
                            <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#94ACB9] shrink-0">
                              <MapPin className="w-3 h-3 text-[#2DD4BF]" />
                              {distanceKm} km
                            </span>
                          )}
                        </div>

                        <div className="flex items-baseline justify-between lg:justify-start gap-3">
                          <h3 className="font-display text-2xl font-extrabold tracking-tight text-[#F8FBFE] truncate">
                            {spot.town} — {spot.name}
                          </h3>
                          <span
                            className={`font-display text-2xl font-extrabold tabular-nums shrink-0 ${scoreColorClass(
                              rec.avgScore
                            )}`}
                          >
                            {rec.avgScore.toFixed(1).replace('.', ',')}
                            <span className="text-xs text-[#7D9BAC]">/10</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-3 flex-wrap text-xs">
                          <span className="font-mono tabular-nums text-[#F3F7FA] font-medium">
                            Créneau top : {rec.windowLabel}
                          </span>
                          <span className="text-[#8AA6B7]">· {status.label}</span>
                        </div>
                      </div>

                      {/* Matin / Midi / Soir 3-Column Strip */}
                      <div className="lg:col-span-6 grid grid-cols-3 gap-2">
                        {daily.parts.map((part) => (
                          <div
                            key={part.label}
                            className="rounded-xl bg-[#060E15]/85 border border-white/8 px-3 py-2.5 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-semibold text-[#94ACB9]">
                                {part.label}
                              </span>
                              <span
                                className={`font-mono tabular-nums text-xs font-bold ${scoreColorClass(
                                  part.score
                                )}`}
                              >
                                {part.score.toFixed(1).replace('.', ',')}
                              </span>
                            </div>

                            <div className="flex items-baseline gap-1.5 font-mono tabular-nums text-xs text-[#38BDF8] font-semibold">
                              <span>{part.waveHeight.toFixed(1).replace('.', ',')} m</span>
                              <span className="text-[11px] text-[#8AA6B7] font-normal">
                                {part.swellPeriod}s
                              </span>
                            </div>

                            <div className="flex items-center justify-between gap-1 text-[11px]">
                              <span className="inline-flex items-center gap-1 font-mono tabular-nums text-[#CBD8E1] truncate">
                                <Wind className="w-3 h-3 text-[#6D8796] shrink-0" />
                                {part.windSpeed} {degreesToCompass(part.windDirection)}
                              </span>
                              <span
                                className={`font-medium shrink-0 ${windQualityTextClass(
                                  part.windQuality
                                )}`}
                              >
                                {part.windQuality === 'cross'
                                  ? 'Cross'
                                  : windQualityLabelFr(part.windQuality)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Action CTA */}
                      <div className="lg:col-span-2 flex lg:flex-col items-center lg:items-end justify-between gap-2">
                        <div className="inline-flex items-center gap-1 text-[11px] text-[#8AA6B7]">
                          <Compass className="w-3 h-3 text-[#2DD4BF]" />
                          {spot.idealTide}
                        </div>
                        <button
                          type="button"
                          onClick={() => onSelectSpot(spot.id, selectedDate)}
                          className="surf-btn-glass inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F3F7FA] hover:text-[#4AE8D1] rounded-xl whitespace-nowrap shrink-0"
                        >
                          Détail horaire
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
