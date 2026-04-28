// Scoring logic for Balanced Scorecard

export const GSS_STANDARDS = {
  Marriott: { metric: 'ITR', target: 1.0, label: 'Marriott ITR +1.0', scale: 100 },
  Hilton: { metric: 'Stay Score', target: 1.0, label: 'Hilton Stay Score +1.0', scale: 100 },
  IHG: { metric: 'Overall Experience', target: 1.0, label: 'IHG Overall Experience +1.0', scale: 100 },
  Hyatt: { metric: 'Perf Tier', target: 1.0, label: 'Hyatt Perf Tier +1.0', scale: 100 },
  Choice: { metric: 'Choice Likelihood', target: 0.3, label: 'Choice Likelihood +0.3', scale: 10 },
  Independent: { metric: 'Revinate', target: 0.03, label: 'Independent Revinate +0.03', scale: 5 },
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
  // All-or-nothing: 35 pts if pass, 0 if fail
  const score = pass ? 35 : 0;
  return { score, pct: Math.round(growthPct * 100) / 100, pass, incomplete: false };
}

export function calcGOPMarginScore(actual, prior) {
  if (actual == null || prior == null) return { score: 0, diff: 0, pass: false, incomplete: true };
  const diff = actual - prior;
  const pass = diff >= 0.1;
  // All-or-nothing: 35 pts if pass, 0 if fail
  const score = pass ? 35 : 0;
  return { score, diff: Math.round(diff * 100) / 100, pass, incomplete: false };
}

export function calcRGIScore(revparIndexChange) {
  if (revparIndexChange == null) return { score: 0, diff: 0, pass: false, incomplete: true };
  const pct = revparIndexChange;
  const pass = pct >= 0.1;
  // All-or-nothing: 15 pts if pass, 0 if fail
  const score = pass ? 15 : 0;
  return { score, diff: Math.round(pct * 100) / 100, pass, incomplete: false };
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
    forecastKicker: entry.forecast_kicker || false,
    redZoneKicker: entry.red_zone_kicker || false,
  };
}

export function aggregateQuarterEntries(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a.month - b.month);
  const last = sorted[sorted.length - 1];

  const sumActualGop = arr.reduce((s, e) => s + (e.budgeted_gop_actual ?? 0), 0);
  const sumTargetGop = arr.reduce((s, e) => s + (e.budgeted_gop_target ?? 0), 0);
  const sumPriorGop = arr.reduce((s, e) => s + (e.budgeted_gop_prior ?? 0), 0);

  const withMargin = sorted.filter(e => e.gop_margin_actual != null);
  const withRGI = sorted.filter(e => e.revpar_index_change != null);
  const withGSS = sorted.filter(e => e.gss_actual != null);

  return {
    ...last,
    budgeted_gop_actual: arr.some(e => e.budgeted_gop_actual != null) ? sumActualGop : null,
    budgeted_gop_target: arr.some(e => e.budgeted_gop_target != null) ? sumTargetGop : null,
    budgeted_gop_prior: arr.some(e => e.budgeted_gop_prior != null) ? sumPriorGop : null,
    gop_margin_actual: withMargin.length ? withMargin[withMargin.length - 1].gop_margin_actual : null,
    gop_margin_prior: withMargin.length ? withMargin[withMargin.length - 1].gop_margin_prior : null,
    revpar_index_change: withRGI.length ? withRGI[withRGI.length - 1].revpar_index_change : null,
    revpar_index: withRGI.length ? withRGI[withRGI.length - 1].revpar_index : null,
    revpar_index_prior: withRGI.length ? withRGI[withRGI.length - 1].revpar_index_prior : null,
    gss_actual: withGSS.length ? withGSS[withGSS.length - 1].gss_actual : null,
    gss_prior: withGSS.length ? withGSS[withGSS.length - 1].gss_prior : null,
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