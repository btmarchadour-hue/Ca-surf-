import { useState } from 'react';
import { Compass } from 'lucide-react';
import { degreesToCompass } from '../lib/surfEngine';
import { toSafeHttpsUrl } from '../lib/validation';
import type { BreakType } from '../types/surf';

interface SpotImageProps {
  src?: string;
  alt: string;
  title?: string;
  lat?: number;
  lng?: number;
  offshoreDeg?: number;
  idealSwellDeg?: number;
  breakType?: BreakType;
  className?: string;
  /** Shows a subtle "Photo réelle · Wikimedia" attribution in top-left when a verified photo loads */
  showSourceTag?: boolean;
}

export function SpotImage({
  src,
  alt,
  title,
  lat,
  lng,
  offshoreDeg,
  idealSwellDeg,
  breakType,
  className = '',
  showSourceTag = false,
}: SpotImageProps) {
  const [failed, setFailed] = useState(false);

  const safeSrc = toSafeHttpsUrl(src);
  const hasValidPhoto = Boolean(safeSrc && !failed);

  if (!hasValidPhoto) {
    const cx = 160;
    const cy = 96;
    const r = 64;
    const toRad = (deg: number) => ((deg - 90) * Math.PI) / 180;
    const polar = (deg: number, radius: number) => ({
      x: cx + radius * Math.cos(toRad(deg)),
      y: cy + radius * Math.sin(toRad(deg)),
    });

    const hasOrientation = typeof offshoreDeg === 'number' && typeof idealSwellDeg === 'number';
    let offshoreArc = '';
    let swellStart = { x: cx, y: cy };
    let swellEnd = { x: cx, y: cy };

    if (hasOrientation) {
      const s1 = polar(offshoreDeg - 40, r);
      const s2 = polar(offshoreDeg + 40, r);
      offshoreArc = `M ${cx} ${cy} L ${s1.x.toFixed(1)} ${s1.y.toFixed(1)} A ${r} ${r} 0 0 1 ${s2.x.toFixed(
        1
      )} ${s2.y.toFixed(1)} Z`;
      swellStart = polar(idealSwellDeg, r + 10);
      swellEnd = polar(idealSwellDeg, 18);
    }

    const breakFr =
      breakType === 'reef'
        ? 'Reef break'
        : breakType === 'point'
        ? 'Point break'
        : breakType === 'beach'
        ? 'Beach break'
        : '';

    return (
      <div
        className={`relative overflow-hidden bg-[#071520] ${className}`}
        role="img"
        aria-label={alt}
      >
        {/* Nautical Bathymetric Contours & Grid */}
        <svg
          viewBox="0 0 320 192"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full opacity-90"
          aria-hidden="true"
        >
          <defs>
            <radialGradient id="nautical-depth" cx="72%" cy="32%" r="75%">
              <stop offset="0%" stopColor="#143A4E" />
              <stop offset="55%" stopColor="#0A1F2D" />
              <stop offset="100%" stopColor="#061018" />
            </radialGradient>
          </defs>
          <rect width="320" height="192" fill="url(#nautical-depth)" />

          {/* Subtle nautical coordinate grid */}
          <path
            d="M0 48 H320 M0 96 H320 M0 144 H320 M80 0 V192 M160 0 V192 M240 0 V192"
            stroke="rgba(186,224,245,0.06)"
            strokeWidth="1"
          />

          {/* Bathymetric coastal contour lines */}
          <path
            d="M-20 162 Q 70 112, 165 136 T 345 92"
            fill="none"
            stroke="rgba(45,212,191,0.14)"
            strokeWidth="1.2"
          />
          <path
            d="M-20 135 Q 80 86, 178 112 T 345 64"
            fill="none"
            stroke="rgba(56,189,248,0.13)"
            strokeWidth="1"
          />
          <path
            d="M-20 105 Q 92 56, 192 84 T 345 34"
            fill="none"
            stroke="rgba(186,224,245,0.08)"
            strokeWidth="1"
            strokeDasharray="4 4"
          />

          {/* True Spot Orientation Radar (real offshore & swell angles) */}
          {hasOrientation && (
            <g transform="translate(68, -4)">
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="rgba(6,16,24,0.45)"
                stroke="rgba(186,224,245,0.16)"
                strokeWidth="1"
              />
              <circle
                cx={cx}
                cy={cy}
                r={r * 0.55}
                fill="none"
                stroke="rgba(186,224,245,0.1)"
                strokeDasharray="2 3"
              />
              <path d={offshoreArc} fill="#2DD4BF" fillOpacity="0.2" stroke="#2DD4BF" strokeOpacity="0.4" />
              <line
                x1={swellStart.x}
                y1={swellStart.y}
                x2={swellEnd.x}
                y2={swellEnd.y}
                stroke="#38BDF8"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx={swellStart.x} cy={swellStart.y} r="3.5" fill="#38BDF8" />
              <circle cx={cx} cy={cy} r="3.5" fill="#F0A53A" />
              <text x={cx} y={cy - r - 5} textAnchor="middle" className="fill-[#8AA6B7] text-[9px] font-mono">
                N
              </text>
            </g>
          )}
        </svg>

        {/* Honest Top Metadata Strip (real GPS & orientation — no invented photo) */}
        <div className="relative z-10 p-3.5 sm:p-4 flex items-start justify-between gap-2 text-[11px] font-mono tabular-nums text-[#8AA6B7]">
          <div className="inline-flex items-center gap-1.5 text-[#7D9BAC]">
            <Compass className="w-3.5 h-3.5 text-[#2DD4BF] shrink-0" />
            <span>
              {typeof lat === 'number' && typeof lng === 'number'
                ? `${lat.toFixed(3)}°N · ${Math.abs(lng).toFixed(3)}°${lng < 0 ? 'O' : 'E'}`
                : title || 'Carte d’orientation'}
            </span>
          </div>
          {hasOrientation && (
            <span className="text-[#94ACB9] text-right">
              Offshore {degreesToCompass(offshoreDeg)}
              {breakFr ? ` · ${breakFr}` : ''}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <img
        src={safeSrc ?? undefined}
        alt={alt}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
      {showSourceTag && (
        <span className="pointer-events-none absolute top-3 right-3 z-10 px-2 py-0.5 text-[10px] font-mono text-white/80 bg-[#060E15]/65 backdrop-blur-xs rounded">
          Photo réelle · Wikimedia
        </span>
      )}
    </div>
  );
}
