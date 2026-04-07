export const calculateBonusForMetric = (staff, scorecard, jobClass) => {
  const bonuses = {
    gop: 0,
    gopMargin: 0,
    rgi: 0,
    gss: 0,
    total: 0,
    metricsHit: {}
  };

  // GOP Bonus - 10% of budgeted GOP if pass
  if (scorecard.gop?.pass) {
    bonuses.gop = (staff.annual_salary * jobClass.gop_bonus_percentage) / 100;
    bonuses.metricsHit.gop = true;
  }

  // GOP Margin Bonus - 10% if pass
  if (scorecard.gopMargin?.pass) {
    bonuses.gopMargin = (staff.annual_salary * jobClass.gop_margin_bonus_percentage) / 100;
    bonuses.metricsHit.gopMargin = true;
  }

  // RGI Bonus - 7.5% for 0.1-2.0%, 15% for 2.1%+
  if (scorecard.rgi?.pass) {
    const rgiChange = scorecard.rgiChange || 0;
    if (rgiChange >= 2.1) {
      bonuses.rgi = (staff.annual_salary * jobClass.rgi_bonus_percentage_high) / 100;
    } else if (rgiChange >= 0.1) {
      bonuses.rgi = (staff.annual_salary * jobClass.rgi_bonus_percentage_low) / 100;
    }
    bonuses.metricsHit.rgi = true;
  }

  // GSS Bonus - if GSS improves +1.0% YOY
  if (scorecard.gss?.pass) {
    bonuses.gss = (staff.annual_salary * jobClass.gss_bonus_percentage) / 100;
    bonuses.metricsHit.gss = true;
  }

  bonuses.total = bonuses.gop + bonuses.gopMargin + bonuses.rgi + bonuses.gss;
  return bonuses;
};

export const calculateQuarterlyBonus = (staff, scorecard, jobClass) => {
  const bonus = calculateBonusForMetric(staff, scorecard, jobClass);
  // Quarterly is 50% of annual
  return {
    ...bonus,
    gop: bonus.gop * 0.5,
    gopMargin: bonus.gopMargin * 0.5,
    rgi: bonus.rgi * 0.5,
    gss: bonus.gss * 0.5,
    total: bonus.total * 0.5
  };
};

export const calculateAnnualBonus = (staff, scorecards, jobClass) => {
  // Sum all quarterly bonuses
  let totalBonus = {
    gop: 0,
    gopMargin: 0,
    rgi: 0,
    gss: 0,
    total: 0,
    metricsHit: {}
  };

  scorecards.forEach(scorecard => {
    const quarterly = calculateQuarterlyBonus(staff, scorecard, jobClass);
    totalBonus.gop += quarterly.gop;
    totalBonus.gopMargin += quarterly.gopMargin;
    totalBonus.rgi += quarterly.rgi;
    totalBonus.gss += quarterly.gss;
  });

  totalBonus.total = totalBonus.gop + totalBonus.gopMargin + totalBonus.rgi + totalBonus.gss;

  // Cap at max bonus percentage
  const maxBonusAmount = (staff.annual_salary * jobClass.max_bonus_percentage) / 100;
  if (totalBonus.total > maxBonusAmount) {
    totalBonus.total = maxBonusAmount;
  }

  return totalBonus;
};

export const getMetricStatus = (metric) => {
  if (metric?.incomplete) return 'incomplete';
  if (metric?.pass) return 'pass';
  return 'fail';
};