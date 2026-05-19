import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function KpiTile({ title, value, subtitle, delta, deltaType = 'neutral', Icon }) {
  const deltaConfig = {
    positive: { color: '#4CAF50', icon: TrendingUp },
    negative: { color: '#ef4444', icon: TrendingDown },
    neutral: { color: '#94a3b8', icon: Minus },
  };

  const config = deltaConfig[deltaType];
  const DeltaIcon = config.icon;

  return (
    <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
      <div className="flex items-start justify-between mb-3">
        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{title}</div>
        {Icon && (
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${config.color}18` }}>
            <Icon className="w-4 h-4" style={{ color: config.color }} />
          </div>
        )}
      </div>
      <div className="text-3xl font-black text-foreground mb-1">{value}</div>
      {subtitle && <div className="text-xs text-muted-foreground mb-2">{subtitle}</div>}
      {delta !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-bold ${
          deltaType === 'positive' ? 'text-pass' : deltaType === 'negative' ? 'text-fail' : 'text-muted-foreground'
        }`}>
          <DeltaIcon className="w-3 h-3" />
          <span>{delta}</span>
        </div>
      )}
    </div>
  );
}