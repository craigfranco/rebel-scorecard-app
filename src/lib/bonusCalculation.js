/**
 * GOP GATEKEEPER: Both conditions must be true to earn GOP $ bonus OR Margin $ bonus:
 *   1. Actual GOP $ >= Budgeted GOP $
 *   2. Actual GOP Margin % > Prior Year GOP Margin %
 *
 * If either fails → gop and gopMargin bonus = $0. RGI and GSS calculate independently.
 *
 * RGI and GSS have no eligibility gate — they always calculate.
 */
export function checkGopGate(scorecard) {
  if (!scorecard) return { passed: false, gopPassed: false, marginPassed: false };
  const gopPassed = !scorecard.gop?.incomplete && scorecard.gop?.pass === true;
  const marginPassed = !scorecard.gopMargin?.incomplete && scorecard.gopMargin?.pass === true;
  return { passed: gopPassed && marginPassed, gopPassed, marginPassed };
}

/**
 * Quarterly bonus calculation per 2026 Incentive Plan.
 *
 * GOP GATEKEEPER: Both GOP $ and Margin $ must individually pass.
 * If either fails → gop = $0 AND gopMargin = $0.
 * RGI and GSS always calculate independently.
 *
 * GSS 4-tier: uses scorecard.gss.payoutPct (0, 0.25, 0.75, 1.0).
 * RGI two-tier: full = rgi_bonus_percentage_high × salary; partial = 50% of that.
 *
 * Red Zone kicker: +25% of GSS payout for hotels that started in Red Zone
 * and are showing GSS improvement (tier >= threshold).
 */
export function calcKpiBonus(quarterlySalary, scorecard, jobClass, property = null) {
  if (!jobClass || !scorecard || !quarterlySalary) {
    return { gop: 0, gopMargin: 0, rgi: 0, gss: 0, redZoneKicker: 0, total: 0, eligible: true, gopGatePassed: false, gopGate: { passed: false, gopPassed: false, marginPassed: false }, eligibilityReason: 'Missing data' };
  }

  const sal = quarterlySalary;
  const gopGate = checkGopGate(scorecard);

  // GOP: only if gate passes
  const gop = gopGate.passed ? sal * (jobClass.gop_bonus_percentage || 0) / 100 : 0;

  // GOP Margin: only if gate passes
  const gopMargin = gopGate.passed ? sal * (jobClass.gop_margin_bonus_percentage || 0) / 100 : 0;

  // RGI — independent, two tiers
  let rgi = 0;
  if (!scorecard.rgi?.incomplete && scorecard.rgi?.pass) {
    const highPct = jobClass.rgi_bonus_percentage_high || 0;
    rgi = scorecard.rgi.tier === 'full'
      ? sal * highPct / 100
      : sal * (highPct / 2) / 100;
  }

  // GSS — 4-tier using payoutPct from scoring
  const gssPct = jobClass.gss_bonus_percentage || 0;
  const gssPayoutPct = (!scorecard.gss?.incomplete) ? (scorecard.gss?.payoutPct ?? 0) : 0;
  const gss = sal * gssPct / 100 * gssPayoutPct;

  // Red Zone Kicker: +25% of GSS payout if property started in Red Zone and GSS tier >= threshold
  let redZoneKicker = 0;
  if (property?.started_in_red_zone && gss > 0 && scorecard.gss?.pass) {
    redZoneKicker = gss * 0.25;
  }

  const total = gop + gopMargin + rgi + gss + redZoneKicker;

  return {
    gop, gopMargin, rgi, gss, redZoneKicker, total,
    eligible: true,
    gopGatePassed: gopGate.passed,
    gopGate,
    eligibilityReason: gopGate.passed ? '' : `GOP Gate: GOP ${gopGate.gopPassed ? '✓' : '✗'}, Margin ${gopGate.marginPassed ? '✓' : '✗'}`,
  };
}

// Legacy: checkBonusEligibility — always eligible now (gate is GOP-only)
export function checkBonusEligibility(scorecard) {
  if (!scorecard) return { eligible: false, rgiMet: false, gssMet: false, reason: 'No scorecard data' };
  // No longer gates on RGI+GSS; return eligible=true always (gate is inside calcKpiBonus)
  const rgiMet = !scorecard.rgi?.incomplete && scorecard.rgi?.pass === true;
  const gssMet = !scorecard.gss?.incomplete && scorecard.gss?.pass === true;
  return { eligible: true, rgiMet, gssMet, reason: '' };
}

// Legacy wrappers
export const calculateBonusForMetric = (staff, scorecard, jobClass, entry) => {
  const quarterlySalary = staff.annual_salary || 0;
  const result = calcKpiBonus(quarterlySalary, scorecard, jobClass);
  return { ...result, metricsHit: { gop: result.gop > 0, gopMargin: result.gopMargin > 0, rgi: result.rgi > 0, gss: result.gss > 0 } };
};

export const calculateQuarterlyBonus = (staff, scorecard, jobClass, entry) => {
  const result = calculateBonusForMetric(staff, scorecard, jobClass, entry);
  return { ...result, quarterlyAmount: result.total, annualAmount: result.total };
};

export const calculateAnnualBonus = (staff, scorecards, jobClass, entries = []) => {
  let total = { gop: 0, gopMargin: 0, rgi: 0, gss: 0, redZoneKicker: 0, total: 0, metricsHit: {} };
  scorecards.forEach((scorecard, idx) => {
    const q = calculateQuarterlyBonus(staff, scorecard, jobClass, entries[idx]);
    total.gop += q.gop;
    total.gopMargin += q.gopMargin;
    total.rgi += q.rgi;
    total.gss += q.gss;
    total.redZoneKicker += q.redZoneKicker || 0;
  });
  total.total = total.gop + total.gopMargin + total.rgi + total.gss + total.redZoneKicker;
  const maxBonusAmount = ((staff.annual_salary || 0) * (jobClass?.max_bonus_percentage || 0)) / 100;
  if (total.total > maxBonusAmount) total.total = maxBonusAmount;
  return total;
};

export const getMetricStatus = (metric) => {
  if (metric?.incomplete) return 'incomplete';
  if (metric?.pass) return 'pass';
  return 'fail';
};