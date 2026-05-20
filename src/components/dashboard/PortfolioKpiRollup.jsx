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

      // RGI
      if (entry.revpar_index != null) {
        rgiTYSum += entry.revpar_index;
        rgiLYSum += (entry.revpar_index_prior ?? 0);
        rgiChangeSum += (entry.revpar_index_change ?? 0);
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

    return {
      gopActual: hasGop ? gopActual : null,
      gopBudget,
      gopPrior,
      gopYOY: (gopActual != null && gopPrior !== 0) ? ((gopActual - gopPrior) / Math.abs(gopPrior)) * 100 : null,
      gopVsBudget: (gopActual != null && gopBudget !== 0) ? ((gopActual - gopBudget) / Math.abs(gopBudget)) * 100 : null,
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
          <div className="text-2xl font-black text-foreground">{fmt$(s.gopActual)}</div>
          <div className="text-xs text-muted-foreground">TY Actual</div>
        </div>
        <div className="flex gap-4">
          <MetricRow label="Budget" value={fmt$(s.gopBudget)} />
          <MetricRow label="Prior Year" value={fmt$(s.gopPrior)} />
        </div>
        <div className="flex gap-4 pt-1 border-t border-border">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">YOY</span>
            <Delta value={s.gopYOY} suffix="%" />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">vs Budget</span>
            <Delta value={s.gopVsBudget} suffix="%" />
          </div>
        </div>
      </KpiCard>

      {/* GOP Margin */}
      <KpiCard title="GOP Margin">
        <div>
          <div className="text-2xl font-black text-foreground">
            {s.tyMargin != null ? s.tyMargin.toFixed(1) + '%' : '—'}
          </div>
          <div className="text-xs text-muted-foreground">TY Margin</div>
        </div>
        <div className="flex gap-4">
          <MetricRow label="Budget" value={s.budgetMargin != null ? s.budgetMargin.toFixed(1) + '%' : '—'} />
          <MetricRow label="Prior Year" value={s.lyMargin != null ? s.lyMargin.toFixed(1) + '%' : '—'} />
        </div>
        <div className="flex gap-4 pt-1 border-t border-border">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">YOY</span>
            <Delta value={s.marginYOY} suffix=" pts" decimals={1} />
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">vs Budget</span>
            <Delta value={s.marginVsBudget} suffix=" pts" decimals={1} />
          </div>
        </div>
      </KpiCard>

      {/* RevPAR Index */}
      <KpiCard title="RevPAR Index (RGI)">
        <div>
          <div className="text-2xl font-black text-foreground">{fmtIdx(s.rgiTY)}</div>
          <div className="text-xs text-muted-foreground">TY Index</div>
        </div>
        <div className="flex gap-4">
          <MetricRow label="Prior Year" value={fmtIdx(s.rgiLY)} />
        </div>
        <div className="flex gap-4 pt-1 border-t border-border">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wide">YOY Change</span>
            <Delta value={s.rgiChange} suffix="%" />
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