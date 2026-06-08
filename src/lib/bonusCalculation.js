/**
 * Quarterly bonus calculation using quarterly salary × per-KPI bonus %.
 *
 * Each KPI earns independently:
 *   GOP:       PASS → gop_bonus_percentage × quarterly_salary
 *   Margin:    PASS → gop_margin_bonus_percentage × quarterly_salary
 *   RGI full:  tier='full' → rgi_bonus_percentage_high × quarterly_salary
 *   RGI partial: tier='partial' → (rgi_bonus_percentage_high / 2) × quarterly_salary
 *   GSS:       PASS → gss_bonus_percentage × quarterly_salary
 */
export function calcKpiBonus(quarterlySalary, scorecard, jobClass) {
  if (!jobClass || !scorecard || !quarterlySalary) {
    return { gop: 0, gopMargin: 0, rgi: 0, gss: 0, total: 0 };
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
      : sal * (highPct / 2) / 100; // partial
  }

  // GSS
  const gss = (!scorecard.gss?.incomplete && scorecard.gss?.pass)
    ? sal * (jobClass.gss_bonus_percentage || 0) / 100
    : 0;

  const total = gop + gopMargin + rgi + gss;

  return { gop, gopMargin, rgi, gss, total };
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
    gopGatekeeperPassed: true,
    gopGatekeeperMessage: '',
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
    total.gop += q.gop;
    total.gopMargin += q.gopMargin;
    total.rgi += q.rgi;
    total.gss += q.gss;
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