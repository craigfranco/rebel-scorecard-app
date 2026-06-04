import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Check, X } from 'lucide-react';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calculateEstimatedAnnualSalary, calculateActualYtdSalary, getClosedQuarters } from '@/lib/salaryCalculation';
import { calculateQuarterlyBonus, getMetricStatus } from '@/lib/bonusCalculation';

const QUARTER_DATES = {
  1: { label: 'Q1 2026', range: 'Jan 1 – Mar 31', months: [1, 2, 3] },
  2: { label: 'Q2 2026', range: 'Apr 1 – Jun 30', months: [4, 5, 6] },
  3: { label: 'Q3 2026', range: 'Jul 1 – Sep 30', months: [7, 8, 9] },
  4: { label: 'Q4 2026', range: 'Oct 1 – Dec 31', months: [10, 11, 12] },
};

export default function BonusPayoutDrillDown({ staff, property, jobClass, quarter, onClose }) {
  const closedQuarters = getClosedQuarters();

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

  const annualSalary = calculateEstimatedAnnualSalary(staff, closedQuarters);

  // YTD Salary: simply sum all quarters with salary entered (independent of bonus)
  const { total: ytdSalary, quarters: ytdSalaryQuarters } = calculateActualYtdSalary(staff);

  // Whether bonus % is configured
  const hasBonusPct = jobClass && (jobClass.max_bonus_percentage || 0) > 0;

  // Compute YTD running total using: salary_q[x] × max_bonus_pct × (KPI score / maxPossible)
  const ytdData = useMemo(() => {
    // Quarters that have salary data entered (bonus calc requires salary)
    const quartersWithSalary = [1, 2, 3, 4].filter(q => (staff[`salary_q${q}`] || 0) > 0);

    // Quarters that also have scorecard entries
    const quartersWithData = quartersWithSalary.filter(q => {
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
      return qEntries.length > 0;
    });

    const bonusPct = (jobClass?.max_bonus_percentage || 0) / 100;

    let bonusTotal = 0;
    const quarterBreakdown = [];

    for (const q of quartersWithData) {
      const qSalary = staff[`salary_q${q}`] || 0;
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
      const qEntry = aggregateQuarterEntries(qEntries);
      if (!qEntry) continue;
      const qScorecard = calculateScorecard(qEntry, property);
      if (!qScorecard) continue;

      const kpiScore = qScorecard.total?.total ?? 0;
      const maxPossible = qScorecard.total?.maxPossible ?? 100;
      const kpiRatio = maxPossible > 0 ? kpiScore / maxPossible : 0;

      // Quarterly Bonus = salary × max_bonus_pct × (kpi score / max possible)
      const qBonus = qSalary * bonusPct * kpiRatio;
      bonusTotal += qBonus;
      quarterBreakdown.push({ q, qSalary, kpiScore, maxPossible, kpiRatio, qBonus });
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

  // Calculate bonus details
  const scorecardData = latestEntry ? calculateScorecard(latestEntry, property) : null;
  const bonusData = latestEntry && scorecardData
    ? calculateQuarterlyBonus(
        { ...staff, annual_salary: annualSalary },
        scorecardData,
        jobClass,
        latestEntry
      )
    : null;

  // Get quarterly salary based on quarter
  const getQuarterlySalary = () => {
    switch (quarter) {
      case 1: return staff.salary_q1 || 0;
      case 2: return staff.salary_q2 || 0;
      case 3: return staff.salary_q3 || 0;
      case 4: return staff.salary_q4 || 0;
      default: return 0;
    }
  };
  const quarterlySalary = getQuarterlySalary();

  const metrics = useMemo(() => {
    if (!bonusData || !scorecardData) return [];
    const qSalary = getQuarterlySalary();
    return [
      {
        key: 'gop',
        label: 'Gross Operating Profit (GOP)',
        percentage: jobClass.gop_bonus_percentage,
        annual: (annualSalary * jobClass.gop_bonus_percentage) / 100,
        quarterly: (qSalary * jobClass.gop_bonus_percentage) / 100 * 0.5,
        status: bonusData.metricsHit.gop ? 'pass' : bonusData.gopGatekeeperPassed === false ? 'gatekeeper_fail' : 'fail',
        note: bonusData.gopGatekeeperPassed === false ? '⚠️ GOP Gatekeeper Not Met' : null,
        kpiResult: scorecardData.gopChange ? `${scorecardData.gopChange.toFixed(1)}% vs budget` : '—',
        kpiTarget: latestEntry ? `$${latestEntry.budgeted_gop_target?.toLocaleString() || '—'}` : '—',
        kpiActual: latestEntry ? `$${latestEntry.budgeted_gop_actual?.toLocaleString() || '—'}` : '—',
        kpiVariance: latestEntry ? `${scorecardData.gopChange?.toFixed(1)}%` : '—',
      },
      {
        key: 'gopMargin',
        label: 'GOP Margin Improvement',
        percentage: jobClass.gop_margin_bonus_percentage,
        annual: (annualSalary * jobClass.gop_margin_bonus_percentage) / 100,
        quarterly: (qSalary * jobClass.gop_margin_bonus_percentage) / 100 * 0.5,
        status: bonusData.metricsHit.gopMargin ? 'pass' : bonusData.gopGatekeeperPassed === false ? 'gatekeeper_fail' : 'fail',
        note: bonusData.gopGatekeeperPassed === false ? '⚠️ GOP Gatekeeper Not Met' : null,
        kpiResult: scorecardData.gopMarginChange ? `${scorecardData.gopMarginChange.toFixed(2)} pts improvement` : '—',
        kpiTarget: latestEntry ? `${latestEntry.gop_margin_prior?.toFixed(2)}% (prior)` : '—',
        kpiActual: latestEntry ? `${latestEntry.gop_margin_actual?.toFixed(2)}%` : '—',
        kpiVariance: latestEntry ? `${scorecardData.gopMarginChange?.toFixed(2)} pts` : '—',
      },
      {
        key: 'gss',
        label: 'GSS Improvement',
        percentage: jobClass.gss_bonus_percentage,
        annual: (annualSalary * jobClass.gss_bonus_percentage) / 100,
        quarterly: (qSalary * jobClass.gss_bonus_percentage) / 100 * 0.5,
        status: bonusData.metricsHit.gss ? 'pass' : 'fail',
        kpiResult: scorecardData.gssChange ? `${scorecardData.gssChange.toFixed(2)} pts vs prior` : '—',
        kpiTarget: latestEntry ? `${latestEntry.gss_prior?.toFixed(2)} (prior)` : '—',
        kpiActual: latestEntry ? `${latestEntry.gss_actual?.toFixed(2)}` : '—',
        kpiVariance: latestEntry ? `${scorecardData.gssChange?.toFixed(2)} pts` : '—',
      },
      {
        key: 'rgi',
        label: 'RGI Improvement',
        percentage: scorecardData?.rgiChange >= 2.1 ? jobClass.rgi_bonus_percentage_high : jobClass.rgi_bonus_percentage_low,
        annual: scorecardData?.rgiChange >= 2.1
          ? (annualSalary * jobClass.rgi_bonus_percentage_high) / 100
          : (annualSalary * jobClass.rgi_bonus_percentage_low) / 100,
        quarterly: scorecardData?.rgiChange >= 2.1
          ? (qSalary * jobClass.rgi_bonus_percentage_high) / 100 * 0.5
          : (qSalary * jobClass.rgi_bonus_percentage_low) / 100 * 0.5,
        status: bonusData.metricsHit.rgi ? 'pass' : 'fail',
        tierNote: jobClass.title === 'General Manager'
          ? (scorecardData?.rgiChange >= 2.1 ? `Tier 2 (${jobClass.rgi_bonus_percentage_high}%)` : `Tier 1 (${jobClass.rgi_bonus_percentage_low}%)`)
          : null,
        kpiResult: scorecardData?.rgiChange ? `${scorecardData.rgiChange.toFixed(2)}% YoY change` : '—',
        kpiTarget: latestEntry ? `${latestEntry.revpar_index_prior?.toFixed(1)} (prior index)` : '—',
        kpiActual: latestEntry ? `${latestEntry.revpar_index?.toFixed(1)}` : '—',
        kpiVariance: latestEntry ? `${scorecardData.rgiChange?.toFixed(2)}%` : '—',
      },
    ];
  }, [bonusData, scorecardData, jobClass, annualSalary, quarter, staff, latestEntry]);

  const quarterlySubtotal = metrics.reduce((sum, m) => sum + (m.status === 'pass' ? m.quarterly : 0), 0);
  const annualSubtotal = metrics.reduce((sum, m) => sum + (m.status === 'pass' ? m.annual : 0), 0);
  const maxQuarterlyBonus = (quarterlySalary * jobClass.max_bonus_percentage) / 100;
  const maxAnnualBonus = (annualSalary * jobClass.max_bonus_percentage) / 100;
  const finalQuarterlyBonus = Math.min(quarterlySubtotal, maxQuarterlyBonus);
  const finalAnnualBonus = Math.min(annualSubtotal, maxAnnualBonus);
  const maxBonus = maxAnnualBonus;

  // Target payout = full max bonus potential (100% achievement)
  // vs Target differential helpers
  const fmtDiff = (actual, target) => {
    if (!target) return null;
    const diff = actual - target;
    const pct = ((diff / target) * 100).toFixed(0);
    const dollarStr = diff === 0
      ? '$0'
      : `${diff > 0 ? '+' : '-'}$${Math.abs(Math.round(diff)).toLocaleString('en-US')}`;
    const pctStr = `${diff > 0 ? '+' : ''}${pct}%`;
    return { diff, dollarStr, pctStr, positive: diff > 0, zero: diff === 0 };
  };

  const qDiff = fmtDiff(finalQuarterlyBonus, maxQuarterlyBonus);
  const totalProjected = finalQuarterlyBonus + finalAnnualBonus * 0.5;
  const totalTarget = maxQuarterlyBonus + maxAnnualBonus * 0.5;
  const totalDiff = fmtDiff(totalProjected, totalTarget);

  const StatusBadge = ({ status }) => {
    if (status === 'pass') return <span className="inline-flex items-center gap-1 text-pass font-semibold text-xs"><Check className="w-4 h-4" /> Pass</span>;
    if (status === 'gatekeeper_fail') return <span className="inline-flex items-center gap-1 text-fail font-semibold text-xs"><X className="w-4 h-4" /> Gatekeeper</span>;
    return <span className="inline-flex items-center gap-1 text-fail font-semibold text-xs"><X className="w-4 h-4" /> Fail</span>;
  };

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
        <div>
          <h3 className="font-bold text-lg">{QUARTER_DATES[quarter].label} — Quarterly Breakdown</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {quarter === 1 ? 'Period close: March 31, 2026' :
             quarter === 2 ? 'Period close: June 30, 2026' :
             quarter === 3 ? 'Period close: September 30, 2026' :
             'Period close: December 31, 2026'}
          </p>
        </div>

        {/* KPI Detail Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
                <th className="py-3 px-4 text-left font-semibold">Metric</th>
                <th className="py-3 px-4 text-center font-semibold">KPI Target</th>
                <th className="py-3 px-4 text-center font-semibold">KPI Actual</th>
                <th className="py-3 px-4 text-center font-semibold">Bonus %</th>
                <th className="py-3 px-4 text-right font-semibold">Bonus Earned</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key} className="border-t border-border hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium text-xs">{m.label}{m.tierNote && <span className="ml-1 text-muted-foreground">({m.tierNote})</span>}</td>
                  <td className="py-3 px-4 text-center text-xs text-muted-foreground">{m.kpiTarget}</td>
                  <td className="py-3 px-4 text-center text-xs font-semibold">{m.kpiActual}</td>
                  <td className="py-3 px-4 text-center text-xs">{m.percentage}%</td>
                  <td className="py-3 px-4 text-right text-xs font-semibold">
                    {m.status === 'pass' ? `$${(m.quarterly * 2).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center"><StatusBadge status={m.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Paid Out Now vs Rolls to Annual split */}
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header row */}
          <div className="bg-muted/50 px-5 py-3 border-b border-border flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {QUARTER_DATES[quarter].label} — Bonus Earned: <span className="text-foreground font-bold">${(quarterlySubtotal * 2).toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
            </span>
            {scorecardData && (
              <span className="text-xs font-semibold text-muted-foreground">
                KPI Score: <span className="text-foreground font-bold">{scorecardData.total?.total ?? '—'}/{scorecardData.total?.maxPossible ?? 100}</span>
              </span>
            )}
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
            <p className="font-black text-2xl text-green-700">${finalQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>

          {/* Rolls to Annual */}
          <div className="flex items-center justify-between px-5 py-4 bg-blue-50">
            <div className="flex items-center gap-3">
              <span className="text-xl">🔄</span>
              <div>
                <p className="font-bold text-blue-800 text-sm uppercase tracking-wide">Rolls to Annual</p>
                <p className="text-blue-700 text-xs mt-0.5">50% — Accumulates, paid at year-end (Dec 31, 2026)</p>
              </div>
            </div>
            <p className="font-black text-2xl text-blue-700">${finalQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
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
            {quarterBreakdown.map(({ q, qSalary, kpiScore, maxPossible, kpiRatio, qBonus }) => (
              <div key={q} className="flex items-center justify-between px-5 py-3 bg-muted/20 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-muted-foreground w-6">Q{q}</span>
                  <span className="text-xs text-muted-foreground">
                    ${qSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })} × {jobClass.max_bonus_percentage}% × {kpiScore}/{maxPossible} pts
                  </span>
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