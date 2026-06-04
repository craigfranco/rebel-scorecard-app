import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const getClosedQuarters = () => {
  const today = new Date();
  const closedQuarters = [];
  if (today >= new Date('2026-04-01')) closedQuarters.push(1); // Q1 closed Mar 31
  if (today >= new Date('2026-07-01')) closedQuarters.push(2); // Q2 closed Jun 30
  if (today >= new Date('2026-10-01')) closedQuarters.push(3); // Q3 closed Sep 30
  if (today >= new Date('2027-01-01')) closedQuarters.push(4); // Q4 closed Dec 31
  return closedQuarters;
};

const CURRENT_DATE = new Date('2026-04-07');

const QUARTER_INFO = [
  { value: 'q1', label: 'Q1', closeDate: new Date('2026-03-31'), unlockDate: 'March 31, 2026', quarterNum: 1 },
  { value: 'q2', label: 'Q2', closeDate: new Date('2026-06-30'), unlockDate: 'July 1, 2026', quarterNum: 2 },
  { value: 'q3', label: 'Q3', closeDate: new Date('2026-09-30'), unlockDate: 'Oct 1, 2026', quarterNum: 3 },
  { value: 'q4', label: 'Q4', closeDate: new Date('2026-12-31'), unlockDate: 'Jan 1, 2027', quarterNum: 4 }
];

const getAvailablePeriods = () => {
  // Only show quarters where the close date has passed
  const closedQuarters = getClosedQuarters();
  return QUARTER_INFO.filter(q => closedQuarters.includes(q.quarterNum));
};

const getLockedPeriods = () => {
  // Show locked quarters where the close date has NOT passed
  const closedQuarters = getClosedQuarters();
  return QUARTER_INFO.filter(q => !closedQuarters.includes(q.quarterNum));
};

