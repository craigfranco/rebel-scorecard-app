import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calculateActualYtdSalary } from '@/lib/salaryCalculation';

const QUARTERS = [
  { q: 1, label: 'Q1 2026' },
  { q: 2, label: 'Q2 2026' },
  { q: 3, label: 'Q3 2026' },
  { q: 4, label: 'Q4 2026' },
];

const KPI_DEFS = [
  { key: 'gop',       name: 'Budgeted GOP', max: 35, weight: 0.35 },
  { key: 'gopMargin', name: 'GOP Margin',   max: 35, weight: 0.35 },
  { key: 'rgi',       name: 'RGI',          max: 15, weight: 0.15 },
  { key: 'gss',       name: 'GSS',          max: 15, weight: 0.15 },
];

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

function statusIcon(result) {
  if (!result || result.incomplete) return '—';
  if (result.tier === 'partial') return '⚡';
  return result.pass ? '✅' : '❌';
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

  const quarterData = QUARTERS.map(({ q, label }) => {
    const salary = staff[`salary_q${q}`] || 0;
    const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
    const entry = aggregateQuarterEntries(qEntries);
    const scorecard = entry ? calculateScorecard(entry, property) : null;
    const kpiScore = scorecard?.total?.total ?? null;
    const maxPossible = scorecard?.total?.maxPossible ?? 100;
    const bonusTarget = salary * bonusPct;
    const kpiRatio = kpiScore !== null && maxPossible > 0 ? kpiScore / maxPossible : null;
    const bonusEarned = kpiRatio !== null ? bonusTarget * kpiRatio : null;

    const kpiRows = KPI_DEFS.map(({ key, name, max, weight }) => {
      const result = scorecard?.[key];
      const icon = statusIcon(result);
      const pts = result && !result.incomplete ? result.score : null;
      const earned = pts !== null ? salary * bonusPct * (pts / max) : null;
      return { name, icon, pts, max, earned };
    });

    return { q, label, salary, kpiScore, maxPossible, bonusEarned, kpiRows };
  });

  const { total: ytdSalary } = calculateActualYtdSalary(staff);
  const totalBonusEarned = quarterData.reduce((s, d) => s + (d.bonusEarned ?? 0), 0);
  const totalPaidOut = totalBonusEarned * 0.5;
  const totalHeld = totalBonusEarned * 0.5;
  const hasAnyBonus = quarterData.some(d => d.bonusEarned !== null);

  return (
    <tr>
      <td colSpan={colSpan} className="p-0">
        <div className="bg-slate-50 border-b border-border">

          {/* Header */}
          <div className="px-6 py-3 border-b border-border flex flex-wrap items-center gap-x-4 gap-y-1 text-sm bg-white">
            <span className="font-bold text-foreground">{staff.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{property?.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{jobClass?.title}</span>
            {maxBonusPct > 0 && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">Bonus Target: <span className="font-semibold text-foreground">{maxBonusPct}%</span></span>
              </>
            )}
          </div>

          {/* 4-column quarter grid */}
          <div className="grid grid-cols-4 divide-x divide-border">
            {quarterData.map(({ q, label, salary, kpiScore, maxPossible, bonusEarned, kpiRows }) => {
              const isPending = !salary;
              const paidOut = bonusEarned !== null ? bonusEarned * 0.5 : null;
              const held = bonusEarned !== null ? bonusEarned * 0.5 : null;

              return (
                <div key={q} className={`flex flex-col ${isPending ? 'opacity-50' : ''}`}>
                  {/* Quarter label */}
                  <div className="px-4 py-2 border-b border-border" style={{ background: '#2d4b5e' }}>
                    <span className="text-xs font-bold text-white">{label}</span>
                  </div>

                  {isPending ? (
                    <div className="px-4 py-6 text-center flex-1">
                      <p className="text-xs text-muted-foreground italic">— Pending —</p>
                    </div>
                  ) : (
                    <div className="px-4 py-3 space-y-3 flex-1">

                      {/* Salary */}
                      <div className="text-xs">
                        <span className="text-muted-foreground">Salary </span>
                        <span className="font-semibold text-foreground">{fmt(salary)}</span>
                      </div>

                      {/* KPI Score */}
                      <div className="text-xs">
                        <span className="text-muted-foreground">KPI </span>
                        <span className="font-semibold text-foreground">
                          {kpiScore !== null ? `${kpiScore}/${maxPossible}` : '—'}
                        </span>
                      </div>

                      {/* KPI rows */}
                      <div className="space-y-0.5 border-t border-border/40 pt-2">
                        {kpiRows.map(({ name, icon, pts, max, earned }) => (
                          <div key={name} className="flex items-center justify-between gap-1 text-xs">
                            <span className="flex items-center gap-1 min-w-0">
                              <span className="text-sm leading-none">{icon}</span>
                              <span className="text-muted-foreground truncate">{name}</span>
                            </span>
                            <span className="font-semibold text-foreground whitespace-nowrap">
                              {pts !== null ? `${pts}/${max}` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Bonus / Payout */}
                      {bonusEarned !== null ? (
                        <div className="border-t border-border/40 pt-2 space-y-1 text-xs">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Bonus</span>
                            <span className="font-bold text-foreground">{fmt(bonusEarned)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">✅ Paid</span>
                            <span className="font-semibold text-foreground">{fmt(paidOut)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">🔄 Held</span>
                            <span className="font-semibold text-foreground">{fmt(held)}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="border-t border-border/40 pt-2">
                          <p className="text-[11px] text-muted-foreground italic">No KPI data yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Annual summary bar */}
          <div className="border-t-2 border-border bg-white px-6 py-3 flex flex-wrap gap-x-6 gap-y-1 items-center text-xs">
            <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[10px] mr-2">Annual Total</span>
            <span><span className="text-muted-foreground">YTD Salary</span> <span className="font-bold text-foreground ml-1">{ytdSalary > 0 ? fmt(ytdSalary) : '—'}</span></span>
            <span className="text-border">|</span>
            <span><span className="text-muted-foreground">Bonus Earned</span> <span className="font-bold text-foreground ml-1">{hasAnyBonus ? fmt(totalBonusEarned) : '—'}</span></span>
            <span className="text-border">|</span>
            <span><span className="text-muted-foreground">✅ Paid Out</span> <span className="font-bold text-green-700 ml-1">{hasAnyBonus ? fmt(totalPaidOut) : '—'}</span></span>
            <span className="text-border">|</span>
            <span><span className="text-muted-foreground">🔄 Held Year-End</span> <span className="font-bold text-blue-700 ml-1">{hasAnyBonus ? fmt(totalHeld) : '—'}</span></span>
          </div>

        </div>
      </td>
    </tr>
  );
}