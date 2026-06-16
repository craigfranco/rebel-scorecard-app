import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calculateActualYtdSalary } from '@/lib/salaryCalculation';
import { calcKpiBonus, checkBonusEligibility } from '@/lib/bonusCalculation';

const QUARTER_DATES = {
  1: { label: 'Q1 2026', range: 'Jan 1 – Mar 31', months: [1, 2, 3] },
  2: { label: 'Q2 2026', range: 'Apr 1 – Jun 30', months: [4, 5, 6] },
  3: { label: 'Q3 2026', range: 'Jul 1 – Sep 30', months: [7, 8, 9] },
  4: { label: 'Q4 2026', range: 'Oct 1 – Dec 31', months: [10, 11, 12] },
};

export default function BonusPayoutDrillDown({ staff, property, jobClass, quarter, onClose }) {
  // Fetch scorecard entries for this quarter
  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries-quarterly', property?.id, quarter],
    queryFn: () =>
      property?.id
        ? base44.entities.ScoreEntry.filter({ property_id: property.id, year: 2026 })
        : Promise.resolve([]),
  });

  // Aggregate all entries for this quarter (same logic as AllProperties/HotelDetail)
  const quarterEntries = entries.filter(e => getQuarterFromMonth(e.month) === quarter);
  const latestEntry = aggregateQuarterEntries(quarterEntries);

  // YTD Salary: simply sum all quarters with salary entered (independent of bonus)
  const { total: ytdSalary, quarters: ytdSalaryQuarters } = calculateActualYtdSalary(staff);

  // Whether bonus % is configured
  const hasBonusPct = jobClass && (jobClass.max_bonus_percentage || 0) > 0;

  // Compute YTD running total using per-KPI bonus amounts, gated by RGI+GSS eligibility.
  const ytdData = useMemo(() => {
    const quartersWithSalary = [1, 2, 3, 4].filter(q => (staff[`salary_q${q}`] || 0) > 0);
    const quartersWithData = quartersWithSalary.filter(q => {
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
      return qEntries.length > 0;
    });

    let bonusTotal = 0;
    const quarterBreakdown = [];

    for (const q of quartersWithData) {
      const qSalary = staff[`salary_q${q}`] || 0;
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
      const qEntry = aggregateQuarterEntries(qEntries);
      if (!qEntry) continue;
      const qScorecard = calculateScorecard(qEntry, property);
      if (!qScorecard) continue;

      const eligibility = checkBonusEligibility(qScorecard);
      const bonusResult = calcKpiBonus(qSalary, qScorecard, jobClass);
      const qBonus = bonusResult.total; // already $0 if not eligible

      bonusTotal += qBonus;
      quarterBreakdown.push({ q, qSalary, qBonus, eligible: eligibility.eligible, eligibilityReason: eligibility.reason, rgiMet: eligibility.rgiMet, gssMet: eligibility.gssMet });
    }

    return {
      quartersWithSalary,
      quartersWithData,
      quarterBreakdown,
      bonusTotal,
      paidOut: bonusTotal * 0.5,
      rolling: bonusTotal * 0.5,
      quarterLabel: quartersWithData.length === 0
        ? (quartersWithSalary.length > 0 ? quartersWithSalary.map(q => `Q${q}`).join(' + ') : 'No data yet')
        : quartersWithData.map(q => `Q${q}`).join(' + '),
      salaryLabel: quartersWithSalary.length === 0 ? 'No data yet' : quartersWithSalary.map(q => `Q${q}`).join(' + '),
    };
  }, [entries, staff, property, jobClass]);

  const { quartersWithSalary, quartersWithData, quarterBreakdown, ytdPaidOut, ytdRolling, ytdQuarterLabel, ytdSalaryLabel } = {
    quartersWithSalary: ytdData.quartersWithSalary,
    quartersWithData: ytdData.quartersWithData,
    quarterBreakdown: ytdData.quarterBreakdown,
    ytdPaidOut: ytdData.paidOut,
    ytdRolling: ytdData.rolling,
    ytdQuarterLabel: ytdData.quarterLabel,
    ytdSalaryLabel: ytdData.salaryLabel,
  };
  const ytdBonusTotal = ytdData.bonusTotal;

  // Quarterly salary for the viewed quarter
  const quarterlySalary = staff[`salary_q${quarter}`] || 0;

  // Scorecard for the viewed quarter (used for KPI table display only)
  const scorecardData = latestEntry ? calculateScorecard(latestEntry, property) : null;
  const thisQEligibility = scorecardData ? checkBonusEligibility(scorecardData) : null;

  // Max bonus potential for the viewed quarter (display only)
  const maxQuarterlyBonus = (quarterlySalary * (jobClass.max_bonus_percentage || 0)) / 100;

  // THIS quarter's bonus from ytdData breakdown — single source of truth
  const thisQuarterBreakdown = ytdData.quarterBreakdown.find(b => b.q === quarter);
  // Full bonus for this quarter (before 50/50 split)
  const thisQuarterBonusEarned = thisQuarterBreakdown?.qBonus ?? 0;
  // 50% paid out now, 50% held
  const thisQuarterPaidOut = thisQuarterBonusEarned * 0.5;
  const thisQuarterHeld = thisQuarterBonusEarned * 0.5;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" onClick={onClose} className="mb-4 gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Staff List
        </Button>

        <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
          <h1 className="text-2xl font-bold mb-4">{staff.name}</h1>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-white/70 text-xs mb-1">Property</p>
              <p className="font-semibold">{property?.name}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs mb-1">Classification</p>
              <p className="font-semibold">{jobClass?.title}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs mb-1">Quarter</p>
              <p className="font-semibold">{QUARTER_DATES[quarter].label}</p>
            </div>
            <div>
              <p className="text-white/70 text-xs mb-1">Period</p>
              <p className="font-semibold text-xs">{QUARTER_DATES[quarter].range}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 text-sm">
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Q{quarter} Salary</p>
            <p className="font-bold text-lg">${quarterlySalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">{ytdSalaryQuarters.length === 4 ? 'Annual Total Salary' : `YTD Salary (${ytdSalaryQuarters.map(q => `Q${q}`).join('+') || '—'})`}</p>
            <p className="font-bold text-lg">{ytdSalary > 0 ? `$${ytdSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}</p>
            <p className="text-muted-foreground text-xs mt-1">Sum of entered quarters only</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Q{quarter} Max Bonus Potential</p>
            <p className="font-bold text-lg">${maxQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-muted-foreground text-xs mt-1">{quarterlySalary > 0 ? ((maxQuarterlyBonus / quarterlySalary) * 100).toFixed(0) : '0'}% of Q{quarter} salary</p>
          </div>
        </div>
      </div>

      {/* No Data Warning */}
      {!latestEntry && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> No scorecard data entered for {QUARTER_DATES[quarter].label}. Showing maximum potential only.
          </p>
        </div>
      )}

      {/* Quarterly Breakdown Card */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-lg">{QUARTER_DATES[quarter].label} — Quarterly Breakdown</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {quarter === 1 ? 'Period close: March 31, 2026' :
               quarter === 2 ? 'Period close: June 30, 2026' :
               quarter === 3 ? 'Period close: September 30, 2026' :
               'Period close: December 31, 2026'}
            </p>
          </div>
          {/* Eligibility badge */}
        {thisQEligibility && (
          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${thisQEligibility.eligible ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
            {thisQEligibility.eligible ? '✅ Eligible — RGI & GSS met' : `❌ Not Eligible — ${thisQEligibility.reason}`}
          </span>
        )}
        </div>

        {/* Eligibility explanation */}
        {thisQEligibility && !thisQEligibility.eligible && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-800">
            <span className="font-semibold">No bonus this quarter.</span> Eligibility requires both RGI Improvement (≥0.1% YOY) and GSS Improvement to be met.
            {!thisQEligibility.rgiMet && <span className="block mt-1">• RGI Improvement: ❌ Not met</span>}
            {!thisQEligibility.gssMet && <span className="block mt-1">• GSS Improvement: ❌ Not met</span>}
          </div>
        )}

        {!latestEntry || !thisQuarterBreakdown ? (
          <div className="rounded-xl border border-border bg-muted/30 px-5 py-6 text-center">
            <p className="text-muted-foreground text-sm">No scorecard data entered for {QUARTER_DATES[quarter].label}. Enter KPI data to calculate this quarter's bonus.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            {/* Bonus Earned header */}
            <div className="bg-muted/50 px-5 py-3 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {QUARTER_DATES[quarter].label} — Total Bonus Earned
              </span>
              <span className="text-foreground font-bold">${thisQuarterBonusEarned.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>

            {/* Paid Out Now */}
            <div className="flex items-center justify-between px-5 py-4 bg-green-50 border-b border-green-100">
              <div className="flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="font-bold text-green-800 text-sm uppercase tracking-wide">Paid Out Now</p>
                  <p className="text-green-700 text-xs mt-0.5">50% — Quarterly check issued after period close</p>
                </div>
              </div>
              <p className="font-black text-2xl text-green-700">${thisQuarterPaidOut.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>

            {/* Held for Year-End */}
            <div className="flex items-center justify-between px-5 py-4 bg-blue-50">
              <div className="flex items-center gap-3">
                <span className="text-xl">🔄</span>
                <div>
                  <p className="font-bold text-blue-800 text-sm uppercase tracking-wide">Held for Year-End</p>
                  <p className="text-blue-700 text-xs mt-0.5">50% — Accumulates, paid at year-end (Dec 31, 2026)</p>
                </div>
              </div>
              <p className="font-black text-2xl text-blue-700">${thisQuarterHeld.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        )}
      </div>

      {/* YTD Running Total */}
      <div className="bg-card rounded-2xl border-2 border-border p-6 shadow-sm space-y-5">
        <div>
          <h3 className="font-bold text-lg">
            {quartersWithSalary.length === 4 ? 'Annual Running Total' : 'YTD Running Total'}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Salary totals based on entered quarters only — no extrapolation
          </p>
        </div>

        {/* 1. YTD Salary Running Total — always shown */}
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 bg-muted/30">
            <div>
              <p className="font-bold text-sm">YTD Salary: {ytdSalaryLabel}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sum of {quartersWithSalary.map(q => `Q${q}`).join(' + ')} salaries
              </p>
            </div>
            <p className="font-black text-2xl">
              {ytdSalary > 0 ? `$${ytdSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—'}
            </p>
          </div>
        </div>

        {/* 2 & 3. Payout + Holdback — only if bonus % is configured */}
        {!hasBonusPct ? (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 px-5 py-4">
            <p className="text-sm text-yellow-800 font-medium">
              ⚠ Set bonus target % to calculate payouts
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              No max bonus percentage is configured for the <strong>{jobClass?.title}</strong> classification. Edit the job classification to enable payout calculations.
            </p>
          </div>
        ) : quartersWithData.length === 0 ? (
          <div className="rounded-xl border border-border bg-muted/30 px-5 py-6 text-center">
            <p className="text-muted-foreground text-sm">
              No scorecard data entered yet for quarters with salary.
              Payout totals will appear once KPI data is entered.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {/* Per-quarter breakdown */}
            {quarterBreakdown.map(({ q, qSalary, qBonus, eligible, eligibilityReason }) => (
              <div key={q} className="flex items-center justify-between px-5 py-3 bg-muted/20 text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-muted-foreground w-6">Q{q}</span>
                  <span className="text-xs text-muted-foreground">
                    ${qSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })} salary
                  </span>
                  {eligible
                    ? <span className="text-xs text-green-700 font-medium">✅ Eligible</span>
                    : <span className="text-xs text-red-700 font-medium">❌ {eligibilityReason}</span>}
                </div>
                <span className="font-semibold text-xs">${qBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
              </div>
            ))}

            {/* Total Bonus Earned */}
            <div className="flex items-center justify-between px-5 py-3 bg-muted/40">
              <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                Total Bonus Earned ({ytdQuarterLabel})
              </span>
              <span className="font-bold text-sm">${ytdBonusTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </div>

            {/* Paid Out */}
            <div className="flex items-center justify-between px-5 py-4 bg-green-50">
              <div className="flex items-center gap-3">
                <span className="text-lg">✅</span>
                <div>
                  <p className="font-bold text-green-800 text-sm">Total Paid Out</p>
                  <p className="text-green-700 text-xs">50% per quarter — checks issued after each period close</p>
                </div>
              </div>
              <p className="font-black text-xl text-green-700">${ytdPaidOut.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>

            {/* Held for Year-End */}
            <div className="flex items-center justify-between px-5 py-4 bg-blue-50">
              <div className="flex items-center gap-3">
                <span className="text-lg">🔄</span>
                <div>
                  <p className="font-bold text-blue-800 text-sm">Held for Year-End</p>
                  <p className="text-blue-700 text-xs">50% accumulated · Paid Dec 31, 2026</p>
                </div>
              </div>
              <p className="font-black text-xl text-blue-700">${ytdRolling.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}