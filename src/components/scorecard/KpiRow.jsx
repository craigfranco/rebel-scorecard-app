import React, { useEffect, useState } from 'react';

export default function KpiRow({ measure, weight, target, actual, ytdActual, score, maxScore, pass, incomplete, gopActual, gopBudget }) {
  const [barWidth, setBarWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setBarWidth(incomplete ? 0 : (score / maxScore) * 100), 200);
    return () => clearTimeout(timer);
  }, [score, maxScore, incomplete]);

  const activeColor = pass ? '#4CAF50' : '#ef4444';
  const barColor = incomplete ? '#cbd5e1' : activeColor;
  const scoreColor = incomplete ? '#94a3b8' : activeColor;

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors">
      <td className="py-3 px-4 font-medium text-sm text-foreground">{measure}</td>
      <td className="py-3 px-4 text-center text-sm text-muted-foreground font-medium">{weight}</td>
      <td className="py-3 px-4 text-center text-sm text-muted-foreground">{target}</td>
      <td className="py-3 px-4 text-center text-sm font-semibold">
        {gopActual != null ? (
          <span className="font-bold text-foreground">${Math.round(gopActual).toLocaleString('en-US')}</span>
        ) : (actual ?? '—')}
      </td>
      <td className="py-3 px-4 text-center text-sm">
        {(gopActual != null && gopBudget != null) ? (
          (() => {
            const variance = gopActual - gopBudget;
            const pass = gopActual > gopBudget;
            const color = pass ? '#4CAF50' : '#ef4444';
            if (gopBudget > 0) {
              const pct = (gopActual / gopBudget) * 100;
              return <span className="font-bold" style={{ color }}>{pct.toFixed(1)}% of budget</span>;
            }
            // Negative budget: show dollar variance instead
            const abs = Math.abs(Math.round(variance)).toLocaleString('en-US');
            return (
              <span className="font-bold" style={{ color }}>
                {pass ? `Beat budget by $${abs}` : `Missed budget by $${abs}`}
              </span>
            );
          })()
        ) : (ytdActual ?? '—')}
      </td>
      <td className="py-3 px-4 text-center min-w-[140px]">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${barWidth}%`, backgroundColor: barColor }}
            />
          </div>
          <span className="text-sm font-bold w-12 text-right" style={{ color: scoreColor }}>
            {incomplete ? '—' : score.toFixed(1)}
          </span>
        </div>
      </td>
      <td className="py-3 px-4 text-center">
        {incomplete ? (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
            N/A
          </span>
        ) : (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
            style={{ backgroundColor: activeColor }}
          >
            {pass ? 'PASS' : 'FAIL'}
          </span>
        )}
      </td>
    </tr>
  );
}