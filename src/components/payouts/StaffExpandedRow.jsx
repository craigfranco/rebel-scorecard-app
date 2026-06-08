import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calculateActualYtdSalary } from '@/lib/salaryCalculation';

const QUARTERS = [
  { q: 1, label: 'Q1 2026', range: 'Jan–Mar' },
  { q: 2, label: 'Q2 2026', range: 'Apr–Jun' },
  { q: 3, label: 'Q3 2026', range: 'Jul–Sep' },
  { q: 4, label: 'Q4 2026', range: 'Oct–Dec' },
];

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtPct = (n) => `${n.toFixed(1)}%`;

function getStatusIcon(result) {
  if (result.incomplete) return '—';
  if (result.tier === 'partial') return '⚡';
  return result.pass ? '✅' : '❌';
}

function buildKpiRows(scorecard, entry, salary, bonusPct, maxBonusPct) {
  if (!scorecard || !entry) return [];
  const { gop, gopMargin, rgi, gss, gssStd } = scorecard;

  const row = (name, result, max, weight) => {
    const icon = getStatusIcon(result);
    const pts = result.incomplete ? null : result.score;
    const pctSalary = weight * maxBonusPct;
    const potentialDollar = salary * pctSalary / 100;
    const earnedDollar = max > 0 ? salary * bonusPct * ((pts ?? 0) / max) : 0;
    return { name, icon, pts, max, pctSalary, potentialDollar, earnedDollar, incomplete: result.incomplete };
  };

  return [
    row('Budgeted GOP',    gop,       35, 0.35),
    row('GOP Margin',      gopMargin, 35, 0.35),
    row('RGI Improvement', rgi,       15, 0.15),
    row('GSS Improvement', gss,       15, 0.15),
  ];
}

