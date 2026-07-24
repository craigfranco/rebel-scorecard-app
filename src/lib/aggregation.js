// Comprehensive aggregation logic for Balanced Scorecard time periods

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const QUARTERS = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];

export function getQuarterFromMonth(month) {
  return Math.ceil(month / 3);
}

export function getQuarterMonths(quarter) {
  const start = (quarter - 1) * 3 + 1;
  return [start, start + 1, start + 2];
}

export function getQuarterStartMonth(quarter) {
  return (quarter - 1) * 3 + 1;
}

/**
 * Finds a quarterly RGI override for a given property / year / quarter.
 * When present, the aggregated RGI fields are replaced with the exact
 * STR-published quarterly figures (instead of averaging monthly snapshots).
 */
function findRgiOverride(overrides, propertyId, year, quarter) {
  if (!overrides || !overrides.length || !propertyId) return null;
  return overrides.find(o =>
    o.property_id === propertyId &&
    o.year === year &&
    o.quarter === quarter
  ) || null;
}

function applyRgiOverride(result, overrides, propertyId, year, quarter) {
  const ov = findRgiOverride(overrides, propertyId, year, quarter);
  if (!ov) return result;
  const patched = { ...result };
  if (ov.revpar_index != null) patched.revpar_index = ov.revpar_index;
  if (ov.revpar_index_change != null) patched.revpar_index_change = ov.revpar_index_change;
  if (ov.revpar_index_prior != null) patched.revpar_index_prior = ov.revpar_index_prior;
  patched.rgi_source = 'quarterly_report';
  return patched;
}

/**
 * Aggregates ScoreEntry data based on time period type
 *
 * Rules:
 * - Dollar amounts (budgeted_gop_actual, budgeted_gop_target, budgeted_gop_prior,
 *   forecast_actual_revenue, forecast_primary_forecast): SUM
 * - Percentage/index metrics (gop_margin_actual, gop_margin_prior, gop_margin_budget,
 *   gop_margin_variance, revpar_index, revpar_index_change, gss_actual, gss_prior): AVERAGE
 * - Forecast result (Hit/Miss): Hit only if ALL months hit
 * - Red zone kicker: Hit only if ALL months hit
 *
 * rgiOverrides: optional array of RgiQuarterlyReport records. When the period is a
 * full quarter and an override exists, RGI fields use the quarterly report's exact
 * values instead of the monthly average.
 */
