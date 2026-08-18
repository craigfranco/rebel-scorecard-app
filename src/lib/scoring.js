// Scoring logic for Balanced Scorecard

export const GSS_STANDARDS = {
  Marriott: { metric: 'ITR', target: 1.0, label: 'Marriott ITR +1.0', scale: 100 },
  Hilton: { metric: 'Stay Score', target: 1.0, label: 'Hilton Stay Score +1.0', scale: 100 },
  IHG: { metric: 'Overall Experience', target: 1.0, label: 'IHG Overall Experience +1.0', scale: 100 },
  Hyatt: { metric: 'Perf Tier', target: 1.0, label: 'Hyatt Perf Tier +1.0', scale: 100 },
  Choice: { metric: 'Choice Likelihood', target: 0.3, label: 'Choice Likelihood +0.3', scale: 10 },
  Independent: { metric: 'Revinate', target: 0.03, label: 'Independent Revinate +0.03', scale: 5 },
};

// Returns true if a forecast entry has valid (non-null, non-zero) data for both fields
export function hasForecastData(entry) {
  return (
    entry.forecast_actual_revenue != null && entry.forecast_actual_revenue !== 0 &&
    entry.forecast_primary_forecast != null && entry.forecast_primary_forecast !== 0
  );
}

export function getGssStandard(parentBrand) {
  if (parentBrand === 'Choice Hotels') return GSS_STANDARDS['Choice'];
  return GSS_STANDARDS[parentBrand] || GSS_STANDARDS['Independent'];
}

// Normalize a raw GSS value to a 100-point scale based on brand
export function normalizeGssTo100(value, parentBrand) {
  if (value == null) return null;
  const std = getGssStandard(parentBrand);
  if (std.scale === 10) return value * 10;   // Choice: ×10
  if (std.scale === 5) return value * 20;    // Independent: ×20
  return value;                              // All others: already on 100 scale
}

export function calcGOPScore(actual, target) {
  if (actual == null || target == null) return { score: 0, variance: null, pass: false, incomplete: true };
  // PASS = actual >= budget (meets the approved budgeted target)
  const pass = actual >= target;
  const variance = actual - target; // positive = beat budget, negative = missed
  // Achievement % only meaningful when budget is positive
  const achievementPct = target > 0 ? (actual / target) * 100 : null;
  const score = pass ? 35 : 0;
  return { score, variance, achievementPct, pass, incomplete: false };
}

// GOP Margin improvement target (percentage points above prior year) required to PASS
export const MARGIN_TARGET_IMPROVEMENT = 0.1;

export function calcGOPMarginScore(actual, prior, precomputedImprovement = null) {
  // PASS when actual margin beats the target (prior year + MARGIN_TARGET_IMPROVEMENT),
  // i.e. the improvement is greater than the target threshold. Applies to month and quarter.
  if (precomputedImprovement != null) {
    const pass = precomputedImprovement > MARGIN_TARGET_IMPROVEMENT;
    const score = pass ? 35 : 0;
    return { score, diff: Math.round(precomputedImprovement * 100) / 100, pass, incomplete: false };
  }
  if (actual == null || prior == null) return { score: 0, diff: 0, pass: false, incomplete: true };
  const diff = actual - prior;
  const pass = diff > MARGIN_TARGET_IMPROVEMENT;
  const score = pass ? 35 : 0;
  return { score, diff: Math.round(diff * 100) / 100, pass, incomplete: false };
}

export function calcRGIScore(revparIndexChange) {
  if (revparIndexChange == null) return { score: 0, diff: 0, pass: false, tier: null, incomplete: true };
  const pct = revparIndexChange;
  // Two-tier: < 0.1% = 0 pts FAIL, 0.1%-2.0% = 7.5 pts PARTIAL, 2.1%+ = 15 pts FULL PASS
  let score = 0;
  let pass = false;
  let tier = 'fail'; // 'fail' | 'partial' | 'full'
  if (pct >= 2.1) {
    score = 15;
    pass = true;
    tier = 'full';
  } else if (pct >= 0.1) {
    score = 7.5;
    pass = true;
    tier = 'partial';
  }
  return { score, diff: Math.round(pct * 100) / 100, pass, tier, incomplete: false };
}

