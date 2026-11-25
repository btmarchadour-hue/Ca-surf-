import { useState } from 'react';
import { Waves } from 'lucide-react';

interface SpotImageProps {
  src: string;
  alt: string;
  title?: string;
  className?: string;
}

export function SpotImage({ src, alt, title, className = '' }: SpotImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#0F2C3F] via-[#15445E] to-[#1D5B77] text-white/85 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Waves className="w-7 h-7 mb-2 opacity-75" />
        {title && <span className="text-xs font-medium tracking-wide">{title}</span>}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