export function aggregateEntries(entries, periodType, selectedMonth, selectedYear, rgiOverrides = []) {
  if (!entries || entries.length === 0) return null;

  let filteredEntries = [];

  // Filter entries based on period type
  if (periodType === 'month') {
    filteredEntries = entries.filter(e => e.month === selectedMonth && e.year === selectedYear);
  } else if (periodType === 'quarter') {
    const quarter = getQuarterFromMonth(selectedMonth);
    const quarterMonths = getQuarterMonths(quarter);
    filteredEntries = entries.filter(e =>
      quarterMonths.includes(e.month) &&
      e.year === selectedYear
    );
  } else if (periodType === 'qtd') {
    const quarter = getQuarterFromMonth(selectedMonth);
    const quarterStart = getQuarterStartMonth(quarter);
    filteredEntries = entries.filter(e =>
      e.month >= quarterStart &&
      e.month <= selectedMonth &&
      e.year === selectedYear
    );
  } else if (periodType === 'ytd') {
    // YTD: Jan through selectedMonth (ytdEndMonth) of selectedYear
    filteredEntries = entries.filter(e =>
      e.year === selectedYear && e.month >= 1 && e.month <= selectedMonth
    );
  }

  if (filteredEntries.length === 0) return null;

  // Sort by month
  const sorted = [...filteredEntries].sort((a, b) => a.month - b.month);
  const last = sorted[sorted.length - 1];

  // SUM fields (dollar amounts)
  const sumField = (field) => {
    const values = sorted.filter(e => e[field] != null).map(e => e[field]);
    if (values.length === 0) return null;
    return values.reduce((sum, val) => sum + val, 0);
  };

  // AVERAGE fields (percentages/indices)
  const avgField = (field) => {
    const values = sorted.filter(e => e[field] != null).map(e => e[field]);
    if (values.length === 0) return null;
    const sum = values.reduce((s, v) => s + v, 0);
    return Math.round((sum / values.length) * 100) / 100;
  };

  // GOP MARGIN: compute per-month improvement (actual - prior), then average those improvements.
  // This is the correct method per spec: avg improvement ≥ 0.1% → PASS.
  const monthlyMarginImprovements = sorted
    .filter(e => e.gop_margin_actual != null && e.gop_margin_prior != null)
    .map(e => e.gop_margin_actual - e.gop_margin_prior);
  const avgMarginImprovement = monthlyMarginImprovements.length > 0
    ? Math.round((monthlyMarginImprovements.reduce((s, v) => s + v, 0) / monthlyMarginImprovements.length) * 10000) / 10000
    : null;

  // Dollar-weighted actual margin: sum(GOP) / sum(Revenue) × 100
  // Matches budget-margin methodology; falls back to simple average when revenue is missing.
  const totalActualGop = sumField('budgeted_gop_actual');
  const totalActualRevenue = sumField('forecast_actual_revenue');
  const calculatedActualMargin = (totalActualGop != null && totalActualRevenue != null && totalActualRevenue !== 0)
    ? Math.round((totalActualGop / totalActualRevenue) * 100 * 100) / 100
    : avgField('gop_margin_actual');
  // Revenue-weighted prior margin: weight each month's prior margin by current-year revenue,
  // making the LY figure directly comparable to the TY dollar-weighted margin (same revenue weights).
  const priorMarginEntries = sorted.filter(e => e.gop_margin_prior != null && e.forecast_actual_revenue != null);
  const calculatedPriorMargin = priorMarginEntries.length > 0
    ? (() => {
        const totalRev = priorMarginEntries.reduce((s, e) => s + e.forecast_actual_revenue, 0);
        return totalRev !== 0
          ? Math.round((priorMarginEntries.reduce((s, e) => s + e.gop_margin_prior * e.forecast_actual_revenue, 0) / totalRev) * 100) / 100
          : avgField('gop_margin_prior');
      })()
    : avgField('gop_margin_prior');

  const totalBudgetGOP = sumField('budgeted_gop_target');
  const totalBudgetRevenue = sumField('forecast_primary_forecast');

  const calculatedBudgetMargin = (totalBudgetGOP != null && totalBudgetRevenue != null && totalBudgetRevenue !== 0)
    ? Math.round((totalBudgetGOP / totalBudgetRevenue) * 100 * 100) / 100
    : null;

  const calculatedVariance = (calculatedActualMargin != null && calculatedBudgetMargin != null)
    ? Math.round((calculatedActualMargin - calculatedBudgetMargin) * 100) / 100
    : null;

  // ALL fields (boolean kickers - must all be true)
  const allField = (field) => {
    const values = sorted.filter(e => e[field] != null).map(e => e[field]);
    if (values.length === 0) return false;
    return values.every(v => v === true);
  };

  // Forecast result: Hit only if ALL months hit
  const forecastResults = sorted.filter(e => e.forecast_result).map(e => e.forecast_result);
  const forecastResult = forecastResults.length > 0 && forecastResults.every(r => r === 'Hit') ? 'Hit' : 'Miss';

  const result = {
    // Keep metadata from last entry
    ...last,

    // SUM: Dollar amounts
    budgeted_gop_actual: sumField('budgeted_gop_actual'),
    budgeted_gop_target: sumField('budgeted_gop_target'),
    budgeted_gop_prior: sumField('budgeted_gop_prior'),
    forecast_actual_revenue: sumField('forecast_actual_revenue'),
    forecast_primary_forecast: sumField('forecast_primary_forecast'),

    // GOP margins — averages for display; improvement = avg of monthly (actual - prior)
    gop_margin_actual: calculatedActualMargin,
    gop_margin_prior: calculatedPriorMargin,
    gop_margin_budget: calculatedBudgetMargin,
    gop_margin_variance: calculatedVariance,
    gop_margin_improvement: avgMarginImprovement,
    // RGI: average of monthly values
    revpar_index: avgField('revpar_index'),
    revpar_index_change: avgField('revpar_index_change'),
    revpar_index_prior: avgField('revpar_index_prior'),
    // GSS: average of all months with valid (non-null, non-zero) data for each field
    gss_actual: (() => { const vals = sorted.filter(e => e.gss_actual != null && e.gss_actual !== 0).map(e => e.gss_actual); return vals.length ? Math.round(vals.reduce((s,v) => s+v,0) / vals.length * 10000) / 10000 : null; })(),
    gss_prior:  (() => { const vals = sorted.filter(e => e.gss_prior  != null && e.gss_prior  !== 0).map(e => e.gss_prior);  return vals.length ? Math.round(vals.reduce((s,v) => s+v,0) / vals.length * 10000) / 10000 : null; })(),

    // ALL: Boolean kickers
    forecast_kicker: allField('forecast_kicker'),
    red_zone_kicker: allField('red_zone_kicker'),
    forecast_result: forecastResult,

    // Text fields: use last entry
    key_wins: last.key_wins,
    previous_results: last.previous_results,
    next_priorities: last.next_priorities,
    prepared_by: last.prepared_by,
    reviewed_by: last.reviewed_by,
  };

  // Quarterly RGI override: use exact STR quarterly figures when available
  if (periodType === 'quarter') {
    return applyRgiOverride(result, rgiOverrides, last.property_id, selectedYear, getQuarterFromMonth(selectedMonth));
  }

  return result;
}

/**
 * Aggregates a pre-filtered array of entries for a single quarter.
 * Bypasses period filtering since the array is already scoped to the quarter.
 *
 * rgiOverrides: optional array of RgiQuarterlyReport records. When an override
 * exists for this property / year / quarter, RGI fields use the quarterly report's
 * exact values instead of the monthly average.
 */
