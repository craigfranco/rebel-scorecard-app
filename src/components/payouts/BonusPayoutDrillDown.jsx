import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Check, X } from 'lucide-react';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calculateEstimatedAnnualSalary, getClosedQuarters } from '@/lib/salaryCalculation';
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
    const sign = diff >= 0 ? '+' : '';
    const dollarStr = `${sign}$${Math.abs(Math.round(diff)).toLocaleString('en-US')}`;
    const pctStr = `${sign}${pct}%`;
    return { diff, dollarStr, pctStr, color: diff >= 0 ? '#16a34a' : '#dc2626' };
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

      {/* Quarterly Bonus Table */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-lg mb-2">{QUARTER_DATES[quarter].label} Quarterly Payout — 50% Component</h3>
          <p className="text-xs text-muted-foreground">
            {quarter === 1 ? 'Paid after the close of Q1 (March 31, 2026)' :
             quarter === 2 ? 'Paid after the close of Q2 (June 30, 2026)' :
             quarter === 3 ? 'Paid after the close of Q3 (September 30, 2026)' :
             'Paid after the close of Q4 (December 31, 2026)'}
          </p>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead>
               <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
                 <th className="py-3 px-4 text-left font-semibold">Metric</th>
                 <th className="py-3 px-4 text-center font-semibold">KPI Target</th>
                 <th className="py-3 px-4 text-center font-semibold">KPI Actual</th>
                 <th className="py-3 px-4 text-center font-semibold">vs Target</th>
                 <th className="py-3 px-4 text-center font-semibold">Bonus %</th>
                 <th className="py-3 px-4 text-center font-semibold">Salary Base</th>
                 <th className="py-3 px-4 text-right font-semibold">Bonus $</th>
                 <th className="py-3 px-4 text-center font-semibold">Status</th>
               </tr>
             </thead>
             <tbody>
               {metrics.map((m) => (
                 <tr key={m.key} className="border-t border-border hover:bg-muted/30">
                   <td className="py-3 px-4 font-medium text-xs">{m.label}</td>
                   <td className="py-3 px-4 text-center text-xs text-muted-foreground">{m.kpiTarget}</td>
                   <td className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">{m.kpiActual}</td>
                   <td className="py-3 px-4 text-center text-xs text-muted-foreground">{m.kpiVariance}</td>
                   <td className="py-3 px-4 text-center text-xs">{m.percentage}%</td>
                   <td className="py-3 px-4 text-center text-xs">${quarterlySalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                   <td className="py-3 px-4 text-right text-xs font-semibold">${m.quarterly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                   <td className="py-3 px-4 text-center"><StatusBadge status={m.status} /></td>
                 </tr>
               ))}
              <tr className="border-t-2 border-white/20 font-bold" style={{ backgroundColor: '#1e3547' }}>
                <td colSpan="5" className="py-3 px-4 text-right text-white text-xs">TARGET (Max Potential)</td>
                <td className="py-3 px-4 text-center text-white/70 text-xs">${quarterlySalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className="py-3 px-4 text-right text-white font-bold">${maxQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td></td>
              </tr>
              <tr className="border-t border-white/20 font-bold text-white" style={{ backgroundColor: '#2d4b5e' }}>
                <td colSpan="6" className="py-3 px-4 text-right">QUARTERLY ACTUAL (50%)</td>
                <td className="py-3 px-4 text-right">${quarterlySubtotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td></td>
              </tr>
              {qDiff && (
                <tr className="border-t border-white/10 font-bold" style={{ backgroundColor: '#2d4b5e' }}>
                  <td colSpan="6" className="py-2 px-4 text-right text-white/80 text-xs">vs Target</td>
                  <td className="py-2 px-4 text-right text-xs font-bold" style={{ color: qDiff.color === '#16a34a' ? '#86efac' : '#fca5a5' }}>
                    {qDiff.dollarStr} ({qDiff.pctStr})
                  </td>
                  <td></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Annual Bonus Table */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-lg mb-2">Full Year Annual Payout — 50% Component (Projected)</h3>
          <p className="text-xs text-muted-foreground">Annual component paid at year-end after the close of Q4 (December 31, 2026)</p>
        </div>

        <div className="overflow-x-auto">
           <table className="w-full text-sm">
             <thead>
               <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
                 <th className="py-3 px-4 text-left font-semibold">Metric</th>
                 <th className="py-3 px-4 text-center font-semibold">KPI Target</th>
                 <th className="py-3 px-4 text-center font-semibold">KPI Actual</th>
                 <th className="py-3 px-4 text-center font-semibold">vs Target</th>
                 <th className="py-3 px-4 text-center font-semibold">Bonus %</th>
                 <th className="py-3 px-4 text-center font-semibold">Salary Base</th>
                 <th className="py-3 px-4 text-right font-semibold">Bonus $</th>
                 <th className="py-3 px-4 text-center font-semibold">Status</th>
               </tr>
             </thead>
             <tbody>
               {metrics.map((m) => (
                 <tr key={m.key} className="border-t border-border hover:bg-muted/30">
                   <td className="py-3 px-4 font-medium text-xs">{m.label}</td>
                   <td className="py-3 px-4 text-center text-xs text-muted-foreground">{m.kpiTarget}</td>
                   <td className="py-3 px-4 text-center text-xs text-muted-foreground font-semibold">{m.kpiActual}</td>
                   <td className="py-3 px-4 text-center text-xs text-muted-foreground">{m.kpiVariance}</td>
                   <td className="py-3 px-4 text-center text-xs">{m.percentage}%</td>
                   <td className="py-3 px-4 text-center text-xs">${annualSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                   <td className="py-3 px-4 text-right text-xs font-semibold">${m.annual.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                   <td className="py-3 px-4 text-center"><StatusBadge status={m.status} /></td>
                 </tr>
               ))}
              <tr className="border-t-2 border-white/20 font-bold" style={{ backgroundColor: '#1e3547' }}>
                <td colSpan="5" className="py-3 px-4 text-right text-white text-xs">TARGET (Max Potential)</td>
                <td className="py-3 px-4 text-center text-white/70 text-xs">${annualSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className="py-3 px-4 text-right text-white font-bold">${maxAnnualBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td></td>
              </tr>
              <tr className="border-t border-white/20 font-bold text-white" style={{ backgroundColor: '#2d4b5e' }}>
                <td colSpan="6" className="py-3 px-4 text-right">ANNUAL ACTUAL (50%)</td>
                <td className="py-3 px-4 text-right">${annualSubtotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td></td>
              </tr>
              {fmtDiff(annualSubtotal, maxAnnualBonus) && (() => {
                const d = fmtDiff(annualSubtotal, maxAnnualBonus);
                return (
                  <tr className="border-t border-white/10 font-bold" style={{ backgroundColor: '#2d4b5e' }}>
                    <td colSpan="6" className="py-2 px-4 text-right text-white/80 text-xs">vs Target</td>
                    <td className="py-2 px-4 text-right text-xs font-bold" style={{ color: d.color === '#16a34a' ? '#86efac' : '#fca5a5' }}>
                      {d.dollarStr} ({d.pctStr})
                    </td>
                    <td></td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="rounded-lg p-6" style={{ backgroundColor: '#2d4b5e' }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-white text-sm">
          <div>
            <p className="text-white/70 text-xs mb-1">Q{quarter} Actual Payout</p>
            <p className="font-bold text-2xl">${finalQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Q{quarter} Target Payout (Max)</p>
            <p className="font-bold text-2xl">${maxQuarterlyBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">vs Target</p>
            {qDiff ? (
              <p className="font-bold text-2xl" style={{ color: qDiff.color === '#16a34a' ? '#86efac' : '#fca5a5' }}>
                {qDiff.dollarStr}
              </p>
            ) : <p className="font-bold text-2xl">—</p>}
            {qDiff && <p className="text-xs mt-0.5" style={{ color: qDiff.color === '#16a34a' ? '#86efac' : '#fca5a5' }}>{qDiff.pctStr} of target</p>}
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Total Projected Bonus</p>
            <p className="font-bold text-2xl">${totalProjected.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Total Target Bonus</p>
            <p className="font-bold text-2xl">${totalTarget.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Total vs Target</p>
            {totalDiff ? (
              <p className="font-bold text-2xl" style={{ color: totalDiff.color === '#16a34a' ? '#86efac' : '#fca5a5' }}>
                {totalDiff.dollarStr}
              </p>
            ) : <p className="font-bold text-2xl">—</p>}
            {totalDiff && <p className="text-xs mt-0.5" style={{ color: totalDiff.color === '#16a34a' ? '#86efac' : '#fca5a5' }}>{totalDiff.pctStr} of target</p>}
          </div>
        </div>
      </div>
    </div>
  );
}