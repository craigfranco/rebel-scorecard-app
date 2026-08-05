/**
 * GOP GATEKEEPER: Both Budgeted GOP $ AND GOP Margin must pass to earn
 * either the GOP $ or Margin $ bonus component. If either fails → both = $0.
 * RGI and GSS calculate independently of the gatekeeper.
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
 * GOP GATEKEEPER: Both Budgeted GOP $ AND GOP Margin must pass to earn
 * either the GOP $ component or the Margin $ component. If either fails,
 * both the GOP bonus and the Margin bonus = $0.
 *   - GOP $ + Margin pass → earns GOP $ bonus AND Margin bonus
 *   - Either fails        → both GOP and Margin bonuses = $0
 *   - RGI / GSS           → always calculate independently of the gatekeeper
 *
 * GSS 4-tier: uses scorecard.gss.payoutPct (0, 0.25, 0.75, 1.0).
 * RGI two-tier: full = rgi_bonus_percentage_high × salary; partial = 50% of that.
 *
 * Red Zone kicker: +25% of GSS payout for hotels that started in Red Zone
 * and are showing GSS improvement (tier >= threshold).
 */
export function calcKpiBonus(quarterlySalary, scorecard, jobClass, property = null) {
  if (!jobClass || !scorecard || !quarterlySalary) {
    return { gop: 0, gopMargin: 0, rgi: 0, gss: 0, redZoneKicker: 0, total: 0, eligible: true, gopPassed: false, marginPassed: false, gopGatePassed: false, gopGate: { passed: false, gopPassed: false, marginPassed: false }, eligibilityReason: 'Missing data' };
  }

  const sal = quarterlySalary;

  // GOP GATEKEEPER: BOTH Budgeted GOP $ and GOP Margin must pass to earn
  // either component. If either fails → both GOP and Margin bonuses = $0.
  const gopPassed = !scorecard.gop?.incomplete && scorecard.gop?.pass === true;
  const marginPassed = !scorecard.gopMargin?.incomplete && scorecard.gopMargin?.pass === true;
  const gatePassed = gopPassed && marginPassed;

  const gop = gatePassed ? sal * (jobClass.gop_bonus_percentage || 0) / 100 : 0;
  const gopMargin = gatePassed ? sal * (jobClass.gop_margin_bonus_percentage || 0) / 100 : 0;

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
    gopPassed,
    marginPassed,
    gopGatePassed: gatePassed, // combined GOP + Margin gatekeeper
    gopGate: { passed: gatePassed, gopPassed, marginPassed },
    eligibilityReason: '',
  };
}

// Legacy: checkBonusEligibility — always eligible now (gate is the combined GOP+Margin gatekeeper inside calcKpiBonus)
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