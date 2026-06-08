import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calculateActualYtdSalary } from '@/lib/salaryCalculation';

// Build KPI rows from a scorecard result + entry
function buildKpiRows(scorecard, entry) {
  if (!scorecard || !entry) return [];

  const { gop, gopMargin, rgi, gss, gssStd } = scorecard;

  const getStatus = (result) => {
    if (result.incomplete) return 'na';
    if (result.tier === 'partial') return 'partial';
    return result.pass ? 'pass' : 'fail';
  };

  const gopValue = (() => {
    if (entry.budgeted_gop_actual != null && entry.budgeted_gop_target != null) {
      const a = `$${Math.round(entry.budgeted_gop_actual).toLocaleString()}`;
      const t = `$${Math.round(entry.budgeted_gop_target).toLocaleString()}`;
      return `${a} vs ${t} budget`;
    }
    return null;
  })();

  const marginValue = (() => {
    if (gopMargin.diff != null && !gopMargin.incomplete) {
      const sign = gopMargin.diff >= 0 ? '+' : '';
      return `${sign}${gopMargin.diff.toFixed(1)} pts vs LY`;
    }
    return null;
  })();

  const rgiValue = (() => {
    if (!rgi.incomplete && rgi.diff != null) {
      const sign = rgi.diff >= 0 ? '+' : '';
      return `${sign}${rgi.diff.toFixed(1)}% YOY`;
    }
    return null;
  })();

  const gssValue = (() => {
    if (!gss.incomplete && gss.diff != null) {
      const sign = gss.diff >= 0 ? '+' : '';
      return `${sign}${gss.diff.toFixed(2)} pts vs LY (${gssStd?.metric || 'GSS'})`;
    }
    return null;
  })();

  // weight = max pts / 100 (fraction of total score)
  return [
    { name: 'Budgeted GOP',    status: getStatus(gop),       pts: gop.score,       max: 35,  weight: 0.35, value: gopValue },
    { name: 'GOP Margin',      status: getStatus(gopMargin), pts: gopMargin.score, max: 35,  weight: 0.35, value: marginValue },
    { name: 'RGI Improvement', status: getStatus(rgi),       pts: rgi.score,       max: 15,  weight: 0.15, value: rgiValue },
    { name: 'GSS Improvement', status: getStatus(gss),       pts: gss.score,       max: 15,  weight: 0.15, value: gssValue },
  ];
}

const STATUS_META = {
  pass:    { icon: '✅', label: 'PASS',    rowBg: 'bg-green-50',  textColor: 'text-green-800',  labelBg: 'bg-green-100 text-green-800' },
  fail:    { icon: '❌', label: 'FAIL',    rowBg: 'bg-red-50',    textColor: 'text-red-800',    labelBg: 'bg-red-100 text-red-800' },
  partial: { icon: '⚡', label: 'PARTIAL', rowBg: 'bg-yellow-50', textColor: 'text-yellow-800', labelBg: 'bg-yellow-100 text-yellow-800' },
  na:      { icon: '⬜', label: 'N/A',     rowBg: 'bg-gray-50',   textColor: 'text-gray-500',   labelBg: 'bg-gray-100 text-gray-500' },
};

const QUARTERS = [
  { q: 1, label: 'Q1 2026', range: 'Jan–Mar', months: [1, 2, 3] },
  { q: 2, label: 'Q2 2026', range: 'Apr–Jun', months: [4, 5, 6] },
  { q: 3, label: 'Q3 2026', range: 'Jul–Sep', months: [7, 8, 9] },
  { q: 4, label: 'Q4 2026', range: 'Oct–Dec', months: [10, 11, 12] },
];

const fmt = (n) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

