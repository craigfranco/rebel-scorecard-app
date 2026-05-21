import React from 'react';
import { Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBrandColor } from '@/lib/portfolioHelpers';

export default function ForecastKickerTracker({ properties, allEntries, getPeriodMonths, selectedYear }) {
  const periodMonths = getPeriodMonths();

  const rows = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    const latest = propEntries[propEntries.length - 1];
    const hit = latest?.forecast_kicker === true;
    return { prop, hit, hasData: !!latest };
  }).filter(r => r.hasData);

  const hitCount = rows.filter(r => r.hit).length;
  const total = rows.length;
  const pct = total > 0 ? (hitCount / total) * 100 : 0;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <Zap className="w-4 h-4 text-yellow-500" />
        <h2 className="font-bold text-foreground">Forecast Kicker Tracker</h2>
        <span className="ml-auto text-xs text-muted-foreground">+3% salary bonus if 3/4 quarterly forecasts within ±3%</span>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-semibold text-foreground">{hitCount} of {total} hotels on track</span>
            <span className="text-sm font-bold" style={{ color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626' }}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-3 rounded-full transition-all duration-700"
              style={{
                width: `${pct}%`,
                backgroundColor: pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444',
              }}
            />
          </div>
        </div>

        {/* Hotel list split into two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {rows.map(({ prop, hit }) => {
            const brandColor = getBrandColor(prop.parent_brand);
            return (
              <div key={prop.id} className="flex items-center gap-2 py-1">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
                <Link to={`/hotel/${prop.id}`} className="text-xs text-foreground hover:underline truncate flex-1">
                  {prop.name}
                </Link>
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{
                    backgroundColor: hit ? '#dcfce7' : '#fee2e2',
                    color: hit ? '#15803d' : '#dc2626',
                  }}
                >
                  {hit ? 'ON TRACK' : 'MISSED'}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}