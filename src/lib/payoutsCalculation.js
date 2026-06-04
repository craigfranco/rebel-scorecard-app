/**
 * New payout calculation logic per the redesign spec.
 *
 * Per quarter:
 *   Quarterly Bonus Target = Quarterly Salary × Bonus Target %
 *   KPI Score = hotel's total KPI score for that quarter (max 100)
 *   Bonus Earned = Quarterly Bonus Target × (KPI Score / 100)
 *   Quarterly Payout = Bonus Earned × 50%
 *   Remaining 50% held until year end
 */

/**
 * Get the KPI score (0–100) for a property for a given quarter from ScoreEntry records.
 * Uses the latest entry in the quarter's months.
 */
export function getKpiScoreForQuarter(entries, quarter, year) {
  const quarterMonths = {
    1: [1, 2, 3],
    2: [4, 5, 6],
    3: [7, 8, 9],
    4: [10, 11, 12],
  };
  const months = quarterMonths[quarter] || [];
  const relevant = entries.filter(e => e.year === year && months.includes(e.month));
  if (!relevant.length) return null;
  // Use the latest entry
  const latest = relevant[relevant.length - 1];
  // Sum up the KPI scores from scorecard fields — use the raw score fields present
  // We derive a score from scorecard-equivalent fields: budgeted GOP (35), GOP margin (35), RGI (15), GSS (15)
  // But entries don't store total score — import from scoring lib
  return latest; // Return the entry; caller will use calculateScorecard
}

/**
 * Calculate per-quarter payout data for a staff member.
 * Returns array of 4 quarter objects.
 */
export function calculateQuarterlyPayouts(staff, entriesByQuarter, scorecardFn, property) {
  const quarters = [1, 2, 3, 4];
  return quarters.map(q => {
    const salary = parseFloat(staff[`salary_q${q}`]) || 0;
    const bonusTargetPct = parseFloat(staff.bonus_target_pct) || 0;
    const bonusTarget = salary * (bonusTargetPct / 100);

    const entry = entriesByQuarter[q];
    let kpiScore = null;
    let bonusEarned = 0;
    let quarterlyPayout = 0;
    let hasData = false;

    if (entry && property) {
      const scorecard = scorecardFn(entry, property);
      kpiScore = scorecard?.total?.total ?? null;
      hasData = kpiScore !== null;
    }

    if (hasData && bonusTarget > 0) {
      bonusEarned = bonusTarget * (kpiScore / 100);
      quarterlyPayout = bonusEarned * 0.5;
    }

    return {
      quarter: q,
      salary,
      bonusTargetPct,
      bonusTarget,
      kpiScore,
      bonusEarned,
      quarterlyPayout,
      retainedBonus: bonusEarned * 0.5,
      hasData,
      hasSalary: salary > 0,
    };
  });
}

/**
 * New annual salary estimate logic per spec:
 * - Only Q1 entered → Q1 × 4
 * - Q1 + Q2 → Q1 + Q2 + (Q2 × 2)
 * - Q1 + Q2 + Q3 → Q1 + Q2 + Q3 + Q3
 * - All 4 → sum (actual)
 */
export function calcEstimatedAnnualSalary(staff) {
  const q1 = parseFloat(staff.salary_q1) || 0;
  const q2 = parseFloat(staff.salary_q2) || 0;
  const q3 = parseFloat(staff.salary_q3) || 0;
  const q4 = parseFloat(staff.salary_q4) || 0;

  const hasQ4 = q4 > 0;
  const hasQ3 = q3 > 0;
  const hasQ2 = q2 > 0;
  const hasQ1 = q1 > 0;

  if (hasQ4) return { value: q1 + q2 + q3 + q4, isEstimate: false };
  if (hasQ3) return { value: q1 + q2 + q3 + q3, isEstimate: true };
  if (hasQ2) return { value: q1 + q2 + q2 * 2, isEstimate: true };
  if (hasQ1) return { value: q1 * 4, isEstimate: true };
  return { value: 0, isEstimate: false };
}

/**
 * Calculate annual summary from quarterly payout data.
 */
export function calcAnnualSummary(quarterlyData, staff) {
  const { value: annualSalary, isEstimate } = calcEstimatedAnnualSalary(staff);

  const quartersWithData = quarterlyData.filter(q => q.hasData && q.hasSalary);
  const totalBonusEarned = quarterlyData.reduce((sum, q) => sum + q.bonusEarned, 0);
  const totalQuarterlyPayouts = quarterlyData.reduce((sum, q) => sum + q.quarterlyPayout, 0);
  const remainingBonus = quarterlyData.reduce((sum, q) => sum + q.retainedBonus, 0);
  const totalPayout = totalQuarterlyPayouts + remainingBonus; // = totalBonusEarned

  return {
    annualSalary,
    isEstimate,
    totalBonusEarned,
    totalQuarterlyPayouts,
    remainingBonus,
    totalPayout,
    quartersWithData: quartersWithData.length,
  };
}

export function kpiScoreColor(score) {
  if (score === null || score === undefined) return 'text-muted-foreground';
  if (score >= 75) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-500';
  return 'text-red-500';
}

export function kpiScoreBg(score) {
  if (score === null || score === undefined) return 'bg-muted text-muted-foreground';
  if (score >= 75) return 'bg-emerald-100 text-emerald-700';
  if (score >= 50) return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-600';
}

export function fmt$(value) {
  if (!value && value !== 0) return '—';
  return '$' + Math.round(value).toLocaleString('en-US');
}