export default function PayoutBreakdownCard({ staff, jobClass, bonus, salary, scorecard, entry }) {
  const availablePeriods = getAvailablePeriods();
  const defaultPeriod = availablePeriods.length > 0 ? availablePeriods[0].value : 'q1';
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  if (!staff || !jobClass || !bonus) return null;

  const annualSalary = salary;
  const getQuarterlySalary = (period) => {
    if (period === 'q1') return staff.salary_q1 || 0;
    if (period === 'q2') return staff.salary_q2 || 0;
    if (period === 'q3') return staff.salary_q3 || 0;
    if (period === 'q4') return staff.salary_q4 || 0;
    return 0;
  };
  const quarterlySalary = getQuarterlySalary(selectedPeriod);

  // Build metric rows
  const metricRows = [
    {
      key: 'gop',
      label: 'Gross Operating Profit (GOP)',
      percentage: jobClass.gop_bonus_percentage,
      bonusAmount: bonus.gop,
      status: bonus.metricsHit.gop ? 'pass' : bonus.gopGatekeeperPassed === false ? 'gatekeeper_fail' : 'fail',
      note: bonus.gopGatekeeperPassed === false ? 'Gatekeeper failed' : null
    },
    {
      key: 'gopMargin',
      label: 'GOP Margin Improvement',
      percentage: jobClass.gop_margin_bonus_percentage,
      bonusAmount: bonus.gopMargin,
      status: bonus.metricsHit.gopMargin ? 'pass' : bonus.gopGatekeeperPassed === false ? 'gatekeeper_fail' : 'fail',
      note: bonus.gopGatekeeperPassed === false ? 'Gatekeeper failed' : null
    },
    {
      key: 'gss',
      label: 'GSS Improvement',
      percentage: jobClass.gss_bonus_percentage,
      bonusAmount: bonus.gss,
      status: bonus.metricsHit.gss ? 'pass' : 'fail'
    },
    {
      key: 'rgi',
      label: 'RGI Improvement',
      percentage: scorecard?.rgiChange >= 2.1 ? jobClass.rgi_bonus_percentage_high : jobClass.rgi_bonus_percentage_low,
      bonusAmount: bonus.rgi,
      status: bonus.metricsHit.rgi ? 'pass' : 'fail',
      tierNote: jobClass.title === 'General Manager'
        ? (scorecard?.rgiChange >= 2.1 ? `Tier 2 (${jobClass.rgi_bonus_percentage_high}%)` : (scorecard?.rgiChange > 0 && scorecard?.rgiChange < 2.1) ? `Tier 1 (${jobClass.rgi_bonus_percentage_low}%)` : null)
        : null
    }
  ];

  // Calculate totals
  const subtotalAnnual = bonus.total;
  const maxBonus = (annualSalary * jobClass.max_bonus_percentage) / 100;
  const finalTotal = Math.min(subtotalAnnual, maxBonus);
  const quarterlyPayoutTotal = finalTotal * 0.5;
  const annualPayoutTotal = finalTotal * 0.5;

  const totalDiff = finalTotal - maxBonus;
  const totalDiffPct = maxBonus > 0 ? ((totalDiff / maxBonus) * 100).toFixed(0) : null;
  const totalDiffStr = `${totalDiff >= 0 ? '+' : '-'}$${Math.abs(Math.round(totalDiff)).toLocaleString('en-US')}`;
  const totalDiffPctStr = totalDiffPct != null ? `${totalDiff >= 0 ? '+' : ''}${totalDiffPct}%` : null;

  // Render metric table
  const renderMetricTable = () => {
    const isQuarterly = selectedPeriod.match(/q\d/);
    const pct = isQuarterly ? 50 : 100;
    const singlePeriodLabel = `(${pct}%)`;
    const salaryBase = isQuarterly ? quarterlySalary : annualSalary;

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
              <th className="py-3 px-4 text-left font-semibold">Measure</th>
              <th className="py-3 px-4 text-center font-semibold">Bonus %</th>
              <th className="py-3 px-4 text-right font-semibold">Salary Base</th>
              <th className="py-3 px-4 text-right font-semibold">Calculated $ {singlePeriodLabel}</th>
              <th className="py-3 px-4 text-center font-semibold">Status</th>
              <th className="py-3 px-4 text-left font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => {
              const displayAmount = (salaryBase * row.percentage) / 100;
              return (
                <tr key={row.key} className="border-t border-border hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{row.label}</td>
                  <td className="py-3 px-4 text-center">{row.percentage}%</td>
                  <td className="py-3 px-4 text-right">
                    ${salaryBase.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-3 px-4 text-right font-semibold">
                    ${displayAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {row.status === 'pass' && (
                      <span className="inline-flex items-center gap-1 text-pass font-semibold text-xs">
                        <Check className="w-4 h-4" /> Pass
                      </span>
                    )}
                    {row.status === 'fail' && (
                      <span className="inline-flex items-center gap-1 text-fail font-semibold text-xs">
                        <X className="w-4 h-4" /> Fail
                      </span>
                    )}
                    {row.status === 'gatekeeper_fail' && (
                      <span className="inline-flex items-center gap-1 text-fail font-semibold text-xs">
                        <X className="w-4 h-4" /> Gate
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {row.tierNote || row.note || (row.status === 'pass' ? 'Target met' : '')}
                  </td>
                </tr>
              );
            })}
            <tr className="border-t border-border font-bold text-white" style={{ backgroundColor: '#2d4b5e' }}>
              <td colSpan="4" className="py-3 px-4 text-right">
                {isQuarterly ? 'QUARTERLY TOTAL' : 'ANNUAL TOTAL'}
              </td>
              <td className="py-3 px-4 text-right">
                ${isQuarterly ? quarterlyPayoutTotal.toLocaleString('en-US', { maximumFractionDigits: 0 }) : annualPayoutTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </td>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-bold text-lg mb-4">2026 Bonus Calculation — {staff.name}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Classification</p>
            <p className="font-semibold">{jobClass.title}</p>
          </div>
          <div>
             <p className="text-muted-foreground text-xs mb-1">Estimated Annual Salary</p>
             <p className="font-semibold">${annualSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })} <span className="text-xs text-muted-foreground">(Q1 × 4)</span></p>
           </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Max Bonus Potential</p>
            <p className="font-semibold">${maxBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })} ({jobClass.max_bonus_percentage}%)</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Total Bonus</p>
            <p className="font-semibold text-navy">${finalTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex flex-wrap gap-2">
        {availablePeriods.map((period) => (
          <Button
            key={period.value}
            onClick={() => setSelectedPeriod(period.value)}
            variant={selectedPeriod === period.value ? 'default' : 'outline'}
            size="sm"
            style={selectedPeriod === period.value ? { backgroundColor: '#2d4b5e' } : {}}
          >
            {period.label}
          </Button>
        ))}
        {getLockedPeriods().map((period) => (
          <Button
            key={`locked-${period.value}`}
            disabled
            variant="outline"
            size="sm"
            title={`${period.label} unlocks ${period.unlockDate}`}
            className="opacity-40 cursor-not-allowed"
          >
            {period.label} 🔒
          </Button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Only closed quarters are displayed. Q2 unlocks July 1, 2026.</p>

      {/* Metric Table */}
      {renderMetricTable()}

      {/* Summary Bar */}
      <div className="rounded-lg p-4" style={{ backgroundColor: '#2d4b5e' }}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-white text-sm">
          <div>
            <p className="text-white/70 text-xs mb-1">Actual Bonus</p>
            <p className="font-bold text-lg">${finalTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-white/60 text-xs mt-0.5">{((finalTotal / annualSalary) * 100).toFixed(2)}% of salary</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Target Bonus (Max)</p>
            <p className="font-bold text-lg">${maxBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-white/60 text-xs mt-0.5">{jobClass.max_bonus_percentage}% of salary</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">vs Target</p>
            <p className="font-bold text-lg" style={{ color: totalDiff >= 0 ? '#86efac' : '#fca5a5' }}>{totalDiffStr}</p>
            {totalDiffPctStr && <p className="text-xs mt-0.5" style={{ color: totalDiff >= 0 ? '#86efac' : '#fca5a5' }}>{totalDiffPctStr} of target</p>}
          </div>
        </div>
      </div>
    </div>
  );
}