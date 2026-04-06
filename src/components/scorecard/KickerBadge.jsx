import React from 'react';
import { Zap, Shield } from 'lucide-react';

export default function KickerBadge({ type, hit }) {
  const color = hit ? '#4CAF50' : '#94a3b8';
  const bg = hit ? '#f0fdf4' : '#f8fafc';
  const border = hit ? '#bbf7d0' : '#e2e8f0';

  const labels = {
    forecast: { icon: Zap, title: 'Forecast Kicker', desc: '+3% salary if 3/4 forecasts within ±3%' },
    redzone: { icon: Shield, title: 'Red Zone Kicker', desc: '+25% GSS payout if exits Red Zone' },
  };

  const { icon: Icon, title, desc } = labels[type];

  return (
    <div
      className="flex items-start gap-3 p-3 rounded-xl border transition-all"
      style={{ backgroundColor: bg, borderColor: border }}
    >
      <div className="p-2 rounded-lg" style={{ backgroundColor: hit ? '#dcfce7' : '#f1f5f9' }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{title}</span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-bold text-white shrink-0"
            style={{ backgroundColor: color }}
          >
            {hit ? 'HIT' : 'MISS'}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}