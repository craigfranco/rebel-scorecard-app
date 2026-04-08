// Scoring logic for Balanced Scorecard

export const GSS_STANDARDS = {
  Marriott: { metric: 'ITR', target: 1.0, label: 'Marriott ITR +1.0' },
  Hilton: { metric: 'Stay Score', target: 1.0, label: 'Hilton Stay Score +1.0' },
  IHG: { metric: 'Overall Experience', target: 1.0, label: 'IHG Overall Experience +1.0' },
  Hyatt: { metric: 'Perf Tier', target: 1.0, label: 'Hyatt Perf Tier +1.0' },
  Choice: { metric: 'Choice Likelihood', target: 0.3, label: 'Choice Likelihood +0.3' },
  Independent: { metric: 'Revinate', target: 0.03, label: 'Independent Revinate +0.03' },
};

export function getGssStandard(parentBrand) {
  return GSS_STANDARDS[parentBrand] || GSS_STANDARDS['Independent'];
}

export function calcGOPScore(actual, prior) {
  if (actual == null || prior == null) return { score: 0, pct: 0, pass: false, incomplete: true };
  if (prior === 0) return { score: 0, pct: 0, pass: false, incomplete: true };
  // Calculate growth percentage: (actual - prior) / prior * 100
  const growthPct = ((actual - prior) / Math.abs(prior)) * 100;
  const pass = growthPct >= 0.5;
  // Score based on growth: 0.5% = 1 pt (minimum), 10%+ = 35 pts (capped)
  // Linear scale: 1 pt at 0.5%, 35 pts at 10%
  const score = growthPct < 0.5 ? 0 : Math.min(35, 1 + ((growthPct - 0.5) / 9.5) * 34);
  return { score: Math.round(score * 10) / 10, pct: Math.round(growthPct * 100) / 100, pass, incomplete: false };
}

export function calcGOPMarginScore(actual, prior) {
  if (actual == null || prior == null) return { score: 0, diff: 0, pass: false, incomplete: true };
  const diff = actual - prior;
  const pass = diff >= 0.1;
  // Score based on margin improvement: 0.1% = 1 pt (minimum), 5%+ = 35 pts (capped)
  // Linear scale: 1 pt at 0.1%, 35 pts at 5%
  const score = diff < 0.1 ? 0 : Math.min(35, 1 + ((diff - 0.1) / 4.9) * 34);
  return { score: Math.round(score * 10) / 10, diff: Math.round(diff * 100) / 100, pass, incomplete: false };
}

export function calcRGIScore(revparIndexChange) {
  if (revparIndexChange == null) return { score: 0, diff: 0, pass: false, incomplete: true };
  const pct = revparIndexChange;
  const pass = pct >= 0.1;
  // Score based on RGI change: 0.1% = 1 pt (minimum), 3%+ = 15 pts (capped)
  // Linear scale: 1 pt at 0.1%, 15 pts at 3%
  const score = pct < 0.1 ? 0 : Math.min(15, 1 + ((pct - 0.1) / 2.9) * 14);
  return { score: Math.round(score * 10) / 10, diff: Math.round(pct * 100) / 100, pass, incomplete: false };
}

export function calcGSSScore(actual, prior, gssTarget) {
   if (actual == null || prior == null) return { score: 0, diff: 0, pass: false, incomplete: true };
   const diff = actual - prior;
   const pass = diff >= gssTarget;
   const score = pass ? 15 : Math.min(14, Math.max(0, (diff / gssTarget) * 15));
   return { score: Math.round(score * 10) / 10, diff: Math.round(diff * 100) / 100, pass, incomplete: false };
}

export function calcForecastAccuracyScore(forecastResult) {
   if (forecastResult == null || forecastResult === '') return { score: 0, pass: false, incomplete: true };
   const pass = forecastResult === 'Hit';
   const score = pass ? 5 : 0;
   return { score, pass, incomplete: false };
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
  const forecastAccuracy = calcForecastAccuracyScore(entry.forecast_kicker);
  return {
    gop,
    gopMargin,
    rgi,
    gss,
    forecastAccuracy,
    gssStd,
    total,
    forecastKicker: entry.forecast_kicker || false,
    redZoneKicker: entry.red_zone_kicker || false,
  };
  }

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const QUARTERS = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];

export function getQuarterFromMonth(month) {
  return Math.ceil(month / 3);
}