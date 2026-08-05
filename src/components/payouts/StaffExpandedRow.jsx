import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calculateActualYtdSalary } from '@/lib/salaryCalculation';
import { calcKpiBonus, checkBonusEligibility } from '@/lib/bonusCalculation';
import StaffPdfExport from './StaffPdfExport';

const QUARTERS = [
  { q: 1, label: 'Q1 2026' },
  { q: 2, label: 'Q2 2026' },
  { q: 3, label: 'Q3 2026' },
  { q: 4, label: 'Q4 2026' },
];

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtPts = (n) => n != null ? String(n) : '—';

function kpiRows(scorecard, salary, jobClass) {
  if (!scorecard || !jobClass) return [];
  const highRgiPct = jobClass.rgi_bonus_percentage_high || 0;

  const row = (name, result, pts, max, bonusPct, detailLabel = null) => {
    let icon = '—';
    if (!result?.incomplete) {
      if (result?.tier === 'partial') icon = '⚡';
      else if (result?.pass) icon = '✅';
      else icon = '❌';
    }
    const earned = (!result?.incomplete && result?.pass && salary > 0)
      ? salary * bonusPct / 100
      : 0;
    return { name, icon, pts: result?.incomplete ? null : pts, max, bonusPct, earned, detailLabel };
  };

  // RGI: always use rgi_bonus_percentage_high as max; partial = 50% of max
  const rgiMax = salary * highRgiPct / 100;
  let rgiPct, rgiDetail;
  if (scorecard.rgi?.incomplete) {
    rgiPct = highRgiPct;
    rgiDetail = null;
  } else if (scorecard.rgi?.tier === 'full') {
    rgiPct = highRgiPct;
    rgiDetail = `15/15 pts — ${fmt(rgiMax)}`;
  } else if (scorecard.rgi?.tier === 'partial') {
    rgiPct = highRgiPct / 2;
    rgiDetail = `7.5/15 pts — ${fmt(rgiMax * 0.5)} (50% of ${fmt(rgiMax)} max)`;
  } else {
    rgiPct = highRgiPct;
    rgiDetail = `0/15 pts — $0`;
  }

  return [
    row('Budgeted GOP',    scorecard.gop,       scorecard.gop?.score,       35, jobClass.gop_bonus_percentage || 0),
    row('GOP Margin',      scorecard.gopMargin, scorecard.gopMargin?.score, 35, jobClass.gop_margin_bonus_percentage || 0),
    row('RGI',             scorecard.rgi,       scorecard.rgi?.score,       15, rgiPct, rgiDetail),
    row('GSS',             scorecard.gss,       scorecard.gss?.score,       15, jobClass.gss_bonus_percentage || 0),
  ];
}

