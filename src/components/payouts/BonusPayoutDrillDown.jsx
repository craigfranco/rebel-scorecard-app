import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Check, X } from 'lucide-react';
import { calculateScorecard, getQuarterFromMonth } from '@/lib/scoring';
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

  // Get most recent entry for this quarter
  const quarterEntries = entries.filter(e => {
    const q = getQuarterFromMonth(e.month);
    return q === quarter;
  });
  const latestEntry = quarterEntries.length > 0
    ? quarterEntries.reduce((latest, curr) => curr.month > latest.month ? curr : latest)
    : null;

  const annualSalary = calculateEstimatedAnnualSalary(staff, closedQuarters);
  const q1Salary = staff.salary_q1 || 0;

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

  const metrics = useMemo(() => {
    if (!bonusData || !scorecardData) return [];
    return [
      {
        key: 'gop',
        label: 'Gross Operating Profit (GOP)',
        percentage: jobClass.gop_bonus_percentage,
        annual: (annualSalary * jobClass.gop_bonus_percentage) / 100,
        quarterly: (annualSalary * jobClass.gop_bonus_percentage) / 100 * 0.5,
        status: bonusData.metricsHit.gop ? 'pass' : bonusData.gopGatekeeperPassed === false ? 'gatekeeper_fail' : 'fail',
        note: bonusData.gopGatekeeperPassed === false ? '⚠️ GOP Gatekeeper Not Met' : null,
        kpiResult: scorecardData.gopChange ? `${scorecardData.gopChange.toFixed(1)}% vs budget` : '—',
      },
      {
        key: 'gopMargin',
        label: 'GOP Margin Improvement',
        percentage: jobClass.gop_margin_bonus_percentage,
        annual: (annualSalary * jobClass.gop_margin_bonus_percentage) / 100,
        quarterly: (annualSalary * jobClass.gop_margin_bonus_percentage) / 100 * 0.5,
        status: bonusData.metricsHit.gopMargin ? 'pass' : bonusData.gopGatekeeperPassed === false ? 'gatekeeper_fail' : 'fail',
        note: bonusData.gopGatekeeperPassed === false ? '⚠️ GOP Gatekeeper Not Met' : null,
        kpiResult: scorecardData.gopMarginChange ? `${scorecardData.gopMarginChange.toFixed(2)} pts improvement` : '—',
      },
      {
        key: 'gss',
        label: 'GSS Improvement',
        percentage: jobClass.gss_bonus_percentage,
        annual: (annualSalary * jobClass.gss_bonus_percentage) / 100,
        quarterly: (annualSalary * jobClass.gss_bonus_percentage) / 100 * 0.5,
        status: bonusData.metricsHit.gss ? 'pass' : 'fail',
        kpiResult: scorecardData.gssChange ? `${scorecardData.gssChange.toFixed(2)} pts vs prior` : '—',
      },
      {
        key: 'rgi',
        label: 'RGI Improvement',
        percentage: scorecardData?.rgiChange >= 2.1 ? jobClass.rgi_bonus_percentage_high : jobClass.rgi_bonus_percentage_low,
        annual: scorecardData?.rgiChange >= 2.1
          ? (annualSalary * jobClass.rgi_bonus_percentage_high) / 100
          : (annualSalary * jobClass.rgi_bonus_percentage_low) / 100,
        quarterly: scorecardData?.rgiChange >= 2.1
          ? (annualSalary * jobClass.rgi_bonus_percentage_high) / 100 * 0.5
          : (annualSalary * jobClass.rgi_bonus_percentage_low) / 100 * 0.5,
        status: bonusData.metricsHit.rgi ? 'pass' : 'fail',
        tierNote: jobClass.title === 'General Manager'
          ? (scorecardData?.rgiChange >= 2.1 ? `Tier 2 (${jobClass.rgi_bonus_percentage_high}%)` : `Tier 1 (${jobClass.rgi_bonus_percentage_low}%)`)
          : null,
        kpiResult: scorecardData?.rgiChange ? `${scorecardData.rgiChange.toFixed(2)}% YoY change` : '—',
      },
    ];
  }, [bonusData, scorecardData, jobClass, annualSalary]);

  const quarterlySubtotal = metrics.reduce((sum, m) => sum + (m.status === 'pass' ? m.quarterly : 0), 0);
  const annualSubtotal = metrics.reduce((sum, m) => sum + (m.status === 'pass' ? m.annual : 0), 0);
  const maxBonus = (annualSalary * jobClass.max_bonus_percentage) / 100;
  const finalBonus = Math.min(annualSubtotal, maxBonus);
  const quarterlyPayout = finalBonus * 0.5;
  const annualPayout = finalBonus * 0.5;

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
            <p className="text-muted-foreground text-xs mb-1">Q1 Salary</p>
            <p className="font-bold text-lg">${q1Salary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Estimated Annual Salary</p>
            <p className="font-bold text-lg">${annualSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-muted-foreground text-xs mt-1">(Q1 × 4)</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Max Bonus Potential</p>
            <p className="font-bold text-lg">${maxBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-muted-foreground text-xs mt-1">({jobClass?.max_bonus_percentage}%)</p>
          </div>
          <div className="bg-card rounded-lg p-4 border border-border">
            <p className="text-muted-foreground text-xs mb-1">Total Projected Bonus</p>
            <p className="font-bold text-lg text-navy">${finalBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-muted-foreground text-xs mt-1">{((finalBonus / annualSalary) * 100).toFixed(1)}% of salary</p>
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
          <p className="text-xs text-muted-foreground">This amount is paid at end of {QUARTER_DATES[quarter].label.split(' ')[0]}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
                <th className="py-3 px-4 text-left font-semibold">Metric</th>
                <th className="py-3 px-4 text-center font-semibold">Bonus %</th>
                <th className="py-3 px-4 text-center font-semibold">Salary Base</th>
                <th className="py-3 px-4 text-right font-semibold">Potential Bonus $</th>
                <th className="py-3 px-4 text-center font-semibold">KPI Result</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key} className="border-t border-border hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{m.label}</td>
                  <td className="py-3 px-4 text-center">{m.percentage}%</td>
                  <td className="py-3 px-4 text-center">${annualSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="py-3 px-4 text-right font-semibold">${m.quarterly.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="py-3 px-4 text-center text-xs text-muted-foreground">{m.kpiResult}</td>
                  <td className="py-3 px-4 text-center"><StatusBadge status={m.status} /></td>
                </tr>
              ))}
              <tr className="border-t border-border font-bold text-white" style={{ backgroundColor: '#2d4b5e' }}>
                <td colSpan="5" className="py-3 px-4 text-right">QUARTERLY SUBTOTAL (50%)</td>
                <td className="py-3 px-4 text-right">${quarterlySubtotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Annual Bonus Table */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-bold text-lg mb-2">Full Year Annual Payout — 50% Component (Projected)</h3>
          <p className="text-xs text-muted-foreground">This amount is paid at year-end based on full year performance</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
                <th className="py-3 px-4 text-left font-semibold">Metric</th>
                <th className="py-3 px-4 text-center font-semibold">Bonus %</th>
                <th className="py-3 px-4 text-center font-semibold">Salary Base</th>
                <th className="py-3 px-4 text-right font-semibold">Potential Bonus $</th>
                <th className="py-3 px-4 text-center font-semibold">KPI Result</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key} className="border-t border-border hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{m.label}</td>
                  <td className="py-3 px-4 text-center">{m.percentage}%</td>
                  <td className="py-3 px-4 text-center">${annualSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="py-3 px-4 text-right font-semibold">${m.annual.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                  <td className="py-3 px-4 text-center text-xs text-muted-foreground">{m.kpiResult}</td>
                  <td className="py-3 px-4 text-center"><StatusBadge status={m.status} /></td>
                </tr>
              ))}
              <tr className="border-t border-border font-bold text-white" style={{ backgroundColor: '#2d4b5e' }}>
                <td colSpan="5" className="py-3 px-4 text-right">ANNUAL SUBTOTAL (50%)</td>
                <td className="py-3 px-4 text-right">${annualSubtotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="rounded-lg p-6" style={{ backgroundColor: '#2d4b5e' }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 text-white text-sm">
          <div>
            <p className="text-white/70 text-xs mb-1">Q1 Quarterly Payout (50%)</p>
            <p className="font-bold text-2xl">${quarterlyPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Projected Annual Payout (50%)</p>
            <p className="font-bold text-2xl">${annualPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">TOTAL PROJECTED BONUS</p>
            <p className="font-bold text-2xl">${finalBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">As % of Est. Annual Salary</p>
            <p className="font-bold text-2xl">{((finalBonus / annualSalary) * 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Max Possible Bonus</p>
            <p className="font-bold text-2xl">${maxBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Achievement</p>
            <p className="font-bold text-2xl">{((finalBonus / maxBonus) * 100).toFixed(0)}% of max</p>
          </div>
        </div>
      </div>
    </div>
  );
}