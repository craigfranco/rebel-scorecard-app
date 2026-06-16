/**
 * Bonus eligibility gate: staff must meet BOTH RGI (partial or full) AND GSS (pass)
 * to receive any bonus that quarter. If either fails → total bonus = $0.
 *
 * Returns: { eligible: boolean, rgiMet: boolean, gssMet: boolean, reason: string }
 */
export function checkBonusEligibility(scorecard) {
  if (!scorecard) return { eligible: false, rgiMet: false, gssMet: false, reason: 'No scorecard data' };

  const rgiMet = !scorecard.rgi?.incomplete && scorecard.rgi?.pass === true;
  const gssMet = !scorecard.gss?.incomplete && scorecard.gss?.pass === true;
  const eligible = rgiMet && gssMet;

  let reason = '';
  if (!eligible) {
    const missing = [];
    if (!rgiMet) missing.push('RGI Improvement');
    if (!gssMet) missing.push('GSS Improvement');
    reason = `Not met: ${missing.join(' & ')}`;
  }

  return { eligible, rgiMet, gssMet, reason };
}

/**
 * Quarterly bonus calculation using quarterly salary × per-KPI bonus %.
 *
 * ELIGIBILITY GATE: Both RGI (partial or full) AND GSS must pass.
 * If either fails → all bonus components = $0.
 *
 * When eligible, each KPI earns independently:
 *   GOP:         PASS → gop_bonus_percentage × quarterly_salary
 *   Margin:      PASS → gop_margin_bonus_percentage × quarterly_salary
 *   RGI full:    tier='full' → rgi_bonus_percentage_high × quarterly_salary
 *   RGI partial: tier='partial' → (rgi_bonus_percentage_high / 2) × quarterly_salary
 *   GSS:         PASS → gss_bonus_percentage × quarterly_salary
 */
export function calcKpiBonus(quarterlySalary, scorecard, jobClass) {
  if (!jobClass || !scorecard || !quarterlySalary) {
    return { gop: 0, gopMargin: 0, rgi: 0, gss: 0, total: 0, eligible: false, rgiMet: false, gssMet: false, eligibilityReason: 'Missing data' };
  }

  const eligibility = checkBonusEligibility(scorecard);

  // If not eligible → zero out everything
  if (!eligibility.eligible) {
    return {
      gop: 0, gopMargin: 0, rgi: 0, gss: 0, total: 0,
      eligible: false,
      rgiMet: eligibility.rgiMet,
      gssMet: eligibility.gssMet,
      eligibilityReason: eligibility.reason,
    };
  }

  const sal = quarterlySalary;

  // GOP
  const gop = (!scorecard.gop?.incomplete && scorecard.gop?.pass)
    ? sal * (jobClass.gop_bonus_percentage || 0) / 100
    : 0;

  // GOP Margin
  const gopMargin = (!scorecard.gopMargin?.incomplete && scorecard.gopMargin?.pass)
    ? sal * (jobClass.gop_margin_bonus_percentage || 0) / 100
    : 0;

  // RGI — two tiers; partial = high / 2
  let rgi = 0;
  if (!scorecard.rgi?.incomplete && scorecard.rgi?.pass) {
    const highPct = jobClass.rgi_bonus_percentage_high || 0;
    rgi = scorecard.rgi.tier === 'full'
      ? sal * highPct / 100
      : sal * (highPct / 2) / 100;
  }

  // GSS
  const gss = (!scorecard.gss?.incomplete && scorecard.gss?.pass)
    ? sal * (jobClass.gss_bonus_percentage || 0) / 100
    : 0;

  const total = gop + gopMargin + rgi + gss;

  return { gop, gopMargin, rgi, gss, total, eligible: true, rgiMet: true, gssMet: true, eligibilityReason: '' };
}

// Legacy wrappers — kept so other pages don't break
export const calculateBonusForMetric = (staff, scorecard, jobClass, entry) => {
  const quarterlySalary = staff.annual_salary || 0;
  const result = calcKpiBonus(quarterlySalary, scorecard, jobClass);
  return {
    ...result,
    metricsHit: {
      gop: result.gop > 0,
      gopMargin: result.gopMargin > 0,
      rgi: result.rgi > 0,
      gss: result.gss > 0,
    },
  };
};

export const calculateQuarterlyBonus = (staff, scorecard, jobClass, entry) => {
  const result = calculateBonusForMetric(staff, scorecard, jobClass, entry);
  return { ...result, quarterlyAmount: result.total, annualAmount: result.total };
};

export const calculateAnnualBonus = (staff, scorecards, jobClass, entries = []) => {
  let total = { gop: 0, gopMargin: 0, rgi: 0, gss: 0, total: 0, metricsHit: {} };
  scorecards.forEach((scorecard, idx) => {
    const q = calculateQuarterlyBonus(staff, scorecard, jobClass, entries[idx]);
    // Only accumulate quarters where the staff member was eligible
    if (q.eligible) {
      total.gop += q.gop;
      total.gopMargin += q.gopMargin;
      total.rgi += q.rgi;
      total.gss += q.gss;
    }
  });
  total.total = total.gop + total.gopMargin + total.rgi + total.gss;
  const maxBonusAmount = ((staff.annual_salary || 0) * (jobClass?.max_bonus_percentage || 0)) / 100;
  if (total.total > maxBonusAmount) total.total = maxBonusAmount;
  return total;
};

export const getMetricStatus = (metric) => {
  if (metric?.incomplete) return 'incomplete';
  if (metric?.pass) return 'pass';
  return 'fail';
};