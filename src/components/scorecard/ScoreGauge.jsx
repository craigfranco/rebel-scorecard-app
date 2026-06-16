import React, { useEffect, useState } from 'react';

export default function ScoreGauge({ score, maxPossible = 100, gssIncomplete = false }) {
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const pct = maxPossible > 0 ? animated / maxPossible : 0;
  const offset = circumference - pct * circumference;
  const color = '#2d4b5e';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-40 h-40">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="60" cy="60" r={radius}
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1.2s ease-out' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black" style={{ color }}>{Math.round(score)}</span>
          <span className="text-xs text-muted-foreground font-medium">/ {maxPossible}</span>
          {gssIncomplete && <span className="text-[9px] text-muted-foreground mt-0.5">GSS N/A</span>}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Points earned</p>
    </div>
  );
}