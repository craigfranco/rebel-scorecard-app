import React, { useMemo } from 'react';
import { aggregateEntries, getQuarterMonths, getQuarterStartMonth } from '@/lib/aggregation';

function fmt$(val) {
  if (val == null) return '—';
  return '$' + Math.round(val).toLocaleString('en-US');
}

function fmtPct(val, decimals = 1) {
  if (val == null) return '—';
  return (val >= 0 ? '+' : '') + val.toFixed(decimals) + '%';
}

function fmtPts(val, decimals = 1) {
  if (val == null) return '—';
  return (val >= 0 ? '+' : '') + val.toFixed(decimals) + ' pts';
}

function fmtIdx(val) {
  if (val == null) return '—';
  return val.toFixed(1);
}

function Delta({ value, suffix = '%', decimals = 1 }) {
  if (value == null) return <span className="text-muted-foreground text-xs">—</span>;
  const pos = value >= 0;
  const sign = pos ? '+' : '';
  return (
    <span className="text-xs font-bold" style={{ color: pos ? '#4CAF50' : '#ef4444' }}>
      {sign}{value.toFixed(decimals)}{suffix}
    </span>
  );
}

function MetricRow({ label, value, sub }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <span className="text-sm font-bold text-foreground leading-tight">{value}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
    </div>
  );
}

