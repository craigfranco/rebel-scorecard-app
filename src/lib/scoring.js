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
  return GSS_STANDARDS[parentBrand] || GSS_STANDARDS['Independent'];
}

export function calcGOPScore(actual, target) {
  if (actual == null || target == null) return { score: 0, variance: null, pass: false, incomplete: true };
  // PASS = actual > budget (simple comparison, works for negative budgets too)
  const pass = actual > target;
  const variance = actual - target; // positive = beat budget, negative = missed
  // Achievement % only meaningful when budget is positive
  const achievementPct = target > 0 ? (actual / target) * 100 : null;
  const score = pass ? 35 : 0;
  return { score, variance, achievementPct, pass, incomplete: false };
}

export function calcGOPMarginScore(actual, prior) {
  if (actual == null || prior == null) return { score: 0, diff: 0, pass: false, incomplete: true };
  const diff = actual - prior;
  const pass = diff >= 0.1;
  // Linear scale: 0.1% = 1 pt minimum, 5%+ = 35 pts capped
  let score = 0;
  if (diff >= 0.1) {
    score = Math.min((diff / 5) * 35, 35);
    score = Math.max(score, 1); // at least 1 pt when passing
  }
  return { score: Math.round(score * 10) / 10, diff: Math.round(diff * 100) / 100, pass, incomplete: false };
}

export function calcRGIScore(revparIndexChange) {
  if (revparIndexChange == null) return { score: 0, diff: 0, pass: false, incomplete: true };
  const pct = revparIndexChange;
  const pass = pct >= 0.1;
  // Linear scale: 0.1% = 1 pt minimum, 3%+ = 15 pts capped
  let score = 0;
  if (pct >= 0.1) {
    score = Math.min((pct / 3) * 15, 15);
    score = Math.max(score, 1); // at least 1 pt when passing
  }
  return { score: Math.round(score * 10) / 10, diff: Math.round(pct * 100) / 100, pass, incomplete: false };
}

export function calcGSSScore(actual, prior, gssTarget) {
  if (actual == null || prior == null) return { score: 0, diff: 0, pass: false, incomplete: true };
  const diff = actual - prior;
  const pass = diff >= gssTarget;
  // All-or-nothing: 15 pts if pass, 0 if fail
  const score = pass ? 15 : 0;
  return { score, diff: Math.round(diff * 100) / 100, pass, incomplete: false };
}

export function calcTotalScore(gopScore, gopMarginScore, rgiScore, gssScore) {
  const total = gopScore + gopMarginScore + rgiScore + gssScore;
  return { total: Math.round(total * 10) / 10, pass: total >= 70 };
}

export function calculateScorecard(entry, property) {
  const gssStd = getGssStandard(property?.parent_brand || 'Independent');
  const gop = calcGOPScore(
    entry.budgeted_gop_actual != null ? entry.budgeted_gop_actual : null,
    entry.budgeted_gop_target != null ? entry.budgeted_gop_target : null
  );
  const gopMargin = calcGOPMarginScore(
    entry.gop_margin_actual != null ? entry.gop_margin_actual : null,
    entry.gop_margin_prior != null ? entry.gop_margin_prior : null
  );
  const rgi = calcRGIScore(entry.revpar_index_change != null ? entry.revpar_index_change : null);
  const gss = calcGSSScore(
    entry.gss_actual != null ? entry.gss_actual : null,
    entry.gss_prior != null ? entry.gss_prior : null,
    gssStd.target
  );
  const total = calcTotalScore(gop.score, gopMargin.score, rgi.score, gss.score);
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