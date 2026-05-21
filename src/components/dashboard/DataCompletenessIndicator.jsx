import React from 'react';
import { Database } from 'lucide-react';

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function DataCompletenessIndicator({ properties, allEntries, getPeriodMonths, selectedYear }) {
  const periodMonths = getPeriodMonths();

  // Find latest updated_date across all entries
  let lastUpdated = null;
  allEntries.forEach(e => {
    if (e.updated_date) {
      const d = new Date(e.updated_date);
      if (!lastUpdated || d > lastUpdated) lastUpdated = d;
    }
  });

  // Per-month completeness
  const monthStats = periodMonths.map(month => {
    let withGop = 0, withRpi = 0, withGss = 0, total = 0;
    properties.forEach(prop => {
      const e = allEntries.find(en => en.property_id === prop.id && en.month === month && en.year === selectedYear);
      total++;
      if (e?.budgeted_gop_actual != null) withGop++;
      if (e?.revpar_index != null) withRpi++;
      if (e?.gss_actual != null) withGss++;
    });
    const missing = total - Math.min(withGop, withRpi, withGss);
    const complete = withGop === total && withRpi === total && withGss === total;
    const partial = !complete && (withGop > 0 || withRpi > 0 || withGss > 0);
    const missing_list = [
      withGop < total && `GOP (${total - withGop} missing)`,
      withRpi < total && `RPI (${total - withRpi} missing)`,
      withGss < total && `GSS (${total - withGss} missing)`,
    ].filter(Boolean);
    return { month, complete, partial, missing, missing_list, withGop, withRpi, withGss, total };
  });

  const missingNow = monthStats.reduce((s, m) => s + m.missing, 0);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-primary" />
          <h2 className="font-bold text-foreground">Data Completeness</h2>
        </div>
        <div className="flex items-center gap-4">
          {missingNow > 0 && (
            <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
              {missingNow} hotel-months missing
            </span>
          )}
          {lastUpdated && (
            <span className="text-[10px] text-muted-foreground">
              Last updated: {lastUpdated.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <div className="px-6 py-4">
        {monthStats.length === 0 ? (
          <p className="text-sm text-muted-foreground">No months in selected period.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {monthStats.map(({ month, complete, partial, missing_list }) => {
              const label = MONTH_NAMES[month - 1];
              return (
                <div
                  key={month}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium"
                  style={{
                    backgroundColor: complete ? '#dcfce7' : partial ? '#fef3c7' : '#fee2e2',
                    borderColor: complete ? '#bbf7d0' : partial ? '#fde68a' : '#fecaca',
                    color: complete ? '#15803d' : partial ? '#92400e' : '#dc2626',
                  }}
                  title={missing_list.length ? missing_list.join(', ') : 'All data loaded'}
                >
                  <span className="font-bold">{label}</span>
                  {complete ? (
                    <span className="text-[10px] opacity-70">Complete</span>
                  ) : (
                    <span className="text-[10px] opacity-80">{missing_list.join(' · ')}</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}