export function aggregateQuarterEntries(arr, rgiOverrides = []) {
  if (!arr || arr.length === 0) return null;

  const sorted = [...arr].sort((a, b) => a.month - b.month);
  const last = sorted[sorted.length - 1];

  const sumField = (field) => {
    const vals = sorted.filter(e => e[field] != null).map(e => e[field]);
    return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  };

  const avgField = (field) => {
    const vals = sorted.filter(e => e[field] != null).map(e => e[field]);
    if (!vals.length) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
  };

  const allField = (field) => {
    const vals = sorted.filter(e => e[field] != null).map(e => e[field]);
    return vals.length > 0 && vals.every(v => v === true);
  };

  const forecastResults = sorted.filter(e => e.forecast_result).map(e => e.forecast_result);
  const forecastResult = forecastResults.length > 0 && forecastResults.every(r => r === 'Hit') ? 'Hit' : 'Miss';

  // GOP MARGIN: per-month improvement average (correct method per spec)
  const qMonthlyImprovements = sorted
    .filter(e => e.gop_margin_actual != null && e.gop_margin_prior != null)
    .map(e => e.gop_margin_actual - e.gop_margin_prior);
  const qAvgMarginImprovement = qMonthlyImprovements.length > 0
    ? Math.round((qMonthlyImprovements.reduce((s, v) => s + v, 0) / qMonthlyImprovements.length) * 10000) / 10000
    : null;

  const totalActualGop = sumField('budgeted_gop_actual');
  const totalActualRevenue = sumField('forecast_actual_revenue');
  const calculatedActualMargin = (totalActualGop != null && totalActualRevenue != null && totalActualRevenue !== 0)
    ? Math.round((totalActualGop / totalActualRevenue) * 100 * 100) / 100
    : avgField('gop_margin_actual');
  // Revenue-weighted prior margin: weight each month's prior margin by current-year revenue,
  // making the LY figure directly comparable to the TY dollar-weighted margin (same revenue weights).
  const priorMarginEntries = sorted.filter(e => e.gop_margin_prior != null && e.forecast_actual_revenue != null);
  const calculatedPriorMargin = priorMarginEntries.length > 0
    ? (() => {
        const totalRev = priorMarginEntries.reduce((s, e) => s + e.forecast_actual_revenue, 0);
        return totalRev !== 0
          ? Math.round((priorMarginEntries.reduce((s, e) => s + e.gop_margin_prior * e.forecast_actual_revenue, 0) / totalRev) * 100) / 100
          : avgField('gop_margin_prior');
      })()
    : avgField('gop_margin_prior');
  const totalBudgetGOP = sumField('budgeted_gop_target');
  const totalBudgetRevenue = sumField('forecast_primary_forecast');
  const calculatedBudgetMargin = (totalBudgetGOP != null && totalBudgetRevenue != null && totalBudgetRevenue !== 0)
    ? Math.round((totalBudgetGOP / totalBudgetRevenue) * 100 * 100) / 100
    : null;
  const calculatedVariance = (calculatedActualMargin != null && calculatedBudgetMargin != null)
    ? Math.round((calculatedActualMargin - calculatedBudgetMargin) * 100) / 100
    : null;

  const result = {
    ...last,
    budgeted_gop_actual: sumField('budgeted_gop_actual'),
    budgeted_gop_target: sumField('budgeted_gop_target'),
    budgeted_gop_prior: sumField('budgeted_gop_prior'),
    forecast_actual_revenue: sumField('forecast_actual_revenue'),
    forecast_primary_forecast: sumField('forecast_primary_forecast'),
    gop_margin_actual: calculatedActualMargin,
    gop_margin_prior: calculatedPriorMargin,
    gop_margin_budget: calculatedBudgetMargin,
    gop_margin_variance: calculatedVariance,
    gop_margin_improvement: qAvgMarginImprovement,
    // RGI: AVERAGE of monthly revpar_index_change across all months in quarter
    revpar_index: avgField('revpar_index'),
    revpar_index_change: avgField('revpar_index_change'),
    revpar_index_prior: avgField('revpar_index_prior'),
    // GSS: average of all months with valid (non-null, non-zero) data for each field
    gss_actual: (() => { const vals = sorted.filter(e => e.gss_actual != null && e.gss_actual !== 0).map(e => e.gss_actual); return vals.length ? Math.round(vals.reduce((s,v) => s+v,0) / vals.length * 10000) / 10000 : null; })(),
    gss_prior:  (() => { const vals = sorted.filter(e => e.gss_prior  != null && e.gss_prior  !== 0).map(e => e.gss_prior);  return vals.length ? Math.round(vals.reduce((s,v) => s+v,0) / vals.length * 10000) / 10000 : null; })(),
    forecast_kicker: allField('forecast_kicker'),
    red_zone_kicker: allField('red_zone_kicker'),
    forecast_result: forecastResult,
    key_wins: last.key_wins,
    previous_results: last.previous_results,
    next_priorities: last.next_priorities,
    prepared_by: last.prepared_by,
    reviewed_by: last.reviewed_by,
  };

  // Quarterly RGI override: use exact STR quarterly figures when available
  const year = sorted[0]?.year;
  const quarter = sorted[0] ? getQuarterFromMonth(sorted[0].month) : null;
  return applyRgiOverride(result, rgiOverrides, last.property_id, year, quarter);
}