export function calcGSSScore(actual, prior, parentBrand = 'Independent') {
  if (actual == null || prior == null) return { score: 0, diff: 0, pass: false, tier: 'below', incomplete: true };
  const std = getGssStandard(parentBrand);
  const rawDiff = actual - prior; // raw (non-normalized) improvement
  const target = std.target;

  // 4-tier payout scale using raw brand-specific targets:
  // Below Threshold (≤0): 0%
  // Threshold (0 < diff < target): 25% → 3.75 pts
  // Target (diff >= target): 75% → 11.25 pts
  // Max (diff >= 2× target): 100% → 15 pts
  let tier, payoutPct;
  if (rawDiff >= 2 * target) {
    tier = 'max'; payoutPct = 1.0;
  } else if (rawDiff >= target) {
    tier = 'target'; payoutPct = 0.75;
  } else if (rawDiff > 0) {
    tier = 'threshold'; payoutPct = 0.25;
  } else {
    tier = 'below'; payoutPct = 0;
  }

  const score = Math.round(15 * payoutPct * 100) / 100;
  const pass = rawDiff > 0; // any improvement = eligible for some payout

  // Also compute normalized values for display purposes
  const normActual = normalizeGssTo100(actual, parentBrand);
  const normPrior  = normalizeGssTo100(prior,  parentBrand);

  return { score, diff: Math.round(rawDiff * 10000) / 10000, rawDiff, normActual, normPrior, pass, tier, payoutPct, incomplete: false };
}

/**
 * Calculates total score.
 * If gssIncomplete is true, GSS is excluded from scoring:
 *   - maxPossible = 85, pass threshold scales to 70/100 × 85 = 59.5
 */
export function calcTotalScore(gopScore, gopMarginScore, rgiScore, gssScore, gssIncomplete = false) {
  const total = gopScore + gopMarginScore + rgiScore + (gssIncomplete ? 0 : gssScore);
  const maxPossible = gssIncomplete ? 85 : 100;
  const passThreshold = Math.round(70 * maxPossible / 100 * 10) / 10; // 70% of max
  return {
    total: Math.round(total * 10) / 10,
    maxPossible,
    gssIncomplete,
    pass: total >= passThreshold,
    passThreshold,
  };
}

export function calculateScorecard(entry, property) {
  const gssStd = getGssStandard(property?.parent_brand || 'Independent');
  const gop = calcGOPScore(
    entry.budgeted_gop_actual != null ? entry.budgeted_gop_actual : null,
    entry.budgeted_gop_target != null ? entry.budgeted_gop_target : null
  );
  const gopMargin = calcGOPMarginScore(
    entry.gop_margin_actual != null ? entry.gop_margin_actual : null,
    entry.gop_margin_prior != null ? entry.gop_margin_prior : null,
    entry.gop_margin_improvement != null ? entry.gop_margin_improvement : null
  );
  const rgi = calcRGIScore(entry.revpar_index_change != null ? entry.revpar_index_change : null);
  const gss = calcGSSScore(
    entry.gss_actual != null ? entry.gss_actual : null,
    entry.gss_prior != null ? entry.gss_prior : null,
    property?.parent_brand || 'Independent'
  );
  const total = calcTotalScore(gop.score, gopMargin.score, rgi.score, gss.score, gss.incomplete);
  return {
    gop,
    gopMargin,
    rgi,
    gss,
    gssStd,
    total,
    forecastKicker: hasForecastData(entry) ? (entry.forecast_kicker || false) : false,
    forecastMissingData: !hasForecastData(entry),
    redZoneKicker: entry.red_zone_kicker || false,
  };
}

// Re-export all from aggregation.js
export {
  MONTHS,
  QUARTERS,
  aggregateEntries,
  aggregateQuarterEntries,
  getQuarterFromMonth,
  getQuarterMonths,
  getQuarterStartMonth
} from './aggregation';