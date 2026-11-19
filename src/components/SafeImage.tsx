import { useState } from "react";
import { Activity } from "lucide-react";

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  fallbackTitle?: string;
}

export function SafeImage({ src, alt, className = "", fallbackTitle }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#EFE8D5] via-[#F5EFE0] to-[#E6EEE7] text-[#3B5751] p-6 ${className}`}
        role="img"
        aria-label={alt}
      >
        <Activity className="w-8 h-8 text-[#16423C] mb-2" strokeWidth={1.75} />
        <span className="text-xs font-medium text-[#3B5751] text-center">
          {fallbackTitle || alt}
        </span>
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