export default function StaffExpandedRow({ staff, property, jobClass, colSpan = 6, selectedYear, selectedMonth }) {
  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries-expanded', property?.id, selectedYear],
    queryFn: () =>
      property?.id
        ? base44.entities.ScoreEntry.filter({ property_id: property.id, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!property?.id,
  });

  const { data: rgiQuarterlyReports = [] } = useQuery({
    queryKey: ['rgi-quarterly', selectedYear],
    queryFn: () => base44.entities.RgiQuarterlyReport.filter({ year: selectedYear }),
  });

  const { data: bonusExceptions = [] } = useQuery({
    queryKey: ['bonus-exceptions', property?.id, selectedYear],
    queryFn: () =>
      property?.id
        ? base44.entities.BonusException.filter({ property_id: property.id, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!property?.id,
  });

  const maxBonusPct = jobClass?.max_bonus_percentage || 0;

  const quarterData = QUARTERS.map(({ q, label }) => {
    const salary = staff[`salary_q${q}`] || 0;
    const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
    const entry = aggregateQuarterEntries(qEntries, rgiQuarterlyReports, bonusExceptions);
    const scorecard = entry ? calculateScorecard(entry, property) : null;
    const kpiScore = scorecard?.total?.total ?? null;
    const maxPossible = scorecard?.total?.maxPossible ?? 100;
    const bonus = salary && scorecard ? calcKpiBonus(salary, scorecard, jobClass, property) : null;
    const bonusEarned = bonus?.total ?? null;
    const eligibility = scorecard ? checkBonusEligibility(scorecard) : null;
    const rows = scorecard ? kpiRows(scorecard, salary, jobClass) : [];
    return { q, label, salary, kpiScore, maxPossible, bonus, bonusEarned, eligibility, rows };
  });

  const { total: ytdSalary } = calculateActualYtdSalary(staff);
  const totalBonusEarned = quarterData.reduce((s, d) => s + (d.bonusEarned ?? 0), 0);
  const totalPaidOut = totalBonusEarned * 0.5;
  const totalHeld = totalBonusEarned * 0.5;
  const hasAnyBonus = quarterData.some(d => d.bonusEarned !== null);
  const quartersWithSalary = quarterData.filter(d => d.salary > 0);

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
            <div className="ml-auto">
              <StaffPdfExport
                staff={staff}
                property={property}
                jobClass={jobClass}
                selectedYear={selectedYear}
                selectedMonth={selectedMonth}
              />
            </div>
          </div>

          {/* 4-column quarter grid */}
          <div className="grid grid-cols-4 divide-x divide-border">
            {quarterData.map(({ q, label, salary, kpiScore, maxPossible, bonus, bonusEarned, eligibility, rows }) => {
              const isPending = !salary;
              const paidOut = bonusEarned !== null ? bonusEarned * 0.5 : null;
              const held = bonusEarned !== null ? bonusEarned * 0.5 : null;

              return (
                <div key={q} className={`flex flex-col ${isPending ? 'opacity-50' : ''}`}>
                  {/* Quarter label */}
                  <div className="px-4 py-2.5 border-b border-border" style={{ background: '#2d4b5e' }}>
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

                      {/* Per-KPI Gate Badges */}
                      {bonus && (
                        <div className="flex flex-wrap gap-2">
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${bonus.gopPassed ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'}`}>
                            {bonus.gopPassed ? '✅ GOP — Passed' : '⚠️ GOP — Failed (no GOP bonus)'}
                          </span>
                          <span className={`rounded px-2 py-1 text-xs font-semibold ${bonus.marginPassed ? 'bg-green-50 text-green-800' : 'bg-orange-50 text-orange-800'}`}>
                            {bonus.marginPassed ? '✅ Margin — Passed' : '⚠️ Margin — Failed (no Margin bonus)'}
                          </span>
                        </div>
                      )}

                      {/* KPI rows */}
                      {rows.length > 0 ? (
                        <div className="space-y-0.5 border-t border-border/40 pt-2">
                          {rows.map(({ name, icon, pts, max, bonusPct, earned, detailLabel }) => (
                            <div key={name} className="flex items-center justify-between gap-1 text-xs">
                              <span className="flex items-center gap-1 min-w-0">
                                <span className="text-sm leading-none">{icon}</span>
                                <span className="text-muted-foreground truncate">{name}</span>
                              </span>
                              {detailLabel ? (
                                <span className="text-muted-foreground text-right whitespace-nowrap">{detailLabel}</span>
                              ) : (
                                <span className="flex items-center gap-2 whitespace-nowrap text-right">
                                  <span className="text-muted-foreground w-10 text-right">{pts != null ? `${pts}/${max}` : '—'}</span>
                                  <span className="text-muted-foreground w-8 text-right">{bonusPct}%</span>
                                  <span className="font-semibold text-foreground w-14 text-right">{fmt(earned)}</span>
                                </span>
                              )}
                            </div>
                          ))}
                          {/* Red Zone kicker row */}
                          {bonus?.redZoneKicker > 0 && (
                            <div className="flex items-center justify-between gap-1 text-xs text-red-700">
                              <span className="flex items-center gap-1">
                                <span>🔴</span>
                                <span>Red Zone Kicker (+25% GSS)</span>
                              </span>
                              <span className="font-semibold">{fmt(bonus.redZoneKicker)}</span>
                            </div>
                          )}
                          {/* Total row */}
                          <div className="flex items-center justify-between gap-1 text-xs border-t border-border/40 pt-1 mt-1">
                            <span className="font-bold text-foreground">Total</span>
                            <span className="flex items-center gap-2 whitespace-nowrap text-right">
                              <span className="text-foreground font-bold w-10 text-right">
                                {kpiScore !== null ? `${kpiScore}/${maxPossible}` : '—'}
                              </span>
                              <span className="text-foreground font-bold w-8 text-right">{maxBonusPct}%</span>
                              <span className="font-bold text-foreground w-14 text-right">
                                {bonusEarned !== null ? fmt(bonusEarned) : '—'}
                              </span>
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-2">No scorecard data yet.</p>
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

                      {!maxBonusPct && (
                        <p className="text-[10px] text-yellow-700 bg-yellow-50 rounded px-2 py-1">⚠ No bonus % configured.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Annual summary bar */}
          {quartersWithSalary.length > 0 && (
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
          )}

        </div>
      </td>
    </tr>
  );
}