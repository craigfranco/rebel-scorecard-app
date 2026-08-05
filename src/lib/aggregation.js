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
 * Applies approved bonus exceptions (quarterly add-backs) to the aggregated result.
 * Adds the exception dollar amount to actual GOP, then recalculates margins.
 *
 * bonusExceptions: array of BonusException records (only Approved ones are used)
 * applicableQuarters: array of quarter numbers that the current period covers
 */
function applyBonusExceptions(result, bonusExceptions, propertyId, applicableQuarters) {
  if (!bonusExceptions || !bonusExceptions.length || !propertyId || !applicableQuarters.length) return result;
  const approved = bonusExceptions.filter(e =>
    e.status === 'Approved' &&
    e.property_id === propertyId &&
    applicableQuarters.includes(e.quarter)
  );
  if (!approved.length) return result;

  const exceptionTotal = approved.reduce((s, e) => s + (e.amount || 0), 0);
  if (exceptionTotal === 0) return result;

  const patched = { ...result };

  // Store raw values for display
  patched.budgeted_gop_actual_raw = result.budgeted_gop_actual;
  patched.gop_margin_actual_raw = result.gop_margin_actual;
  patched.gop_margin_improvement_raw = result.gop_margin_improvement;

  // Apply add-back to actual GOP
  if (patched.budgeted_gop_actual != null) {
    patched.budgeted_gop_actual = patched.budgeted_gop_actual + exceptionTotal;
  }

  // Recalculate dollar-weighted actual margin using adjusted GOP
  if (patched.budgeted_gop_actual != null && patched.forecast_actual_revenue != null && patched.forecast_actual_revenue !== 0) {
    patched.gop_margin_actual = Math.round((patched.budgeted_gop_actual / patched.forecast_actual_revenue) * 100 * 100) / 100;
  }

  // Recalculate margin improvement (adjusted actual vs prior)
  if (patched.gop_margin_actual != null && patched.gop_margin_prior != null) {
    patched.gop_margin_improvement = Math.round((patched.gop_margin_actual - patched.gop_margin_prior) * 10000) / 10000;
  }

  // Recalculate budget variance
  if (patched.gop_margin_actual != null && patched.gop_margin_budget != null) {
    patched.gop_margin_variance = Math.round((patched.gop_margin_actual - patched.gop_margin_budget) * 100) / 100;
  }

  // Store exception metadata for UI
  patched.bonus_exception_total = exceptionTotal;
  patched.bonus_exceptions = approved.map(e => ({
    amount: e.amount,
    description: e.description,
    category: e.category
  }));

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
export function aggregateEntries(entries, periodType, selectedMonth, selectedYear, rgiOverrides = [], bonusExceptions = []) {
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
  // This is the correct method per spec: avg improvement > 0 (exceeds prior year) → PASS.
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
  const calculatedPriorMargin = calculatePriorMargin(sorted, avgField);

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

  // Apply bonus exceptions for quarter and ytd periods
  let finalResult = result;
  if (periodType === 'quarter' || periodType === 'ytd') {
    const applicableQuarters = periodType === 'quarter'
      ? [getQuarterFromMonth(selectedMonth)]
      : [1, 2, 3, 4].filter(q => q <= getQuarterFromMonth(selectedMonth));
    finalResult = applyBonusExceptions(result, bonusExceptions, last.property_id, applicableQuarters);
  }

  // Quarterly RGI override: use exact STR quarterly figures when available
  if (periodType === 'quarter') {
    return applyRgiOverride(finalResult, rgiOverrides, last.property_id, selectedYear, getQuarterFromMonth(selectedMonth));
  }

  return finalResult;
}

/**
 * Calculates the dollar-weighted prior-year GOP margin from monthly entries.
 *
 * Priority:
 * 1. If budgeted_gop_prior (prior-year GOP $) is available, derives prior revenue
 *    as prior_GOP ÷ prior_margin% and dollar-weights: sum(prior_GOP) / sum(prior_revenue).
 *    This is the true quarterly margin — "adding the 3 months" by summing dollars.
 * 2. Falls back to revenue-weighting using current-year revenue as weight.
 * 3. Falls back to simple average of prior margins.
 */
function calculatePriorMargin(sorted, avgField) {
  // Method 1: True dollar-weighting using prior-year GOP dollars
  const priorGopEntries = sorted.filter(e => e.budgeted_gop_prior != null && e.gop_margin_prior != null && e.gop_margin_prior !== 0);
  if (priorGopEntries.length > 0) {
    const totalPriorGop = priorGopEntries.reduce((s, e) => s + e.budgeted_gop_prior, 0);
    const totalPriorRev = priorGopEntries.reduce((s, e) => s + (e.budgeted_gop_prior / (e.gop_margin_prior / 100)), 0);
    if (totalPriorRev !== 0) {
      return Math.round((totalPriorGop / totalPriorRev) * 100 * 100) / 100;
    }
  }
  // Method 2: Revenue-weighted using current-year revenue (same weights as TY)
  const revWeighted = sorted.filter(e => e.gop_margin_prior != null && e.forecast_actual_revenue != null);
  if (revWeighted.length > 0) {
    const totalRev = revWeighted.reduce((s, e) => s + e.forecast_actual_revenue, 0);
    if (totalRev !== 0) {
      return Math.round((revWeighted.reduce((s, e) => s + e.gop_margin_prior * e.forecast_actual_revenue, 0) / totalRev) * 100) / 100;
    }
  }
  // Method 3: Simple average
  return avgField('gop_margin_prior');
}

/**
 * Aggregates a pre-filtered array of entries for a single quarter.
 * Bypasses period filtering since the array is already scoped to the quarter.
 *
 * rgiOverrides: optional array of RgiQuarterlyReport records. When an override
 * exists for this property / year / quarter, RGI fields use the quarterly report's
 * exact values instead of the monthly average.
 */
export function aggregateQuarterEntries(arr, rgiOverrides = [], bonusExceptions = []) {
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
  const calculatedPriorMargin = calculatePriorMargin(sorted, avgField);
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

  // Apply bonus exceptions (quarterly add-backs)
  const year = sorted[0]?.year;
  const quarter = sorted[0] ? getQuarterFromMonth(sorted[0].month) : null;
  const withExceptions = applyBonusExceptions(result, bonusExceptions, last.property_id, quarter ? [quarter] : []);

  // Quarterly RGI override: use exact STR quarterly figures when available
  return applyRgiOverride(withExceptions, rgiOverrides, last.property_id, year, quarter);
}