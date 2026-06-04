import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calculateActualYtdSalary } from '@/lib/salaryCalculation';

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

    return { q, label, range, salary, hasSalary, hasData, kpiScore, maxPossible, bonusTarget, bonusEarned, paidOut, held };
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
            {quarterData.map(({ q, label, range, salary, hasSalary, hasData, kpiScore, maxPossible, bonusTarget, bonusEarned, paidOut, held }) => {
              if (!hasSalary) {
                return (
                  <div key={q} className="rounded-xl border border-dashed border-border bg-white px-4 py-4 text-center opacity-60">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{label}</p>
                    <p className="text-xs text-muted-foreground mt-1">— Pending —</p>
                  </div>
                );
              }

              return (
                <div key={q} className="rounded-xl border border-border bg-white overflow-hidden shadow-sm">
                  {/* Quarter Header */}
                  <div className="px-4 py-2 bg-navy/90 text-white flex items-center justify-between" style={{ background: '#2d4b5e' }}>
                    <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
                    <span className="text-xs text-white/70">{range}</span>
                  </div>

                  <div className="px-4 py-3 space-y-2 text-xs">
                    {/* Salary */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Quarterly Salary</span>
                      <span className="font-semibold">{fmt(salary)}</span>
                    </div>

                    {/* KPI Score */}
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">KPI Score</span>
                      {hasData && kpiScore !== null
                        ? <span className="font-semibold">{kpiScore}/{maxPossible}</span>
                        : <span className="text-muted-foreground italic">No data yet</span>
                      }
                    </div>

                    {/* Bonus Target */}
                    {hasBonusPct && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Bonus Target</span>
                        <span className="font-semibold">{fmt(bonusTarget)}</span>
                      </div>
                    )}

                    {/* Bonus Earned */}
                    {hasBonusPct && (
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Bonus Earned</span>
                        {bonusEarned !== null
                          ? <span className="font-bold text-foreground">{fmt(bonusEarned)}</span>
                          : <span className="text-muted-foreground italic">Pending</span>
                        }
                      </div>
                    )}

                    {!hasBonusPct && (
                      <div className="text-yellow-700 text-xs bg-yellow-50 rounded px-2 py-1">
                        ⚠ No bonus % set
                      </div>
                    )}

                    {/* Divider + Payout Split */}
                    {bonusEarned !== null && (
                      <>
                        <div className="border-t border-border my-1" />
                        <div className="font-bold text-xs flex justify-between items-center">
                          <span>Full Payout</span>
                          <span>{fmt(bonusEarned)}</span>
                        </div>
                        <div className="flex justify-between items-center text-green-700">
                          <span>✅ Paid This Quarter (50%)</span>
                          <span className="font-semibold">{fmt(paidOut)}</span>
                        </div>
                        <div className="flex justify-between items-center text-blue-700">
                          <span>🔄 Held to Year-End (50%)</span>
                          <span className="font-semibold">{fmt(held)}</span>
                        </div>
                      </>
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