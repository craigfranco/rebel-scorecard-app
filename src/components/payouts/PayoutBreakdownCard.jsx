import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CURRENT_DATE = new Date('2026-04-07');

const getAvailablePeriods = () => {
  const periods = [];
  
  // Q1 ends March 31: show if current date >= April 1
  if (CURRENT_DATE >= new Date('2026-04-01')) {
    periods.push({ value: 'q1', label: 'Q1' });
  }
  
  // Q2 ends June 30: show if current date >= July 1
  if (CURRENT_DATE >= new Date('2026-07-01')) {
    periods.push({ value: 'q2', label: 'Q2' });
  }
  
  // Q3 ends September 30: show if current date >= October 1
  if (CURRENT_DATE >= new Date('2026-10-01')) {
    periods.push({ value: 'q3', label: 'Q3' });
  }
  
  // Q4 ends December 31: show if current date >= January 1
  if (CURRENT_DATE >= new Date('2027-01-01')) {
    periods.push({ value: 'q4', label: 'Q4' });
  }
  
  // Full Year only after Q4 ends
  if (CURRENT_DATE >= new Date('2027-01-01')) {
    periods.push({ value: 'annual', label: 'Full Year' });
  }
  
  return periods;
};

export default function PayoutBreakdownCard({ staff, jobClass, bonus, salary, scorecard, entry }) {
  const availablePeriods = getAvailablePeriods();
  const defaultPeriod = availablePeriods.length > 0 ? availablePeriods[0].value : 'q1';
  const [selectedPeriod, setSelectedPeriod] = useState(defaultPeriod);

  if (!staff || !jobClass || !bonus) return null;

  const annualSalary = salary;
  const q1Salary = staff.salary_q1 || 0;
  const q2Salary = staff.salary_q2 || 0;
  const q3Salary = staff.salary_q3 || 0;
  const q4Salary = staff.salary_q4 || 0;

  const getQuarterlySalary = (period) => {
    switch (period) {
      case 'q1': return q1Salary;
      case 'q2': return q2Salary;
      case 'q3': return q3Salary;
      case 'q4': return q4Salary;
      default: return annualSalary;
    }
  };

  const getCurrentSalary = getQuarterlySalary(selectedPeriod);
  const isAnnual = selectedPeriod === 'annual';

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

  // Render metric table
  const renderMetricTable = () => {
    const pct = isAnnual ? 100 : 50;
    const singlePeriodLabel = `(${pct}%)`;

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
              const annualCalc = (annualSalary * row.percentage) / 100;
              const displayAmount = isAnnual ? annualCalc : annualCalc * 0.5;

              return (
                <tr key={row.key} className="border-t border-border hover:bg-muted/30">
                  <td className="py-3 px-4 font-medium">{row.label}</td>
                  <td className="py-3 px-4 text-center">{row.percentage}%</td>
                  <td className="py-3 px-4 text-right">
                    ${getCurrentSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}
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

            {/* Total Row */}
            <tr className="border-t border-border font-bold text-white" style={{ backgroundColor: '#2d4b5e' }}>
              <td colSpan="4" className="py-3 px-4 text-right">
                {isAnnual ? 'ANNUAL TOTAL' : 'QUARTERLY TOTAL'}
              </td>
              <td className="py-3 px-4 text-right">
                ${isAnnual ? annualPayoutTotal.toLocaleString('en-US', { maximumFractionDigits: 0 }) : (quarterlyPayoutTotal / 4).toLocaleString('en-US', { maximumFractionDigits: 0 })}
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
            <p className="text-muted-foreground text-xs mb-1">Annual Salary</p>
            <p className="font-semibold">${annualSalary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
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
      </div>
      <p className="text-xs text-muted-foreground">Quarters are unlocked as they close. Q2 closes June 30, 2026.</p>

      {/* Metric Table */}
      {renderMetricTable()}

      {/* Summary Bar */}
      <div className="rounded-lg p-4" style={{ backgroundColor: '#2d4b5e' }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white text-sm">
          <div>
            <p className="text-white/70 text-xs mb-1">Quarterly Payout (50%)</p>
            <p className="font-bold text-lg">${quarterlyPayoutTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Annual Payout (50%)</p>
            <p className="font-bold text-lg">${annualPayoutTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">Total Bonus</p>
            <p className="font-bold text-lg">${finalTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-white/70 text-xs mb-1">As % of Salary</p>
            <p className="font-bold text-lg">{((finalTotal / annualSalary) * 100).toFixed(2)}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}