export default function StaffExpandedRow({ staff, property, jobClass, colSpan = 6 }) {
  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries-expanded', property?.id],
    queryFn: () =>
      property?.id
        ? base44.entities.ScoreEntry.filter({ property_id: property.id, year: 2026 })
        : Promise.resolve([]),
    enabled: !!property?.id,
  });

  const maxBonusPct = jobClass?.max_bonus_percentage || 0;
  const bonusPct = maxBonusPct / 100;
  const hasBonusPct = bonusPct > 0;

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
    const kpiRows = buildKpiRows(scorecard, entry, salary, bonusPct, maxBonusPct);
    return { q, label, range, salary, entry, scorecard, kpiScore, maxPossible, bonusTarget, bonusEarned, paidOut, held, kpiRows };
  });

  const { total: ytdSalary, quarters: ytdQtrs } = calculateActualYtdSalary(staff);
  const totalBonusEarned = quarterData.reduce((sum, qd) => sum + (qd.bonusEarned ?? 0), 0);
  const totalPaidOut = quarterData.reduce((sum, qd) => sum + (qd.paidOut ?? 0), 0);
  const totalHeld = quarterData.reduce((sum, qd) => sum + (qd.held ?? 0), 0);
  const hasAnyBonus = quarterData.some(qd => qd.bonusEarned !== null);
  const quartersWithSalary = quarterData.filter(qd => qd.salary > 0);

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-slate-50 border-b border-border px-6 py-5 space-y-5">

          {/* Quarter Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {quarterData.map(({ q, label, salary, kpiScore, maxPossible, bonusTarget, bonusEarned, paidOut, held, kpiRows }) => {
              if (!salary) {
                return (
                  <div key={q} className="rounded-xl bg-white border border-dashed border-border px-4 py-4 text-center">
                    <p className="text-xs font-semibold text-muted-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground mt-1 opacity-60">No salary entered</p>
                  </div>
                );
              }

              return (
                <div key={q} className="rounded-xl bg-white border border-border overflow-hidden">
                  {/* Card header */}
                  <div className="px-4 py-2.5 border-b border-border flex items-center justify-between" style={{ background: '#2d4b5e' }}>
                    <span className="text-xs font-bold text-white">{label}</span>
                    {kpiScore !== null
                      ? <span className="text-xs text-white/80">Score: <span className="font-bold text-white">{kpiScore}/{maxPossible}</span></span>
                      : <span className="text-xs text-white/50 italic">No data</span>
                    }
                  </div>

                  <div className="px-4 py-3 space-y-3">
                    {/* Salary line */}
                    <p className="text-xs text-muted-foreground">Salary: <span className="font-semibold text-foreground">{fmt(salary)}</span></p>

                    {/* KPI rows */}
                    {kpiRows.length > 0 ? (
                      <div className="space-y-0">
                        {/* Column headers */}
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-2 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          <span className="w-4" />
                          <span>KPI</span>
                          <span className="text-right w-14">Pts</span>
                          <span className="text-right w-10">%</span>
                          <span className="text-right w-14">Earned</span>
                        </div>
                        <div className="border-t border-border/40" />

                        {kpiRows.map((row) => (
                          <div key={row.name} className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-2 py-1 items-center text-xs border-b border-border/20 last:border-0">
                            <span className="w-4 text-center text-sm leading-none">{row.icon}</span>
                            <span className="text-foreground truncate">{row.name}</span>
                            <span className="text-right w-14 text-muted-foreground">
                              {row.incomplete ? '—' : `${row.pts}/${row.max}`}
                            </span>
                            <span className="text-right w-10 text-muted-foreground">
                              {hasBonusPct ? fmtPct(row.pctSalary) : '—'}
                            </span>
                            <span className="text-right w-14 font-semibold text-foreground">
                              {hasBonusPct ? fmt(row.earnedDollar) : '—'}
                            </span>
                          </div>
                        ))}

                        {/* Totals divider row */}
                        <div className="border-t border-border mt-1 pt-1.5 grid grid-cols-[auto_1fr_auto_auto_auto] gap-x-2 items-center text-xs">
                          <span className="w-4" />
                          <span className="font-bold text-foreground">Total</span>
                          <span className="text-right w-14 font-bold text-foreground">
                            {kpiScore !== null ? `${kpiScore}/${maxPossible}` : '—'}
                          </span>
                          <span className="text-right w-10 font-bold text-foreground">
                            {hasBonusPct ? fmtPct(maxBonusPct) : '—'}
                          </span>
                          <span className="text-right w-14 font-bold text-foreground">
                            {hasBonusPct && bonusEarned !== null ? fmt(bonusEarned) : '—'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">No scorecard data yet.</p>
                    )}

                    {/* Payout split */}
                    {bonusEarned !== null && (
                      <div className="border-t border-border pt-2.5 space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">✅ Paid this quarter</span>
                          <span className="font-bold text-foreground">{fmt(paidOut)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">🔄 Held to year-end</span>
                          <span className="font-bold text-foreground">{fmt(held)}</span>
                        </div>
                      </div>
                    )}

                    {!hasBonusPct && (
                      <p className="text-[10px] text-yellow-700 bg-yellow-50 rounded px-2 py-1">⚠ No bonus % configured.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Annual Running Total */}
          {quartersWithSalary.length > 0 && (
            <div className="rounded-xl bg-white border border-border px-5 py-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Annual Running Total</p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground text-xs">YTD Salary</span>
                  <span className="font-semibold">{ytdSalary > 0 ? fmt(ytdSalary) : '—'}</span>
                </div>
                {hasBonusPct && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground text-xs">Bonus Earned</span>
                      <span className="font-semibold">{hasAnyBonus ? fmt(totalBonusEarned) : '—'}</span>
                    </div>
                    {hasAnyBonus && (
                      <>
                        <div className="border-t border-border/40 my-1" />
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-xs">✅ Paid Out</span>
                          <span className="font-bold text-green-700">{fmt(totalPaidOut)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground text-xs">🔄 Held Year-End</span>
                          <span className="font-bold text-blue-700">{fmt(totalHeld)}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </td>
    </tr>
  );
}