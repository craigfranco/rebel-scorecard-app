import React, { useEffect, useState } from 'react';

export default function KpiRow({ measure, weight, target, actual, ytdActual, score, maxScore, pass }) {
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setBarWidth((score / maxScore) * 100), 200);
    return () => clearTimeout(timer);
  }, [score, maxScore]);

  const passColor = pass ? '#4CAF50' : '#ef4444';

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 font-medium text-sm text-foreground">{measure}</td>
      <td className="py-3 px-4 text-center text-sm text-muted-foreground font-medium">{weight}</td>
      <td className="py-3 px-4 text-center text-sm text-muted-foreground">{target}</td>
      <td className="py-3 px-4 text-center text-sm font-semibold">{actual ?? '—'}</td>
      <td className="py-3 px-4 text-center text-sm">{ytdActual ?? '—'}</td>
      <td className="py-3 px-4 text-center min-w-[140px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${barWidth}%`, backgroundColor: passColor }}
            />
          </div>
          <span className="text-sm font-bold w-12 text-right" style={{ color: passColor }}>
            {score.toFixed(1)}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        <span
          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: passColor }}
        >
          {pass ? 'PASS' : 'FAIL'}
        </span>
      </td>
    </tr>
  );
}