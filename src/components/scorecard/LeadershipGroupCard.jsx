import React, { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import PropertyScorecardDetail from '@/components/scorecard/PropertyScorecardDetail';
import LeadershipGroupSummary from './LeadershipGroupSummary';
import OperatorSummarySection from './OperatorSummarySection';
import { isRedZoneApplicable } from '@/lib/redZone';

const SORT_COLS = [
  { key: 'name', label: 'Hotel', align: 'left' },
  { key: 'gop', label: 'GOP /35', align: 'center' },
  { key: 'gopMargin', label: 'Margin /35', align: 'center' },
  { key: 'rgi', label: 'RGI /15', align: 'center' },
  { key: 'gss', label: 'GSS /15', align: 'center' },
  { key: 'total', label: 'Total /100', align: 'center' },
  { key: 'forecast', label: 'Forecast', align: 'center' },
  { key: 'redzone', label: 'Red Zone', align: 'center' },
];

const ACCESSOR = {
  name: r => r.property?.name,
  gop: r => r.gop,
  gopMargin: r => r.gopMargin,
  rgi: r => r.rgi,
  gss: r => r.gss,
  total: r => r.total,
  forecast: r => r.forecast,
  redzone: r => isRedZoneApplicable(r.property) ? r.redzone : null,
};

function fmt$K(val) {
  if (val == null) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return '$' + Math.round(val / 1e3) + 'K';
  return '$' + Math.round(val);
}
function fmt1(val) { return val == null ? '—' : val.toFixed(1); }
function fmtPct(val) { return val == null ? '—' : val.toFixed(1) + '%'; }

function KpiCell({ score, actual, goal, hit }) {
  const actualColor = hit == null ? 'text-muted-foreground' : (hit ? 'text-pass' : 'text-fail');
  return (
    <td className="py-2.5 px-3 text-center align-top">
      <div className="font-semibold text-sm">{score != null ? score.toFixed(1) : '—'}</div>
      <div className={`text-[10px] font-bold leading-tight mt-0.5 ${actualColor}`}>{actual}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{goal}</div>
    </td>
  );
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

function NoDataPill() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-muted-foreground bg-muted border border-border">
      NO DATA
    </span>
  );
}

function NaPill() {
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold text-slate-400 bg-slate-100 border border-slate-200">
      N/A
    </span>
  );
}

function fmt$(val) {
  if (val == null) return '—';
  return '$' + Math.round(val).toLocaleString('en-US');
}

export default function LeadershipGroupCard({ groupName, roleLabel, leadRole, year, quarter, periodLabel, entries, expandedId, onToggle }) {
  const [sortKey, setSortKey] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1;
    const accessor = ACCESSOR[sortKey];
    return [...entries].sort((a, b) => {
      if (!a.hasData && b.hasData) return 1;
      if (a.hasData && !b.hasData) return -1;
      if (!a.hasData && !b.hasData) return 0;
      const av = accessor(a);
      const bv = accessor(b);
      if (sortKey === 'name') return String(av ?? '').localeCompare(String(bv ?? '')) * dir;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [entries, sortKey, sortDir]);

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
              {SORT_COLS.map(c => {
                const active = sortKey === c.key;
                const align = c.align === 'center' ? 'text-center' : 'text-left';
                return (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={`py-2.5 px-3 ${align} font-semibold cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${active ? 'text-primary' : ''}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${c.align === 'center' ? 'justify-center' : ''}`}>
                      {c.label}
                      {active && (sortDir === 'desc'
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronUp className="w-3 h-3" />)}
                    </span>
                  </th>
                );
              })}
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
                        <KpiCell
                          score={r.gop}
                          actual={fmt$K(r.gopActual)}
                          goal={`Budget ${fmt$K(r.gopBudget)}`}
                          hit={(r.gopActual != null && r.gopBudget != null) ? r.gopActual >= r.gopBudget : null}
                        />
                        <KpiCell
                          score={r.gopMargin}
                          actual={fmtPct(r.entry?.gop_margin_actual)}
                          goal={`LY ${fmtPct(r.entry?.gop_margin_prior)}`}
                          hit={(r.entry?.gop_margin_actual != null && r.entry?.gop_margin_prior != null) ? r.entry.gop_margin_actual >= r.entry.gop_margin_prior : null}
                        />
                        <KpiCell
                          score={r.rgi}
                          actual={fmt1(r.entry?.revpar_index)}
                          goal={`LY ${fmt1(r.entry?.revpar_index_prior)}`}
                          hit={(r.entry?.revpar_index != null && r.entry?.revpar_index_prior != null) ? r.entry.revpar_index >= r.entry.revpar_index_prior : null}
                        />
                        <KpiCell
                          score={r.gss}
                          actual={fmt1(r.sc?.gss?.normActual)}
                          goal={`LY ${fmt1(r.sc?.gss?.normPrior)}`}
                          hit={(r.sc?.gss?.normActual != null && r.sc?.gss?.normPrior != null) ? r.sc.gss.normActual >= r.sc.gss.normPrior : null}
                        />
                        <td className="py-3 px-3 text-center">
                          <span className="font-black text-sm" style={{ color: scoreColor(r.total, r.maxPossible) }}>
                            {r.total != null ? r.total.toFixed(1) : '—'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">{r.forecast == null ? <NoDataPill /> : <KickerPill state={r.forecast} />}</td>
                        <td className="py-3 px-3 text-center">{isRedZoneApplicable(r.property) ? <KickerPill state={r.redzone} /> : <NaPill />}</td>
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
      <OperatorSummarySection
        leaderName={groupName}
        leadRole={leadRole}
        year={year}
        quarter={quarter}
        periodLabel={periodLabel}
        roleLabel={roleLabel}
        entries={entries}
      />
    </div>
  );
}