export default function StaffExpandedRow({ staff, property, jobClass, colSpan = 6 }) {
  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries-expanded', property?.id],
    queryFn: () =>
      property?.id
        ? base44.entities.ScoreEntry.filter({ property_id: property.id, year: 2026 })
        : Promise.resolve([]),
    enabled: !!property?.id,
  });

  const bonusPct = (jobClass?.max_bonus_percentage || 0) / 100;
  const hasBonusPct = bonusPct > 0;

  // Build per-quarter data
  const quarterData = QUARTERS.map(({ q, label, range }) => {
    const salary = staff[`salary_q${q}`] || 0;
    const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
    const entry = aggregateQuarterEntries(qEntries);
    const scorecard = entry ? calculateScorecard(entry, property) : null;
    const kpiScore = scorecard?.total?.total ?? null;
    const maxPossible = scorecard?.total?.maxPossible ?? 100;
    const bonusTarget = salary * bonusPct;
    const kpiRatio = kpiScore !== null && maxPossible > 0 ? kpiScore / maxPossible : null;
    const bonusEarned = kpiRatio !== null ? bonusTarget * kpiRatio : null;
    const paidOut = bonusEarned !== null ? bonusEarned * 0.5 : null;
    const held = bonusEarned !== null ? bonusEarned * 0.5 : null;
    const hasSalary = salary > 0;
    const hasData = entry !== null && hasSalary;

    return { q, label, range, salary, hasSalary, hasData, kpiScore, maxPossible, bonusTarget, bonusEarned, paidOut, held, entry, scorecard };
  });

  // Annual totals
  const { total: ytdSalary, quarters: ytdQtrs } = calculateActualYtdSalary(staff);
  const totalBonusEarned = quarterData.reduce((sum, qd) => sum + (qd.bonusEarned ?? 0), 0);
  const totalPaidOut = quarterData.reduce((sum, qd) => sum + (qd.paidOut ?? 0), 0);
  const totalHeld = quarterData.reduce((sum, qd) => sum + (qd.held ?? 0), 0);
  const hasAnyBonus = quarterData.some(qd => qd.bonusEarned !== null);

  return (
    <tr>
      <td colSpan={colSpan} className="p-0 border-t-0">
        <div className="bg-slate-50 border-b border-border px-6 py-5 space-y-4">

          {/* Quarter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {quarterData.map(({ q, label, range, salary, hasSalary, hasData, kpiScore, maxPossible, bonusTarget, bonusEarned, paidOut, held, entry, scorecard }) => {
              if (!hasSalary) {
                return (
                  <div key={q} className="rounded-xl border border-dashed border-border bg-white px-4 py-4 text-center opacity-60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-xs text-muted-foreground mt-1">— Pending —</p>
                  </div>
                );
              }

              const kpiRows = buildKpiRows(scorecard, entry);

              return (
                <div key={q} className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
                  {/* Quarter Header */}
                  <div className="px-4 py-2 text-white flex items-center justify-between" style={{ background: '#2d4b5e' }}>
                    <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                    <span className="text-xs text-white/70">{range}</span>
                  </div>

                  {/* Salary row */}
                  <div className="px-4 py-2 flex justify-between items-center text-xs border-b border-border bg-muted/20">
                    <span className="text-muted-foreground">Quarterly Salary</span>
                    <span className="font-semibold">{fmt(salary)}</span>
                  </div>

                  {/* KPI Breakdown Table */}
                  {hasData && kpiRows.length > 0 ? (
                    <div>
                      {/* Table header — KPI | Result | % of Salary | Potential $ | Earned $ | Pts */}
                      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 px-3 py-1.5 bg-muted/30 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        <span>KPI</span>
                        <span className="text-center w-16">Result</span>
                        <span className="text-right w-14">% Salary</span>
                        <span className="text-right w-16">Potential</span>
                        <span className="text-right w-16">Earned</span>
                        <span className="text-right w-10">Pts</span>
                      </div>

                      {kpiRows.map((row) => {
                        const meta = STATUS_META[row.status];
                        // % of salary = weight × bonus target %
                        const pctOfSalary = row.weight * (jobClass?.max_bonus_percentage || 0);
                        // Potential $ = salary × pctOfSalary / 100
                        const potentialDollar = salary * pctOfSalary / 100;
                        // Earned $ = salary × bonus% × (pts earned / max pts)
                        const earnedDollar = row.max > 0 ? salary * bonusPct * (row.pts / row.max) : 0;
                        return (
                          <div key={row.name} className={`border-b border-border/60 ${meta.rowBg}`}>
                            <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 px-3 py-1.5 items-center text-xs">
                              <span className={`font-medium ${meta.textColor}`}>{row.name}</span>
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-16 text-center ${meta.labelBg}`}>
                                {meta.icon} {meta.label}
                              </span>
                              <span className={`text-right w-14 font-semibold ${meta.textColor}`}>
                                {hasBonusPct ? `${pctOfSalary.toFixed(1)}%` : '—'}
                              </span>
                              <span className={`text-right w-16 ${meta.textColor}`}>
                                {hasBonusPct ? fmt(potentialDollar) : '—'}
                              </span>
                              <span className={`text-right w-16 font-bold ${meta.textColor}`}>
                                {hasBonusPct ? fmt(earnedDollar) : '—'}
                              </span>
                              <span className={`font-bold text-right w-10 ${meta.textColor}`}>{row.pts}</span>
                            </div>
                            {row.value && (
                              <div className={`px-3 pb-1.5 text-[10px] ${meta.textColor} opacity-80`}>
                                {row.value}
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Total Score row */}
                      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-2 px-3 py-2 bg-muted/40 border-b border-border items-center">
                        <span className="text-xs font-bold uppercase tracking-wide text-foreground">Total</span>
                        <span className="w-16" />
                        <span className="font-black text-xs text-right w-14 text-foreground">
                          {hasBonusPct ? `${jobClass?.max_bonus_percentage}%` : '—'}
                        </span>
                        <span className="font-black text-xs text-right w-16 text-foreground">
                          {hasBonusPct ? fmt(bonusTarget) : '—'}
                        </span>
                        <span className="font-black text-xs text-right w-16 text-foreground">
                          {hasBonusPct && bonusEarned !== null ? fmt(bonusEarned) : '—'}
                        </span>
                        <span className="font-black text-sm text-right w-10 text-foreground">{kpiScore}/{maxPossible}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="px-4 py-3 text-xs text-muted-foreground italic border-b border-border">
                      No scorecard data entered for this quarter.
                    </div>
                  )}

                  {/* Bonus calculation section */}
                  <div className="px-4 py-3 space-y-1.5 text-xs">
                    {!hasBonusPct ? (
                      <div className="text-yellow-700 bg-yellow-50 rounded px-2 py-1">
                        ⚠ No bonus % configured for this classification.
                      </div>
                    ) : bonusEarned !== null ? (
                      <>
                        {/* Formula line */}
                        <div className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1">
                          {fmt(salary)} × {jobClass?.max_bonus_percentage}% × {kpiScore}/{maxPossible} pts
                          {' = '}
                          <span className="font-bold text-foreground">{fmt(bonusEarned)}</span>
                        </div>
                        {/* Payout split */}
                        <div className="rounded-lg overflow-hidden border border-border mt-1">
                          <div className="flex justify-between items-center px-3 py-1.5 bg-green-50 text-green-800">
                            <span>✅ Paid This Quarter (50%)</span>
                            <span className="font-bold">{fmt(paidOut)}</span>
                          </div>
                          <div className="flex justify-between items-center px-3 py-1.5 bg-blue-50 text-blue-800 border-t border-border">
                            <span>🔄 Held to Year-End (50%)</span>
                            <span className="font-bold">{fmt(held)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-muted-foreground italic">
                        Enter KPI data to calculate this quarter's bonus.
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Annual Running Total */}
          <div className="rounded-xl border-2 border-border bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-3 bg-muted/40 border-b border-border">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Annual Running Total</p>
            </div>
            <div className="px-5 py-4 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
              <div>
                <p className="text-muted-foreground mb-1">YTD Salary</p>
                <p className="font-bold text-base">{ytdSalary > 0 ? fmt(ytdSalary) : '—'}</p>
                {ytdQtrs.length > 0 && (
                  <p className="text-muted-foreground text-xs">{ytdQtrs.map(q => `Q${q}`).join(' + ')}</p>
                )}
              </div>
              {hasBonusPct && (
                <div>
                  <p className="text-muted-foreground mb-1">Total Bonus Earned</p>
                  <p className="font-bold text-base">{hasAnyBonus ? fmt(totalBonusEarned) : '—'}</p>
                </div>
              )}
            </div>

            {hasBonusPct && hasAnyBonus && (
              <div className="border-t border-border">
                <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
                  <div className="px-5 py-4 text-xs">
                    <p className="text-muted-foreground mb-1">✅ Total Paid Out (quarterly)</p>
                    <p className="font-black text-lg text-green-700">{fmt(totalPaidOut)}</p>
                  </div>
                  <div className="px-5 py-4 text-xs">
                    <p className="text-muted-foreground mb-1">🔄 Total Held for Year-End</p>
                    <p className="font-black text-lg text-blue-700">{fmt(totalHeld)}</p>
                  </div>
                  <div className="px-5 py-4 text-xs">
                    <p className="text-muted-foreground mb-1">Year-End Payment Due</p>
                    <p className="font-black text-lg text-foreground">{fmt(totalHeld)}</p>
                  </div>
                </div>
              </div>
            )}

            {hasBonusPct && !hasAnyBonus && (
              <div className="px-5 py-4 text-xs text-muted-foreground italic border-t border-border">
                No KPI data entered yet — payout totals will appear once scorecard data is available.
              </div>
            )}

            {!hasBonusPct && (
              <div className="px-5 py-4 border-t border-border bg-yellow-50">
                <p className="text-xs text-yellow-800 font-medium">⚠ No max bonus % configured for {jobClass?.title}. Edit job classification to enable payout calculations.</p>
              </div>
            )}
          </div>

        </div>
      </td>
    </tr>
  );
}