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
    // YTD: From Jan of selectedYear (or APP_START_YEAR if earlier) through selectedMonth
    // Handle multi-year case: include all months from Jan selectedYear to selectedMonth
    filteredEntries = entries.filter(e => {
      if (e.year === selectedYear) {
        return e.month <= selectedMonth;
      }
      // Include previous years if we're in a multi-year scenario
      return e.year < selectedYear && e.year >= 2026;
    });
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

  // RECALCULATE margins from summed dollars (not averaged)
  const totalActualGOP = sumField('budgeted_gop_actual');
  const totalActualRevenue = sumField('forecast_actual_revenue');
  const totalBudgetGOP = sumField('budgeted_gop_target');
  const totalBudgetRevenue = sumField('forecast_primary_forecast');
  
  const calculatedActualMargin = (totalActualGOP != null && totalActualRevenue != null && totalActualRevenue !== 0)
    ? Math.round((totalActualGOP / totalActualRevenue) * 100 * 100) / 100
    : null;
    
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
    
    // RECALCULATED: GOP margins from summed dollars
    gop_margin_actual: calculatedActualMargin,
    gop_margin_prior: avgField('gop_margin_prior'),
    gop_margin_budget: calculatedBudgetMargin,
    gop_margin_variance: calculatedVariance,
    revpar_index: avgField('revpar_index'),
    revpar_index_change: avgField('revpar_index_change'),
    revpar_index_prior: avgField('revpar_index_prior'),
    gss_actual: avgField('gss_actual'),
    gss_prior: avgField('gss_prior'),
    
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
 * Legacy wrapper for backward compatibility
 */
export function aggregateQuarterEntries(arr) {
  return aggregateEntries(arr, 'quarter', arr[0]?.month, arr[0]?.year);
}