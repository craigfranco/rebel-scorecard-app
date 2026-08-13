import React from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import PropertyScorecardDetail from '@/components/scorecard/PropertyScorecardDetail';
import LeadershipGroupSummary from './LeadershipGroupSummary';

function ScoreCell({ value }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return <span className="font-semibold">{value.toFixed(1)}</span>;
}

function scoreColor(total, maxPossible) {
  if (total == null || !maxPossible) return undefined;
  const pct = total / maxPossible;
  if (pct >= 0.7) return '#4CAF50';
  if (pct >= 0.5) return '#f59e0b';
  return '#ef4444';
}

function KickerPill({ state }) {
  if (state == null) return <span className="text-xs text-muted-foreground">—</span>;
  const hit = state === true;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
      style={{ backgroundColor: hit ? '#4CAF50' : '#ef4444' }}
    >
      {hit ? 'HIT' : 'MISS'}
    </span>
  );
}

function fmt$(val) {
  if (val == null) return '—';
  return '$' + Math.round(val).toLocaleString('en-US');
}

export default function LeadershipGroupCard({ groupName, roleLabel, entries, expandedId, onToggle }) {
  const sorted = [...entries].sort((a, b) => {
    const av = a.hasData ? (a.total ?? -1) : -1;
    const bv = b.hasData ? (b.total ?? -1) : -1;
    return bv - av;
  });

  const withData = entries.filter(r => r.hasData);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Group header */}
      <div className="px-6 py-4 border-b border-border flex flex-wrap items-center justify-between gap-4" style={{ background: 'linear-gradient(90deg, rgba(45,75,94,0.06), rgba(45,75,94,0))' }}>
        <div>
          <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-semibold">{roleLabel}</div>
          <div className="text-lg font-bold text-foreground">{groupName}</div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Hotels</span>
            <span className="text-sm font-bold text-foreground">{entries.length}{withData.length < entries.length ? ` · ${withData.length} w/ data` : ''}</span>
          </div>
        </div>
      </div>

      <LeadershipGroupSummary rows={entries} />

      {/* Hotels table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="py-2.5 px-3 text-left font-semibold w-10">Rank</th>
              <th className="py-2.5 px-3 text-left font-semibold">Hotel</th>
              <th className="py-2.5 px-3 text-center font-semibold">GOP /35</th>
              <th className="py-2.5 px-3 text-center font-semibold">Margin /35</th>
              <th className="py-2.5 px-3 text-center font-semibold">RGI /15</th>
              <th className="py-2.5 px-3 text-center font-semibold">GSS /15</th>
              <th className="py-2.5 px-3 text-center font-semibold">Total /100</th>
              <th className="py-2.5 px-3 text-center font-semibold">Forecast</th>
              <th className="py-2.5 px-3 text-center font-semibold">Red Zone</th>
              <th className="py-2.5 px-3 text-center font-semibold w-10"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => {
              const isExpanded = r.property.id === expandedId;
              return (
                <React.Fragment key={r.property.id}>
                  <tr
                    className={`border-t border-border cursor-pointer transition-colors ${isExpanded ? 'bg-primary/10' : 'hover:bg-muted/40'}`}
                    onClick={() => onToggle(isExpanded ? null : r.property.id)}
                  >
                    <td className="py-3 px-3">
                      <span className="text-xs font-bold text-muted-foreground w-7 h-7 rounded-full bg-white/70 border border-border flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-foreground text-sm">{r.property.name}</div>
                      <div className="text-xs text-muted-foreground">{r.property.city}, {r.property.state}</div>
                    </td>
                    {r.hasData ? (
                      <>
                        <td className="py-3 px-3 text-center text-sm"><ScoreCell value={r.gop} /></td>
                        <td className="py-3 px-3 text-center text-sm"><ScoreCell value={r.gopMargin} /></td>
                        <td className="py-3 px-3 text-center text-sm"><ScoreCell value={r.rgi} /></td>
                        <td className="py-3 px-3 text-center text-sm"><ScoreCell value={r.gss} /></td>
                        <td className="py-3 px-3 text-center">
                          <span className="font-black text-sm" style={{ color: scoreColor(r.total, r.maxPossible) }}>
                            {r.total != null ? r.total.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center"><KickerPill state={r.forecast} /></td>
                        <td className="py-3 px-3 text-center"><KickerPill state={r.redzone} /></td>
                      </>
                    ) : (
                      <td colSpan={7} className="py-3 px-3 text-center text-xs text-muted-foreground italic">
                        No data for this period
                      </td>
                    )}
                    <td className="py-3 px-3 text-center">
                      {r.hasData && (isExpanded
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground mx-auto" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground mx-auto" />)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={10} className="p-4 bg-muted/20">
                        <PropertyScorecardDetail property={r.property} showPropertySelector={false} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}