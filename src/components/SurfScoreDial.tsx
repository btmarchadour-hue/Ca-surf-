import { motion } from 'motion/react';
import { scoreLabelFr } from '../lib/surfEngine';

interface SurfScoreDialProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export function SurfScoreDial({
  score,
  size = 'lg',
  showLabel = true,
}: SurfScoreDialProps) {
  const clamped = Math.max(0, Math.min(10, score));
  const dims =
    size === 'lg'
      ? { box: 142, cls: 'w-[142px] h-[142px]', r: 58, stroke: 8, text: 'text-[44px]', sub: 'text-xs' }
      : size === 'md'
      ? { box: 108, cls: 'w-[108px] h-[108px]', r: 44, stroke: 6.5, text: 'text-3xl', sub: 'text-[11px]' }
      : { box: 72, cls: 'w-[72px] h-[72px]', r: 29, stroke: 5, text: 'text-xl', sub: 'text-[10px]' };

  const cx = dims.box / 2;
  const cy = dims.box / 2;
  // 260-degree sculptural open arc (from 140deg to 400deg)
  const arcFraction = 260 / 360;
  const circumference = 2 * Math.PI * dims.r;
  const trackLength = circumference * arcFraction;
  const fillLength = trackLength * (clamped / 10);

  const tone =
    clamped >= 7.5
      ? { start: '#2DD4BF', end: '#F7B955', text: 'text-[#2DD4BF]', verdict: 'Feu vert' }
      : clamped >= 5.5
      ? { start: '#F0A53A', end: '#F7C96B', text: 'text-[#F0A53A]', verdict: scoreLabelFr(clamped).label }
      : { start: '#FB7185', end: '#F0A53A', text: 'text-[#FB7185]', verdict: scoreLabelFr(clamped).label };

  const gradId = `surf-dial-${size}-${Math.round(clamped * 10)}`;

  return (
    <div className="relative inline-flex flex-col items-center justify-center shrink-0 select-none">
      <div
        className={`relative flex items-center justify-center rounded-full bg-[#060F16]/85 backdrop-blur-md border border-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_16px_36px_-12px_rgba(0,0,0,0.88)] ${dims.cls}`}
      >
        <svg
          width={dims.box}
          height={dims.box}
          viewBox={`0 0 ${dims.box} ${dims.box}`}
          className="block -rotate-[220deg]"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={tone.start} />
              <stop offset="100%" stopColor={tone.end} />
            </linearGradient>
          </defs>

          {/* Track arc */}
          <circle
            cx={cx}
            cy={cy}
            r={dims.r}
            fill="none"
            stroke="rgba(255,255,255,0.11)"
            strokeWidth={dims.stroke}
            strokeDasharray={`${trackLength} ${circumference}`}
            strokeLinecap="round"
          />

          {/* Progress arc */}
          <motion.circle
            cx={cx}
            cy={cy}
            r={dims.r}
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth={dims.stroke}
            strokeDasharray={`${trackLength} ${circumference}`}
            strokeLinecap="round"
            initial={{ strokeDashoffset: trackLength }}
            animate={{ strokeDashoffset: trackLength - fillLength }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
          <div className="flex items-baseline gap-0.5 leading-none">
            <span className={`font-display font-extrabold tabular-nums tracking-tight text-[#F3F7FA] ${dims.text}`}>
              {clamped.toFixed(1).replace('.', ',')}
            </span>
            <span className={`font-mono text-[#94ACB9] ${dims.sub}`}>/10</span>
          </div>
          {showLabel && (
            <span className={`mt-1 font-medium tracking-wide ${dims.sub} ${tone.text}`}>
              {tone.verdict}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
