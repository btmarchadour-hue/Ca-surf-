import { degreesToCompass, windQualityLabelFr } from '../lib/surfEngine';
import type { WindQuality } from '../types/surf';

interface WindSwellCompassProps {
  offshoreDeg: number;
  windDirDeg: number;
  windSpeedKmh: number;
  windQuality: WindQuality;
  swellDirDeg: number;
  swellHeightM: number;
  swellPeriodS: number;
}

export function WindSwellCompass({
  offshoreDeg,
  windDirDeg,
  windSpeedKmh,
  windQuality,
  swellDirDeg,
  swellHeightM,
  swellPeriodS,
}: WindSwellCompassProps) {
  const cx = 78;
  const cy = 78;
  const r = 56;

  const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
  const polar = (deg: number, radius: number) => ({
    x: cx + radius * Math.cos(toRad(deg)),
    y: cy + radius * Math.sin(toRad(deg)),
  });

  const offStart = polar(offshoreDeg - 45, r);
  const offEnd = polar(offshoreDeg + 45, r);
  const offshoreArcPath = `M ${cx} ${cy} L ${offStart.x.toFixed(1)} ${offStart.y.toFixed(
    1
  )} A ${r} ${r} 0 0 1 ${offEnd.x.toFixed(1)} ${offEnd.y.toFixed(1)} Z`;

  const windOrigin = polar(windDirDeg, r - 4);
  const windTip = polar(windDirDeg, 16);

  const swellOrigin = polar(swellDirDeg, r - 4);
  const swellTip = polar(swellDirDeg, 17);

  const windColor =
    windQuality === 'glassy' || windQuality === 'offshore'
      ? '#2DD4BF'
      : windQuality === 'cross'
      ? '#F0A53A'
      : '#FB7185';

  const windTextClass =
    windQuality === 'glassy' || windQuality === 'offshore'
      ? 'text-[#2DD4BF]'
      : windQuality === 'cross'
      ? 'text-[#F0A53A]'
      : 'text-[#FB7185]';

  const bezelTicks = Array.from({ length: 12 }, (_, i) => i * 30);

  return (
    <div className="flex items-center gap-5">
      <svg
        width="156"
        height="156"
        viewBox="0 0 156 156"
        className="shrink-0 drop-shadow-[0_10px_22px_rgba(0,0,0,0.6)]"
        aria-label="Rose des vents et de la houle"
      >
        <defs>
          <radialGradient id="compass-dial-bg" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#122736" />
            <stop offset="100%" stopColor="#060E15" />
          </radialGradient>
        </defs>

        {/* Outer metallic bezel */}
        <circle
          cx={cx}
          cy={cy}
          r={r + 5}
          fill="none"
          stroke="rgba(186,224,245,0.12)"
          strokeWidth="1"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="url(#compass-dial-bg)"
          stroke="rgba(186,224,245,0.22)"
          strokeWidth="1.2"
        />
        <circle
          cx={cx}
          cy={cy}
          r={r * 0.56}
          fill="none"
          stroke="rgba(186,224,245,0.1)"
          strokeDasharray="2 3"
        />

        {/* Degree bezel ticks */}
        {bezelTicks.map((deg) => {
          const p1 = polar(deg, r - 4);
          const p2 = polar(deg, r);
          return (
            <line
              key={deg}
              x1={p1.x}
              y1={p1.y}
              x2={p2.x}
              y2={p2.y}
              stroke={deg % 90 === 0 ? 'rgba(240,165,58,0.65)' : 'rgba(186,224,245,0.22)'}
              strokeWidth={deg % 90 === 0 ? '1.5' : '1'}
            />
          );
        })}

        {/* Offshore ideal sector wedge */}
        <path
          d={offshoreArcPath}
          fill="#2DD4BF"
          fillOpacity="0.2"
          stroke="#2DD4BF"
          strokeOpacity="0.35"
          strokeWidth="1"
        />

        {/* Cardinal letters */}
        <text x={cx} y={12} textAnchor="middle" className="fill-[#F0A53A] text-[10px] font-mono font-bold">
          N
        </text>
        <text x={146} y={cy + 3.5} textAnchor="middle" className="fill-[#94ACB9] text-[10px] font-mono">
          E
        </text>
        <text x={cx} y={152} textAnchor="middle" className="fill-[#94ACB9] text-[10px] font-mono">
          S
        </text>
        <text x={10} y={cy + 3.5} textAnchor="middle" className="fill-[#94ACB9] text-[10px] font-mono">
          O
        </text>

        {/* Swell vector */}
        <line
          x1={swellOrigin.x}
          y1={swellOrigin.y}
          x2={swellTip.x}
          y2={swellTip.y}
          stroke="#38BDF8"
          strokeWidth="3.2"
          strokeLinecap="round"
        />
        <circle cx={swellOrigin.x} cy={swellOrigin.y} r="4" fill="#38BDF8" stroke="#060E15" strokeWidth="1.2" />

        {/* Wind vector */}
        <line
          x1={windOrigin.x}
          y1={windOrigin.y}
          x2={windTip.x}
          y2={windTip.y}
          stroke={windColor}
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeDasharray="4 2.5"
        />
        <circle cx={windOrigin.x} cy={windOrigin.y} r="3.4" fill={windColor} stroke="#060E15" strokeWidth="1.2" />

        {/* Center coastal pin */}
        <circle cx={cx} cy={cy} r="4.2" fill="#F3F7FA" stroke="#060E15" strokeWidth="1.5" />
      </svg>

      <div className="space-y-3 text-sm min-w-0">
        <div>
          <div className="text-[11px] text-[#7D9BAC]">Houle dominante</div>
          <div className="font-mono tabular-nums font-semibold text-[#38BDF8]">
            {swellHeightM.toFixed(1).replace('.', ',')} m · {Math.round(swellPeriodS)} s ·{' '}
            {degreesToCompass(swellDirDeg)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#7D9BAC]">Vent mesuré</div>
          <div className={`font-mono tabular-nums font-semibold ${windTextClass}`}>
            {windSpeedKmh} km/h {degreesToCompass(windDirDeg)} · {windQualityLabelFr(windQuality)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-[#7D9BAC]">Secteur offshore idéal</div>
          <div className="font-mono tabular-nums text-xs text-[#CBD8E1]">
            {degreesToCompass(offshoreDeg)} ({offshoreDeg}°)
          </div>
        </div>
      </div>
    </div>
  );
}