function KpiCard({ title, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3 flex-1 min-w-0">
      <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}

function normalizeGss(score, brand) {
  if (score == null) return null;
  if (brand === 'Choice Hotels') return score * 10;
  if (brand === 'Independent') return score * 20;
  return score;
}

function getEntry(propEntries, periodType, selectedMonth, selectedYear, getPeriodMonths) {
  if (!propEntries.length) return null;
  const periodMonths = getPeriodMonths();
  const periodEntries = propEntries.filter(e =>
    periodMonths.includes(e.month) && e.year === selectedYear
  );
  if (!periodEntries.length) return null;
  if (periodType === 'month') return periodEntries[0] || null;
  return aggregateEntries(periodEntries, periodType, selectedMonth, selectedYear);
}

export default function PortfolioKpiRollup({ properties, allEntries, periodType, selectedMonth, selectedYear, getPeriodMonths }) {
  const stats = useMemo(() => {
    let gopActual = 0, gopBudget = 0, gopPrior = 0;
    let hasGop = false;

    // For weighted margin
    let tyMarginWeightedSum = 0, tyMarginWeight = 0;
    let lyMarginWeightedSum = 0, lyMarginWeight = 0;
    let budgetMarginSum = 0, budgetMarginCount = 0;

    // RGI
    let rgiTYSum = 0, rgiLYSum = 0, rgiChangeSum = 0, rgiCount = 0;

    // GSS
    let gssTYSum = 0, gssLYSum = 0, gssCount = 0;

    properties.forEach(prop => {
      const propEntries = allEntries.filter(e => e.property_id === prop.id);
      const entry = getEntry(propEntries, periodType, selectedMonth, selectedYear, getPeriodMonths);
      if (!entry) return;

      // GOP
      if (entry.budgeted_gop_actual != null) { gopActual += entry.budgeted_gop_actual; hasGop = true; }
      if (entry.budgeted_gop_target != null) gopBudget += entry.budgeted_gop_target;
      if (entry.budgeted_gop_prior != null) gopPrior += entry.budgeted_gop_prior;

      // GOP Margin (weighted by actual / prior GOP)
      if (entry.gop_margin_actual != null && entry.budgeted_gop_actual != null && entry.budgeted_gop_actual > 0) {
        tyMarginWeightedSum += entry.gop_margin_actual * entry.budgeted_gop_actual;
        tyMarginWeight += entry.budgeted_gop_actual;
      }
      if (entry.gop_margin_prior != null && entry.budgeted_gop_prior != null && entry.budgeted_gop_prior > 0) {
        lyMarginWeightedSum += entry.gop_margin_prior * entry.budgeted_gop_prior;
        lyMarginWeight += entry.budgeted_gop_prior;
      }
      if (entry.gop_margin_budget != null) { budgetMarginSum += entry.gop_margin_budget; budgetMarginCount++; }

      // RGI — derive LY index as TY / (1 + change/100)
      if (entry.revpar_index != null && entry.revpar_index_change != null) {
        rgiTYSum += entry.revpar_index;
        rgiLYSum += entry.revpar_index / (1 + entry.revpar_index_change / 100);
        rgiChangeSum += entry.revpar_index_change;
        rgiCount++;
      } else if (entry.revpar_index != null) {
        rgiTYSum += entry.revpar_index;
        rgiCount++;
      }

      // GSS (normalized)
      const gssActNorm = normalizeGss(entry.gss_actual, prop.parent_brand);
      const gssPriNorm = normalizeGss(entry.gss_prior, prop.parent_brand);
      if (gssActNorm != null && gssPriNorm != null) {
        gssTYSum += gssActNorm;
        gssLYSum += gssPriNorm;
        gssCount++;
      }
    });

    const tyMargin = tyMarginWeight > 0 ? tyMarginWeightedSum / tyMarginWeight : null;
    const lyMargin = lyMarginWeight > 0 ? lyMarginWeightedSum / lyMarginWeight : null;
    const budgetMargin = budgetMarginCount > 0 ? budgetMarginSum / budgetMarginCount : null;

    const rgiTY = rgiCount > 0 ? rgiTYSum / rgiCount : null;
    const rgiLY = rgiCount > 0 ? rgiLYSum / rgiCount : null;
    const rgiChange = rgiCount > 0 ? rgiChangeSum / rgiCount : null;

    const gssTY = gssCount > 0 ? gssTYSum / gssCount : null;
    const gssLY = gssCount > 0 ? gssLYSum / gssCount : null;

    const gopVariance = hasGop ? gopActual - gopBudget : null;
    return {
      gopActual: hasGop ? gopActual : null,
      gopBudget,
      gopPrior,
      gopVariance,
      gopPass: hasGop ? gopActual > gopBudget : null,
      gopYOY: (hasGop && gopPrior !== 0) ? ((gopActual - gopPrior) / Math.abs(gopPrior)) * 100 : null,
      // Achievement %: positive budget → Actual/Budget×100; negative budget → (Actual-Budget)/ABS(Budget)×100
      gopAchievement: hasGop && gopBudget !== 0
        ? gopBudget > 0
          ? (gopActual / gopBudget) * 100
          : ((gopActual - gopBudget) / Math.abs(gopBudget)) * 100
        : null,
      tyMargin, lyMargin, budgetMargin,
      marginYOY: tyMargin != null && lyMargin != null ? tyMargin - lyMargin : null,
      marginVsBudget: tyMargin != null && budgetMargin != null ? tyMargin - budgetMargin : null,
      rgiTY, rgiLY, rgiChange,
      gssTY, gssLY,
      gssYOY: gssTY != null && gssLY != null ? gssTY - gssLY : null,
    };
  }, [properties, allEntries, periodType, selectedMonth, selectedYear]);

  const s = stats;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* GOP Performance */}
      <KpiCard title="GOP Performance">
        <div>
          {(() => {
            const pass = s.gopVariance != null ? s.gopActual > s.gopBudget : null;
            const color = pass == null ? undefined : pass ? '#4CAF50' : '#ef4444';
            return (
              <>
                <div className="text-2xl font-black" style={{ color }}>
                  {s.gopVariance != null
                    ? `${s.gopVariance >= 0 ? '+' : '-'}$${Math.abs(Math.round(s.gopVariance)).toLocaleString('en-US')}`
                    : '—'}
                </div>
                <div className="text-xs text-muted-foreground">vs Budget</div>
                <div className="flex gap-4 pt-1 border-t border-border mt-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Target</span>
                    <span className="text-sm font-bold text-foreground">
                      {s.gopBudget != null ? `$${Math.round(s.gopBudget).toLocaleString('en-US')}` : '—'}
                    </span>
                    {s.gopPrior != null && (
                      <span className="text-xs text-muted-foreground" style={{ fontSize: '10px' }}>
                        LY: ${Math.round(s.gopPrior).toLocaleString('en-US')}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Achievement</span>
                    <span className="text-sm font-bold" style={{ color }}>
                      {s.gopAchievement != null ? `${pass && s.gopAchievement > 0 ? '+' : ''}${s.gopAchievement.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      </KpiCard>

      {/* GOP Margin */}
      <KpiCard title="GOP Margin Improvement (vs LY)">
        <div>
          <div className="text-xl font-black text-foreground leading-tight">
            {s.marginYOY != null
              ? <span style={{ color: s.marginYOY >= 0 ? '#4CAF50' : '#ef4444' }}>{s.marginYOY >= 0 ? '+' : ''}{s.marginYOY.toFixed(1)} pts vs LY</span>
              : '—'}
          </div>
          <div className="text-xs text-muted-foreground">TY vs prior year margin</div>
        </div>
        <div className="flex gap-4 pt-1 border-t border-border">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">TY Margin</span>
            <span className="text-sm font-bold text-foreground">{s.tyMargin != null ? s.tyMargin.toFixed(1) + '%' : '—'}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">LY Margin</span>
            <span className="text-sm font-bold text-foreground">{s.lyMargin != null ? s.lyMargin.toFixed(1) + '%' : '—'}</span>
          </div>
        </div>
      </KpiCard>

      {/* RevPAR Index */}
      <KpiCard title="RevPAR Index (RGI)">
        <div>
          <div className="text-2xl font-black" style={{ color: s.rgiChange == null ? undefined : s.rgiChange >= 0.1 ? '#4CAF50' : '#ef4444' }}>
            {s.rgiChange != null ? `${s.rgiChange >= 0 ? '+' : ''}${s.rgiChange.toFixed(1)}%` : '—'}
          </div>
          <div className="text-xs text-muted-foreground">YOY Change</div>
        </div>
        <div className="flex gap-4 pt-1 border-t border-border flex-wrap">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">TY Index</span>
            <span className="text-sm font-bold text-foreground">{fmtIdx(s.rgiTY)}</span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">LY Index</span>
            <span className="text-sm font-bold text-foreground">{fmtIdx(s.rgiLY)}</span>
          </div>
        </div>
      </KpiCard>

      {/* GSS Score */}
      <KpiCard title="GSS Score">
        <div>
          <div className="text-2xl font-black text-foreground">
            {s.gssTY != null ? s.gssTY.toFixed(1) : '—'}
          </div>
          <div className="text-xs text-muted-foreground">TY Score (out of 100)</div>
        </div>
        <div className="flex gap-4">
          <MetricRow label="Prior Year" value={s.gssLY != null ? s.gssLY.toFixed(1) : '—'} />
        </div>
        <div className="flex gap-4 pt-1 border-t border-border">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">YOY</span>
            <Delta value={s.gssYOY} suffix=" pts" decimals={1} />
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground italic">Normalized to 100-pt scale across brands</div>
      </KpiCard>
    </div>
  );
}