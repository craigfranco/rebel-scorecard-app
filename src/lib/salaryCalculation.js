/**
 * Determines which quarters have closed based on current date.
 * 2026 quarter dates:
 * Q1: Jan 1 - Mar 31
 * Q2: Apr 1 - Jun 30
 * Q3: Jul 1 - Sep 30
 * Q4: Oct 1 - Dec 31
 */
export function getClosedQuarters(currentDate = new Date()) {
  const month = currentDate.getMonth() + 1; // 1-12
  const day = currentDate.getDate();
  
  const closed = [];
  
  // Q1 closes on Mar 31 (month 3, day 31)
  if (month > 3 || (month === 3 && day >= 31)) {
    closed.push(1);
  }
  
  // Q2 closes on Jun 30 (month 6, day 30)
  if (month > 6 || (month === 6 && day >= 30)) {
    closed.push(2);
  }
  
  // Q3 closes on Sep 30 (month 9, day 30)
  if (month > 9 || (month === 9 && day >= 30)) {
    closed.push(3);
  }
  
  // Q4 closes on Dec 31 (month 12, day 31)
  if (month === 12 && day >= 31) {
    closed.push(4);
  }
  
  return closed;
}

/**
 * Calculates estimated annual salary based on closed quarters (extrapolates if < 4 quarters).
 * If only Q1 is closed: Q1 × 4
 * If Q1+Q2 are closed: (Q1 + Q2) / 2 × 4
 * If Q1+Q2+Q3 are closed: (Q1 + Q2 + Q3) / 3 × 4
 * If all closed: Q1 + Q2 + Q3 + Q4
 */
export function calculateEstimatedAnnualSalary(staff, closedQuarters = null) {
  if (!staff) return 0;
  
  const closed = closedQuarters || getClosedQuarters();
  
  if (closed.length === 0) return 0;
  
  let sum = 0;
  for (const q of closed) {
    const salary = parseFloat(staff[`salary_q${q}`]) || 0;
    sum += salary;
  }
  
  if (closed.length === 4) {
    return sum; // All quarters, just sum them
  } else {
    return (sum / closed.length) * 4; // Extrapolate to full year
  }
}

/**
 * Returns the sum of only the quarters that have actual salary data entered.
 * No extrapolation — only counts quarters where salary > 0.
 * Also returns which quarters contributed and the count.
 */
export function calculateActualYtdSalary(staff) {
  if (!staff) return { total: 0, quarters: [], count: 0 };
  const quarters = [];
  let total = 0;
  for (let q = 1; q <= 4; q++) {
    const salary = parseFloat(staff[`salary_q${q}`]) || 0;
    if (salary > 0) {
      quarters.push(q);
      total += salary;
    }
  }
  return { total, quarters, count: quarters.length };
}