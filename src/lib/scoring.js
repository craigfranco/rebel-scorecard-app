// BSC Scoring Logic — 2026 Incentive Plan

export const GSS_TARGETS = {
  marriott: { metric: "ITR", target: 1.0, label: "Intent to Return +1.0" },
  hilton: { metric: "Stay Score", target: 1.0, label: "Stay Score +1.0" },
  ihg: { metric: "Overall Experience", target: 1.0, label: "Overall Experience +1.0" },
  hyatt: { metric: "Perf Tier", target: 1.0, label: "Performance Tier +1.0" },
  choice: { metric: "Likelihood", target: 0.3, label: "Likelihood +0.3" },
  independent: { metric: "Revinate", target: 0.03, label: "Revinate +0.03" },
};

export function calcBudgetedGOPScore(actual, target) {
  if (!actual || !target || target === 0) return { score: 0, pct: 0, pass: false };
  const pct = (actual / target) * 100;
  const pass = pct >= 100;
  const score = Math.min(35, Math.max(0, (pct / 100) * 35));
  return { score: Math.round(score * 10) / 10, pct: Math.round(pct * 10) / 10, pass };
}

export function calcGOPMarginScore(actual, prior) {
  if (actual == null || prior == null) return { score: 0, improvement: 0, pass: false };
  const improvement = actual - prior;
  const pass = improvement >= 0.1;
  const score = pass ? Math.min(35, Math.max(0, (improvement / 5) * 35)) : 0;
  return { score: Math.round(Math.min(35, score) * 10) / 10, improvement: Math.round(improvement * 100) / 100, pass };
}

export function calcRGIScore(actual, prior) {
  if (!actual || !prior || prior === 0) return { score: 0, change: 0, pass: false };
  const changePct = ((actual - prior) / prior) * 100;
  let score = 0;
  let pass = false;
  if (changePct >= 2.1) {
    score = 15;
    pass = true;
  } else if (changePct >= 0.1) {
    score = 7.5;
    pass = true;
  }
  return { score, change: Math.round(changePct * 100) / 100, pass };
}

export function calcGSSScore(actual, prior, brandType) {
  const target = GSS_TARGETS[brandType]?.target || 1.0;
  if (actual == null || prior == null) return { score: 0, improvement: 0, pass: false };
  const improvement = actual - prior;
  const pass = improvement >= target;
  const score = pass ? 15 : Math.min(15, Math.max(0, (improvement / target) * 15));
  return { score: Math.round(Math.max(0, score) * 10) / 10, improvement: Math.round(improvement * 100) / 100, pass };
}

export function calcTotalScore(entry, brandType) {
  const gop = calcBudgetedGOPScore(entry.budgetedGOP_actual, entry.budgetedGOP_target);
  const margin = calcGOPMarginScore(entry.gopMarginActual, entry.gopMarginPrior);
  const rgi = calcRGIScore(entry.rgiActual, entry.rgiPrior);
  const gss = calcGSSScore(entry.gssActual, entry.gssPrior, brandType);
  
  const total = Math.round((gop.score + margin.score + rgi.score + gss.score) * 10) / 10;
  const pass = total >= 70;
  
  return { gop, margin, rgi, gss, total, pass };
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

export const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];