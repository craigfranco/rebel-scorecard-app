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
 * Aggregates ScoreEntry data based on time period type
 * 
 * Rules:
 * - Dollar amounts (budgeted_gop_actual, budgeted_gop_target, budgeted_gop_prior, 
 *   forecast_actual_revenue, forecast_primary_forecast): SUM
 * - Percentage/index metrics (gop_margin_actual, gop_margin_prior, gop_margin_budget,
 *   gop_margin_variance, revpar_index, revpar_index_change, gss_actual, gss_prior): AVERAGE
 * - Forecast result (Hit/Miss): Hit only if ALL months hit
 * - Red zone kicker: Hit only if ALL months hit
 */
export function aggregateEntries(entries, periodType, selectedMonth, selectedYear) {
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

  // RECALCULATE margins as weighted average across months (weighted by revenue)
  // Fall back to simple average of stored margins if revenue data is unavailable
  const marginActualValues = sorted.filter(e => e.gop_margin_actual != null);
  const marginPriorValues = sorted.filter(e => e.gop_margin_prior != null);

  // Weighted by forecast_actual_revenue for TY, by budgeted_gop_prior-equivalent for PY
  const calcWeightedMargin = (entries, marginField, weightField) => {
    const withWeight = entries.filter(e => e[weightField] != null && e[weightField] !== 0 && e[marginField] != null);
    if (withWeight.length > 0) {
      const weightSum = withWeight.reduce((s, e) => s + Math.abs(e[weightField]), 0);
      const weightedSum = withWeight.reduce((s, e) => s + e[marginField] * Math.abs(e[weightField]), 0);
      return Math.round((weightedSum / weightSum) * 100) / 100;
    }
    // fallback: simple average
    const vals = entries.filter(e => e[marginField] != null).map(e => e[marginField]);
    if (vals.length === 0) return null;
    return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100;
  };

  const calculatedActualMargin = calcWeightedMargin(sorted, 'gop_margin_actual', 'forecast_actual_revenue');
  const calculatedPriorMargin = calcWeightedMargin(sorted, 'gop_margin_prior', 'budgeted_gop_prior');

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

  return {
    // Keep metadata from last entry
    ...last,
    
    // SUM: Dollar amounts
    budgeted_gop_actual: sumField('budgeted_gop_actual'),
    budgeted_gop_target: sumField('budgeted_gop_target'),
    budgeted_gop_prior: sumField('budgeted_gop_prior'),
    forecast_actual_revenue: sumField('forecast_actual_revenue'),
    forecast_primary_forecast: sumField('forecast_primary_forecast'),
    
    // RECALCULATED: GOP margins — weighted average across months
    gop_margin_actual: calculatedActualMargin,
    gop_margin_prior: calculatedPriorMargin,
    gop_margin_budget: calculatedBudgetMargin,
    gop_margin_variance: calculatedVariance,
    // RGI: average of monthly values
    revpar_index: avgField('revpar_index'),
    revpar_index_change: avgField('revpar_index_change'),
    revpar_index_prior: avgField('revpar_index_prior'),
    // GSS: use most recent month that has both gss_actual and gss_prior
    gss_actual: (() => { const e = [...sorted].reverse().find(e => e.gss_actual != null); return e?.gss_actual ?? null; })(),
    gss_prior: (() => { const e = [...sorted].reverse().find(e => e.gss_prior != null); return e?.gss_prior ?? null; })(),
    
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
}

/**
 * Aggregates a pre-filtered array of entries for a single quarter.
 * Bypasses period filtering since the array is already scoped to the quarter.
 */
export function aggregateQuarterEntries(arr) {
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

  // Weighted margin: weighted by revenue field, fallback to simple average
  const weightedMargin = (marginField, weightField) => {
    const withWeight = sorted.filter(e => e[weightField] != null && e[weightField] !== 0 && e[marginField] != null);
    if (withWeight.length > 0) {
      const wSum = withWeight.reduce((s, e) => s + Math.abs(e[weightField]), 0);
      const wVal = withWeight.reduce((s, e) => s + e[marginField] * Math.abs(e[weightField]), 0);
      return Math.round((wVal / wSum) * 100) / 100;
    }
    const vals = sorted.filter(e => e[marginField] != null).map(e => e[marginField]);
    return vals.length ? Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 100) / 100 : null;
  };

  const allField = (field) => {
    const vals = sorted.filter(e => e[field] != null).map(e => e[field]);
    return vals.length > 0 && vals.every(v => v === true);
  };

  const forecastResults = sorted.filter(e => e.forecast_result).map(e => e.forecast_result);
  const forecastResult = forecastResults.length > 0 && forecastResults.every(r => r === 'Hit') ? 'Hit' : 'Miss';

  const calculatedActualMargin = weightedMargin('gop_margin_actual', 'forecast_actual_revenue');
  const calculatedPriorMargin = weightedMargin('gop_margin_prior', 'budgeted_gop_prior');
  const totalBudgetGOP = sumField('budgeted_gop_target');
  const totalBudgetRevenue = sumField('forecast_primary_forecast');
  const calculatedBudgetMargin = (totalBudgetGOP != null && totalBudgetRevenue != null && totalBudgetRevenue !== 0)
    ? Math.round((totalBudgetGOP / totalBudgetRevenue) * 100 * 100) / 100
    : null;
  const calculatedVariance = (calculatedActualMargin != null && calculatedBudgetMargin != null)
    ? Math.round((calculatedActualMargin - calculatedBudgetMargin) * 100) / 100
    : null;

  return {
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
    // RGI: AVERAGE of monthly revpar_index_change across all months in quarter
    revpar_index: avgField('revpar_index'),
    revpar_index_change: avgField('revpar_index_change'),
    revpar_index_prior: avgField('revpar_index_prior'),
    // GSS: most recent month with data
    gss_actual: (() => { const e = [...sorted].reverse().find(e => e.gss_actual != null); return e?.gss_actual ?? null; })(),
    gss_prior: (() => { const e = [...sorted].reverse().find(e => e.gss_prior != null); return e?.gss_prior ?? null; })(),
    forecast_kicker: allField('forecast_kicker'),
    red_zone_kicker: allField('red_zone_kicker'),
    forecast_result: forecastResult,
    key_wins: last.key_wins,
    previous_results: last.previous_results,
    next_priorities: last.next_priorities,
    prepared_by: last.prepared_by,
    reviewed_by: last.reviewed_by,
  };
}