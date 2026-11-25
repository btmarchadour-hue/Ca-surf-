import { useMemo, useState } from 'react';
import {
  degreesToCompass,
  formatHourLabel,
  recommendWetsuitFr,
  scoreLabelFr,
  weatherLabelFr,
  windQualityLabelFr,
} from '../lib/surfEngine';
import type { BestWindowRecommendation, HourlySurfPoint } from '../types/surf';

interface HourlyForecastChartProps {
  points: HourlySurfPoint[];
  bestWindow: BestWindowRecommendation | null;
}

export function HourlyForecastChart({ points, bestWindow }: HourlyForecastChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(() => {
    if (bestWindow) {
      const idx = points.findIndex((p) => p.hour === bestWindow.startHour);
      if (idx >= 0) return idx;
    }
    const dayIdx = points.findIndex((p) => p.isDaylight);
    return dayIdx >= 0 ? dayIdx : 0;
  });

  const safeIndex = Math.min(selectedIndex, Math.max(0, points.length - 1));
  const activePoint = points[safeIndex];

  const maxWave = useMemo(() => {
    const peak = Math.max(...points.map((p) => p.waveHeight), 1.5);
    return Math.ceil(peak * 2) / 2;
  }, [points]);

  if (points.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-[#94ACB9]">
        Aucune donnée horaire disponible pour cette journée.
      </div>
    );
  }

  const chartHeight = 204;
  const colWidth = 36;
  const paddingLeft = 40;
  const paddingRight = 16;
  const paddingTop = 34;
  const paddingBottom = 44;
  const totalWidth = paddingLeft + points.length * colWidth + paddingRight;

  const yForWave = (h: number) => {
    const plotH = chartHeight - paddingTop - paddingBottom;
    return paddingTop + plotH - (Math.min(h, maxWave) / maxWave) * plotH;
  };

  const windColor = (q: HourlySurfPoint['windQuality']) => {
    if (q === 'glassy' || q === 'offshore') return '#2DD4BF';
    if (q === 'cross') return '#F0A53A';
    return '#FB7185';
  };

  const windToneText = (q: HourlySurfPoint['windQuality']) => {
    if (q === 'glassy' || q === 'offshore') return 'text-[#2DD4BF]';
    if (q === 'cross') return 'text-[#F0A53A]';
    return 'text-[#FB7185]';
  };

  const bestStartIdx = bestWindow
    ? points.findIndex((p) => p.hour === bestWindow.startHour)
    : -1;
  const bestEndIdx = bestWindow
    ? points.findIndex((p) => p.hour === bestWindow.endHour - 1)
    : -1;

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto pb-1">
        <svg
          width={totalWidth}
          height={chartHeight}
          viewBox={`0 0 ${totalWidth} ${chartHeight}`}
          className="block min-w-full"
          role="img"
          aria-label="Prévisions horaires de houle et de vent"
        >
          <defs>
            <linearGradient id="bar-best" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F9C968" />
              <stop offset="100%" stopColor="#D9831B" />
            </linearGradient>
            <linearGradient id="bar-day" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" />
              <stop offset="100%" stopColor="#1B5B73" />
            </linearGradient>
            <linearGradient id="bar-selected" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="100%" stopColor="#9EECE2" />
            </linearGradient>
            <linearGradient id="bar-night" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#284253" />
              <stop offset="100%" stopColor="#132531" />
            </linearGradient>
            <linearGradient id="best-window-bg" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F0A53A" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#F0A53A" stopOpacity="0.04" />
            </linearGradient>
          </defs>

          {[0, maxWave / 2, maxWave].map((val, i) => {
            const y = yForWave(val);
            return (
              <g key={i}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={totalWidth - paddingRight}
                  y2={y}
                  stroke={val === 0 ? 'rgba(186,224,245,0.16)' : 'rgba(186,224,245,0.08)'}
                  strokeDasharray={val === 0 ? undefined : '3 4'}
                />
                <text
                  x={paddingLeft - 9}
                  y={y + 3.5}
                  textAnchor="end"
                  className="fill-[#7593A4] text-[10px] font-mono tabular-nums"
                >
                  {val.toFixed(1)}m
                </text>
              </g>
            );
          })}

          {bestStartIdx >= 0 && bestEndIdx >= bestStartIdx && (
            <g>
              <rect
                x={paddingLeft + bestStartIdx * colWidth}
                y={paddingTop - 22}
                width={(bestEndIdx - bestStartIdx + 1) * colWidth}
                height={chartHeight - paddingTop - paddingBottom + 22}
                rx="10"
                fill="url(#best-window-bg)"
                stroke="#F0A53A"
                strokeOpacity="0.45"
                strokeWidth="1"
              />
              <text
                x={paddingLeft + bestStartIdx * colWidth + 8}
                y={paddingTop - 8}
                className="fill-[#F7C266] text-[10px] font-semibold tracking-wide"
              >
                {bestWindow && bestWindow.avgScore >= 6.0
                  ? 'Créneau feu vert'
                  : bestWindow && bestWindow.avgScore >= 4.2
                  ? 'Meilleur créneau'
                  : 'Créneau le moins plat'}
              </text>
            </g>
          )}

          {points.map((pt, idx) => {
            const xCenter = paddingLeft + idx * colWidth + colWidth / 2;
            const barTop = yForWave(pt.waveHeight);
            const barBottom = yForWave(0);
            const barHeight = Math.max(4, barBottom - barTop);
            const isSelected = idx === safeIndex;
            const isInBest =
              bestWindow !== null && pt.hour >= bestWindow.startHour && pt.hour < bestWindow.endHour;

            const fill = !pt.isDaylight
              ? 'url(#bar-night)'
              : isSelected
              ? 'url(#bar-selected)'
              : isInBest
              ? 'url(#bar-best)'
              : 'url(#bar-day)';

            return (
              <g
                key={pt.timeIso}
                onClick={() => setSelectedIndex(idx)}
                className="cursor-pointer group"
                role="button"
                tabIndex={0}
                aria-label={`${formatHourLabel(pt.hour)}, vagues ${pt.waveHeight} mètres, vent ${pt.windSpeed} km/h`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedIndex(idx);
                  }
                }}
              >
                <rect
                  x={paddingLeft + idx * colWidth}
                  y={paddingTop - 8}
                  width={colWidth}
                  height={chartHeight - paddingTop + 8}
                  fill="transparent"
                />

                {isSelected && (
                  <rect
                    x={paddingLeft + idx * colWidth + 2}
                    y={paddingTop - 2}
                    width={colWidth - 4}
                    height={barBottom - paddingTop + 2}
                    rx="7"
                    fill="rgba(255,255,255,0.08)"
                    stroke="rgba(255,255,255,0.22)"
                    strokeWidth="1"
                  />
                )}

                <rect
                  x={xCenter - 10}
                  y={barTop}
                  width={20}
                  height={barHeight}
                  rx="4.5"
                  fill={fill}
                  className="transition-opacity group-hover:opacity-90"
                />

                {isSelected && (
                  <text
                    x={xCenter}
                    y={Math.max(paddingTop + 6, barTop - 5)}
                    textAnchor="middle"
                    className="fill-[#F3F7FA] text-[10px] font-mono font-semibold tabular-nums"
                  >
                    {pt.waveHeight.toFixed(1)}
                  </text>
                )}

                <g
                  transform={`translate(${xCenter}, ${barBottom + 15}) rotate(${
                    (pt.windDirection + 180) % 360
                  })`}
                >
                  <path
                    d="M0 -5.5 L3.6 4.2 L0 2.2 L-3.6 4.2 Z"
                    fill={pt.isDaylight ? windColor(pt.windQuality) : '#445E6E'}
                  />
                </g>

                <text
                  x={xCenter}
                  y={barBottom + 34}
                  textAnchor="middle"
                  className={`text-[10px] font-mono tabular-nums ${
                    isSelected
                      ? 'fill-[#F3F7FA] font-bold'
                      : pt.isDaylight
                      ? 'fill-[#94ACB9]'
                      : 'fill-[#445E6E]'
                  }`}
                >
                  {String(pt.hour).padStart(2, '0')}h
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {activePoint && (
        <div className="rounded-xl bg-[#071119]/90 border border-white/10 p-4 grid grid-cols-2 sm:grid-cols-5 gap-4 text-sm shadow-[inset_0_2px_8px_rgba(0,0,0,0.4)]">
          <div>
            <div className="text-[11px] text-[#7D9BAC]">Heure inspectée</div>
            <div className="mt-1 font-display text-2xl font-bold tracking-tight tabular-nums text-[#F3F7FA] leading-none">
              {formatHourLabel(activePoint.hour)}
              <span className="ml-1.5 font-sans font-normal text-xs text-[#94ACB9]">
                {activePoint.isDaylight ? 'Jour' : 'Nuit'}
              </span>
            </div>
          </div>

          <div>
            <div className="text-[11px] text-[#7D9BAC]">Vagues & période</div>
            <div className="mt-1 font-mono tabular-nums font-semibold text-[#F3F7FA]">
              {activePoint.waveHeight.toFixed(1).replace('.', ',')} m ·{' '}
              {Math.round(activePoint.swellPeriod)} s
            </div>
            <div className="text-xs text-[#94ACB9] font-mono tabular-nums">
              Dir. {degreesToCompass(activePoint.swellDirection)} ({activePoint.swellDirection}°)
              {activePoint.offshoreWaveHeight - activePoint.waveHeight >= 0.35 && (
                <span className="text-[#F7C266]/90">
                  {' '}
                  · large {activePoint.offshoreWaveHeight.toFixed(1).replace('.', ',')} m
                </span>
              )}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-[#7D9BAC]">Vent & rafales</div>
            <div
              className={`mt-1 font-mono tabular-nums font-semibold ${windToneText(
                activePoint.windQuality
              )}`}
            >
              {activePoint.windSpeed} km/h {degreesToCompass(activePoint.windDirection)}
            </div>
            <div className="text-xs text-[#94ACB9]">
              {windQualityLabelFr(activePoint.windQuality)} · Raf. {activePoint.windGusts} km/h
            </div>
          </div>

          <div>
            <div className="text-[11px] text-[#7D9BAC]">Eau & combi</div>
            <div className="mt-1 font-mono tabular-nums font-semibold text-[#F3F7FA]">
              {activePoint.waterTemp !== null
                ? `${activePoint.waterTemp.toFixed(1).replace('.', ',')}°C eau`
                : `${activePoint.airTemp}°C air`}
            </div>
            <div className="text-xs text-[#94ACB9]">
              {activePoint.waterTemp !== null
                ? recommendWetsuitFr(activePoint.waterTemp)
                : weatherLabelFr(activePoint.weatherCode)}
            </div>
          </div>

          <div>
            <div className="text-[11px] text-[#7D9BAC]">Note horaire</div>
            <div className="mt-1 font-display text-2xl font-extrabold tabular-nums text-[#F0A53A] leading-none">
              {activePoint.score.toFixed(1).replace('.', ',')}
              <span className="text-xs font-mono font-normal text-[#94ACB9]">/10</span>
            </div>
            <div className="text-xs text-[#CBD8E1] mt-0.5">{scoreLabelFr(activePoint.score).label}</div>
          </div>
        </div>
      )}
    </div>
  );
}
