import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

const SortIcon = ({ col, sortCol, sortDir }) => {
  if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity" />;
  return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
};

const SortTh = ({ col, sortCol, sortDir, onSort, children, className = '' }) => (
  <th
    className={`py-3 px-3 font-semibold cursor-pointer select-none group hover:bg-muted/70 transition-colors ${className}`}
    onClick={() => onSort(col)}
  >
    <div className="flex items-center gap-1 justify-center">
      {children}
      <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
    </div>
  </th>
);

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

function ScoreCell({ value }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return <span className="font-semibold">{value.toFixed(1)}</span>;
}

export default function ScorecardLeaderboard({ rows, sortCol, sortDir, onSort, selectedPropertyId, onSelect }) {
  const withData = rows.filter(r => r.hasData).length;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-bold text-foreground">Hotel Leaderboard</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {withData} of {rows.length} hotels with data — click a row to view its full scorecard
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="py-3 px-3 text-left font-semibold w-10">Rank</th>
              <SortTh col="name" sortCol={sortCol} sortDir={sortDir} onSort={onSort} className="text-left">Hotel</SortTh>
              <SortTh col="gm" sortCol={sortCol} sortDir={sortDir} onSort={onSort} className="text-center">GM</SortTh>
              <SortTh col="gop" sortCol={sortCol} sortDir={sortDir} onSort={onSort} className="text-center">GOP /35</SortTh>
              <SortTh col="gopMargin" sortCol={sortCol} sortDir={sortDir} onSort={onSort} className="text-center">Margin /35</SortTh>
              <SortTh col="rgi" sortCol={sortCol} sortDir={sortDir} onSort={onSort} className="text-center">RGI /15</SortTh>
              <SortTh col="gss" sortCol={sortCol} sortDir={sortDir} onSort={onSort} className="text-center">GSS /15</SortTh>
              <SortTh col="total" sortCol={sortCol} sortDir={sortDir} onSort={onSort} className="text-center">Total</SortTh>
              <th className="py-3 px-3 text-center font-semibold">Forecast</th>
              <th className="py-3 px-3 text-center font-semibold">Red Zone</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                  No hotels match the current filters.
                </td>
              </tr>
            )}
            {rows.map((r, idx) => {
              const isSelected = r.property.id === selectedPropertyId;
              return (
                <tr
                  key={r.property.id}
                  className={`border-b border-border cursor-pointer transition-colors ${isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                  onClick={() => onSelect(r.property.id)}
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
                  <td className="py-3 px-3 text-center text-xs text-muted-foreground">{r.property.gm_name || '—'}</td>
                  {r.hasData ? (
                    <>
                      <td className="py-3 px-3 text-center text-sm"><ScoreCell value={r.gop} /></td>
                      <td className="py-3 px-3 text-center text-sm"><ScoreCell value={r.gopMargin} /></td>
                      <td className="py-3 px-3 text-center text-sm"><ScoreCell value={r.rgi} /></td>
                      <td className="py-3 px-3 text-center text-sm"><ScoreCell value={r.gss} /></td>
                      <td className="py-3 px-3 text-center">
                        <span className="font-black text-sm" style={{ color: scoreColor(r.total, r.maxPossible) }}>
                          {r.total != null ? `${r.total} / ${r.maxPossible}` : '—'}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}