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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 text-sm">
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Q{quarter} Salary</p>
            <p className="font-bold text-lg">${quarterlySalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Estimated Annual Salary</p>
            <p className="font-bold text-lg">${annualSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-muted-foreground text-xs mt-1">(sum of quarterly salaries)</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Max Bonus Potential</p>
            <p className="font-bold text-lg">${maxQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="font-bold text-lg text-navy">${finalQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-muted-foreground text-xs mt-1">{quarterlySalary > 0 ? ((finalQuarterlyBonus / quarterlySalary) * 100).toFixed(1) : '0'}% of Q{quarter} salary</p>
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

        {/* Payout Split Box */}
        <div className="rounded-xl border-2 border-border overflow-hidden">
          {/* Context row */}
          <div className="bg-muted/40 px-5 py-3 border-b border-border flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Quarterly Salary: <strong className="text-foreground">${quarterlySalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong></span>
              <span>Bonus Target: <strong className="text-foreground">${maxQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong> ({jobClass.max_bonus_percentage}% of salary)</span>
              {scorecardData && <span>KPI Score: <strong className="text-foreground">{scorecardData.total?.total ?? '—'}/{scorecardData.total?.maxPossible ?? 100}</strong></span>}
            </div>
          </div>

          {/* Full payout — most prominent */}
          <div className="flex items-center justify-between px-5 py-5 bg-foreground/5 border-b border-border">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Full Bonus Earned</p>
              <p className="text-xs text-muted-foreground">100% of bonus for this quarter</p>
            </div>
            <p className="font-black text-3xl text-foreground">${(finalQuarterlyBonus * 2).toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>

          {/* 50/50 split — indented below the full amount */}
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="flex flex-col justify-between px-5 py-4 bg-green-50 gap-1">
              <div className="flex items-center gap-2">
                <span className="text-base">✅</span>
                <p className="font-bold text-green-800 text-sm uppercase tracking-wide">Paid This Quarter</p>
              </div>
              <p className="text-green-700 text-xs">50% — quarterly payment now</p>
              <p className="font-black text-2xl text-green-700 mt-1">${finalQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="flex flex-col justify-between px-5 py-4 bg-blue-50 gap-1">
              <div className="flex items-center gap-2">
                <span className="text-base">🔄</span>
                <p className="font-bold text-blue-800 text-sm uppercase tracking-wide">Held to Year-End</p>
              </div>
              <p className="text-blue-700 text-xs">50% — paid Dec 31, 2026</p>
              <p className="font-black text-2xl text-blue-700 mt-1">${finalQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Annual Running Total */}
      {(() => {
        // Only sum quarters that actually have salary AND scorecard data entered
        const completedQBonus = finalQuarterlyBonus; // this quarter's earned bonus (full, pre-split)
        const fullBonusEarned = finalQuarterlyBonus * 2; // full (100%) for this quarter
        const paidOutQuarterly = finalQuarterlyBonus;    // 50% already out
        const heldForYearEnd = finalQuarterlyBonus;      // 50% held

        return (
          <div className="bg-card rounded-2xl border-2 border-border shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-border" style={{ backgroundColor: '#1e3547' }}>
              <h3 className="font-bold text-white text-base uppercase tracking-wide">
                Annual Running Total — {QUARTER_DATES[quarter].label}
              </h3>
              <p className="text-white/60 text-xs mt-0.5">Based only on completed quarters with actual data entered</p>
            </div>

            {/* Total earned — most prominent */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-foreground/5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-0.5">Total Bonus Earned (Full)</p>
                <p className="text-xs text-muted-foreground">100% of bonus earned this quarter</p>
              </div>
              <p className="font-black text-3xl text-foreground">${fullBonusEarned.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>

            {/* Split rows */}
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <div className="px-6 py-4 bg-green-50">
                <div className="flex items-center gap-2 mb-1">
                  <span>✅</span>
                  <p className="font-bold text-green-800 text-sm">Paid Out Quarterly</p>
                </div>
                <p className="text-green-700 text-xs mb-2">50% — quarterly payments already issued</p>
                <p className="font-black text-2xl text-green-700">${paidOutQuarterly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
              <div className="px-6 py-4 bg-blue-50">
                <div className="flex items-center gap-2 mb-1">
                  <span>🔄</span>
                  <p className="font-bold text-blue-800 text-sm">Held for Year-End</p>
                </div>
                <p className="text-blue-700 text-xs mb-2">50% — accumulates, paid Dec 31, 2026</p>
                <p className="font-black text-2xl text-blue-700">${heldForYearEnd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              </div>
            </div>

            {/* Year-end payment due */}
            <div className="flex items-center justify-between px-6 py-4" style={{ backgroundColor: '#2d4b5e' }}>
              <div>
                <p className="font-bold text-white text-sm uppercase tracking-wide">Year-End Payment Due</p>
                <p className="text-white/60 text-xs">50% rollover · Paid Dec 31, 2026</p>
              </div>
              <p className="font-black text-2xl text-white">${heldForYearEnd.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}