import React from 'react';
import { AlertCircle, Check, X } from 'lucide-react';

export default function PayoutDetailCard({ staff, jobClass, bonus, salary, scorecard, entry }) {
  if (!staff || !jobClass || !bonus) {
    return null;
  }

  const metricRows = [
    {
      key: 'gop',
      label: 'Gross Operating Profit (GOP)',
      percentage: jobClass.gop_bonus_percentage,
      amount: bonus.gop,
      status: bonus.metricsHit.gop ? 'pass' : bonus.gopGatekeeperPassed === false ? 'gatekeeper_fail' : 'fail'
    },
    {
      key: 'gopMargin',
      label: 'GOP Margin Improvement',
      percentage: jobClass.gop_margin_bonus_percentage,
      amount: bonus.gopMargin,
      status: bonus.metricsHit.gopMargin ? 'pass' : bonus.gopGatekeeperPassed === false ? 'gatekeeper_fail' : 'fail'
    },
    {
      key: 'gss',
      label: 'GSS Improvement',
      percentage: jobClass.gss_bonus_percentage,
      amount: bonus.gss,
      status: bonus.metricsHit.gss ? 'pass' : 'fail'
    },
    {
      key: 'rgi',
      label: 'RGI Improvement',
      percentage: scorecard?.rgiChange >= 2.1 ? jobClass.rgi_bonus_percentage_high : jobClass.rgi_bonus_percentage_low,
      amount: bonus.rgi,
      status: bonus.metricsHit.rgi ? 'pass' : 'fail',
      tierNote: jobClass.title === 'General Manager' 
        ? (scorecard?.rgiChange >= 2.1 ? `Tier 2 (${jobClass.rgi_bonus_percentage_high}%)` : (scorecard?.rgiChange > 0 && scorecard?.rgiChange < 2.1) ? `Tier 1 (${jobClass.rgi_bonus_percentage_low}%)` : null)
        : null
    }
  ];

  const subtotalBeforeCap = bonus.total;
  const maxBonus = (salary * jobClass.max_bonus_percentage) / 100;
  const finalTotal = Math.min(subtotalBeforeCap, maxBonus);
  const quarterlyPayout = finalTotal * 0.5;
  const annualPayout = finalTotal * 0.5;

  // variance = actual − target (positive = earned more, negative = earned less)
  const diff = finalTotal - maxBonus;
  const diffPct = maxBonus > 0 ? ((diff / maxBonus) * 100).toFixed(0) : null;
  const diffColor = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b';
  const diffStr = diff === 0
    ? '$0'
    : `${diff > 0 ? '+' : '-'}$${Math.abs(Math.round(diff)).toLocaleString('en-US')}`;
  const diffPctStr = diffPct != null ? `${diff > 0 ? '+' : ''}${diffPct}%` : null;

  return (
    <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-6">
      {/* Header */}
      <div>
        <h3 className="font-bold text-lg mb-4">2026 Bonus Calculation — {staff.name}</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-1">Property</p>
            <p className="font-semibold">Selected Property</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Classification</p>
            <p className="font-semibold">{jobClass.title}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Annual Salary</p>
            <p className="font-semibold">${salary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-1">Max Bonus Potential</p>
            <p className="font-semibold">${maxBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })} ({jobClass.max_bonus_percentage}%)</p>
          </div>
        </div>
      </div>

      {/* GOP Gatekeeper Warning */}
      {bonus.gopGatekeeperMessage && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive text-sm">{bonus.gopGatekeeperMessage}</p>
            <p className="text-xs text-destructive/80 mt-1">GOP and GOP Margin bonuses are $0 until the gatekeeper condition is met.</p>
          </div>
        </div>
      )}

      {/* Metrics Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
              <th className="py-3 px-4 text-left font-semibold">Measure</th>
              <th className="py-3 px-4 text-center font-semibold">Bonus %</th>
              <th className="py-3 px-4 text-right font-semibold">Eligible Salary</th>
              <th className="py-3 px-4 text-right font-semibold">Calculated Bonus $</th>
              <th className="py-3 px-4 text-center font-semibold">Status</th>
              <th className="py-3 px-4 text-left font-semibold">Notes</th>
            </tr>
          </thead>
          <tbody>
            {metricRows.map((row) => (
              <tr key={row.key} className="border-t border-border hover:bg-muted/30">
                <td className="py-3 px-4 font-medium">{row.label}</td>
                <td className="py-3 px-4 text-center">{row.percentage}%</td>
                <td className="py-3 px-4 text-right">${salary.toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                <td className="py-3 px-4 text-right font-semibold">
                  ${row.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}
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
                      <X className="w-4 h-4" /> Gatekeeper
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 text-xs text-muted-foreground">
                  {row.status === 'gatekeeper_fail' && 'Gatekeeper not met'}
                  {row.status === 'fail' && row.key !== 'gop' && row.key !== 'gopMargin' && 'Metric not achieved'}
                  {row.status === 'pass' && (row.tierNote ? row.tierNote : 'Target met')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Subtotal and Split */}
      <div className="border-t border-border pt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-semibold">Subtotal (before cap)</span>
          <span className="font-bold text-lg">${subtotalBeforeCap.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>

        <div className="bg-muted/30 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Payout Split (50% / 50%)</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Quarterly Payout (50%)</p>
              <p className="font-bold text-navy text-lg">${quarterlyPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted-foreground mt-1">{((quarterlyPayout / salary) * 100).toFixed(2)}% of salary</p>
            </div>
            <div className="bg-white rounded p-3 border border-border">
              <p className="text-xs text-muted-foreground mb-1">Annual Payout (50%)</p>
              <p className="font-bold text-navy text-lg">${annualPayout.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-xs text-muted-foreground mt-1">{((annualPayout / salary) * 100).toFixed(2)}% of salary</p>
            </div>
          </div>
        </div>

        {/* Total */}
        <div className="rounded-lg p-4 mt-4" style={{ backgroundColor: '#2d4b5e' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-white/70 text-xs mb-1">ACTUAL BONUS</p>
              <p className="text-white font-bold text-2xl">${finalTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-white/80 text-xs mt-0.5">{((finalTotal / salary) * 100).toFixed(2)}% of salary</p>
            </div>
            <div>
              <p className="text-white/70 text-xs mb-1">TARGET BONUS (Max)</p>
              <p className="text-white font-bold text-2xl">${maxBonus.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
              <p className="text-white/80 text-xs mt-0.5">{jobClass.max_bonus_percentage}% of salary</p>
            </div>
            <div>
              <p className="text-white/70 text-xs mb-1">VS TARGET</p>
              <p className="font-bold text-2xl" style={{ color: diff > 0 ? '#86efac' : diff < 0 ? '#fca5a5' : '#cbd5e1' }}>{diffStr}</p>
              {diffPctStr && <p className="text-xs mt-0.5" style={{ color: diff > 0 ? '#86efac' : diff < 0 ? '#fca5a5' : '#cbd5e1' }}>{diffPctStr} of target</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}