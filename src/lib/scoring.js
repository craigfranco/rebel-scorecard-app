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

export function calcGOPScore(actual, target) {
  if (!target || target === 0) return { score: 0, pct: 0, pass: false };
  const pct = actual / target;
  const score = Math.min(35, Math.max(0, pct * 35));
  return { score: Math.round(score * 10) / 10, pct: Math.round(pct * 1000) / 10, pass: pct >= 1.0 };
}

export function calcGOPMarginScore(actual, prior) {
  const diff = actual - prior;
  const pass = diff >= 0.1;
  const score = Math.min(35, Math.max(0, (diff / 5) * 35));
  return { score: Math.round(score * 10) / 10, diff: Math.round(diff * 100) / 100, pass };
}

export function calcRGIScore(actual, prior) {
  if (!prior || prior === 0) return { score: 0, diff: 0, pass: false };
  const diffPct = ((actual - prior) / prior) * 100;
  let score = 0;
  if (diffPct >= 2.1) score = 15;
  else if (diffPct >= 0.1) score = 7.5;
  const pass = diffPct >= 0.1;
  return { score, diff: Math.round(diffPct * 100) / 100, pass };
}

export function calcGSSScore(actual, prior, gssTarget) {
  const diff = actual - prior;
  const pass = diff >= gssTarget;
  const score = pass ? 15 : Math.min(14, Math.max(0, (diff / gssTarget) * 15));
  return { score: Math.round(score * 10) / 10, diff: Math.round(diff * 100) / 100, pass };
}

export function calcTotalScore(gopScore, gopMarginScore, rgiScore, gssScore) {
  const total = gopScore + gopMarginScore + rgiScore + gssScore;
  return { total: Math.round(total * 10) / 10, pass: total >= 70 };
}

export function calculateScorecard(entry, property) {
  const gssStd = getGssStandard(property?.parent_brand || 'Independent');
  const gop = calcGOPScore(entry.budgeted_gop_actual || 0, entry.budgeted_gop_target || 0);
  const gopMargin = calcGOPMarginScore(entry.gop_margin_actual || 0, entry.gop_margin_prior || 0);
  const rgi = calcRGIScore(entry.rgi_actual || 0, entry.rgi_prior || 0);
  const gss = calcGSSScore(entry.gss_actual || 0, entry.gss_prior || 0, gssStd.target);
  const total = calcTotalScore(gop.score, gopMargin.score, rgi.score, gss.score);
  return {
    gop,
    gopMargin,
    rgi,
    gss,
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