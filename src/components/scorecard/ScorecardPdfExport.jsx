import React from 'react';
import { jsPDF } from 'jspdf';
import { calculateScorecard, normalizeGssTo100, hasForecastData, MONTHS, getQuarterFromMonth, aggregateEntries } from '@/lib/scoring';
import { formatBrandLabel } from '@/lib/portfolioHelpers';

// REBEL Hotel Company logo URL
const REBEL_LOGO_URL = 'https://media.base44.com/images/public/69d3e20c8254476c324dc91c/624d887cf_RHC_Blue.png';
// Consistent slate blue accent (matches app theme #2d4b5e)
const ACCENT_COLOR = [45, 75, 94];

function getBrandColor(brand) {
  return ACCENT_COLOR;
}

// Full dollar formatting — no abbreviation, ever
function fmtDollar(val) {
  if (val == null) return '—';
  const abs = Math.abs(Math.round(val));
  const formatted = '$' + abs.toLocaleString('en-US');
  return val < 0 ? '-' + formatted : formatted;
}

function fmtPct(val, decimals = 1) {
  if (val == null) return '—';
  return (val >= 0 ? '+' : '') + val.toFixed(decimals) + '%';
}

function fmtPts(val, decimals = 1) {
  if (val == null) return '—';
  return (val >= 0 ? '+' : '') + val.toFixed(decimals) + ' pts';
}

function fmtNum(val, decimals = 1) {
  if (val == null) return '—';
  return val.toFixed(decimals);
}

function getPeriodLabel(periodType, selectedMonth, selectedYear) {
  if (periodType === 'month') return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
  if (periodType === 'quarter') return `Q${getQuarterFromMonth(selectedMonth)} ${selectedYear} TD`;
  return `YTD ${selectedYear}`;
}

export function generateScorecardPDF(property, entry, periodType, selectedMonth, selectedYear) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const W = doc.internal.pageSize.getWidth();   // 792
  const H = doc.internal.pageSize.getHeight();  // 612

  const scorecard = calculateScorecard(entry, property);
  const brand = property?.parent_brand || 'Independent';
  const accent = getBrandColor(brand);
  const periodLabel = getPeriodLabel(periodType, selectedMonth, selectedYear);
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── Accent bar ──────────────────────────────────────────────────────────────
  doc.setFillColor(...accent);
  doc.rect(0, 0, W, 8, 'F');

  // ── Header ──────────────────────────────────────────────────────────────────
  const headerH = 68;
  doc.setFillColor(248, 250, 252);
  doc.rect(0, 8, W, headerH, 'F');

  // Logo image
  doc.addImage(REBEL_LOGO_URL, 'PNG', 28, 14, 80, 40, undefined, 'FAST');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('Balanced Scorecard', 28, 62);

  // Hotel name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(property?.name || '—', 120, 34);

  // Right side meta
  const metaX = W - 28;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`${formatBrandLabel(property?.parent_brand, property?.sub_brand)}`, metaX, 24, { align: 'right' });
  doc.text(`GM: ${property?.gm_name || '—'}`, metaX, 36, { align: 'right' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(...accent);
  doc.text(periodLabel, metaX, 50, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated: ${today}`, metaX, 64, { align: 'right' });

  // ── KPI SUMMARY BOXES ───────────────────────────────────────────────────────
  const boxY = 88;
  const boxH = 90;
  const boxGap = 8;
  const boxW = (W - 56 - boxGap * 3) / 4;

  const gopA = entry.budgeted_gop_actual;
  const gopB = entry.budgeted_gop_target;
  const gopVariance = (gopA != null && gopB != null) ? gopA - gopB : null;
  const gopPct = (gopA != null && gopB != null && gopB !== 0)
    ? gopB > 0 ? (gopA / gopB) * 100 : ((gopA - gopB) / Math.abs(gopB)) * 100
    : null;

  const marginTy = entry.gop_margin_actual;
  const marginPy = entry.gop_margin_prior;
  const marginVar = entry.gop_margin_improvement != null
    ? entry.gop_margin_improvement
    : ((marginTy != null && marginPy != null) ? marginTy - marginPy : null);

  const rgiTy = entry.revpar_index;
  const rgiChg = entry.revpar_index_change;
  const rgiLy = entry.revpar_index_prior != null
    ? entry.revpar_index_prior
    : (rgiTy != null && rgiChg != null) ? rgiTy / (1 + rgiChg / 100) : null;

  const gssNorm = normalizeGssTo100(entry.gss_actual, brand);
  const gssPriorNorm = normalizeGssTo100(entry.gss_prior, brand);
  const gssVar = (gssNorm != null && gssPriorNorm != null) ? gssNorm - gssPriorNorm : null;

  const summaryBoxes = [
    {
      title: 'Budgeted GOP',
      headline: gopVariance != null ? fmtDollar(gopVariance) : '—',
      headlineColor: gopVariance == null ? [100,116,139] : gopVariance >= 0 ? [76,175,80] : [239,68,68],
      sub: 'vs Budget',
      rows: [
        ['Actual', fmtDollar(gopA)],
        ['Budget', fmtDollar(gopB)],
        ['Achievement', gopPct != null ? gopPct.toFixed(1) + '%' : '—'],
      ],
    },
    {
      title: 'GOP Margin (vs LY)',
      headline: marginVar != null ? fmtPts(marginVar) : '—',
      headlineColor: marginVar == null ? [100,116,139] : marginVar >= 0 ? [76,175,80] : [239,68,68],
      sub: 'pts vs LY',
      rows: [
        ['TY Margin', marginTy != null ? marginTy.toFixed(1) + '%' : '—'],
        ['LY Margin', marginPy != null ? marginPy.toFixed(1) + '%' : '—'],
      ],
    },
    {
      title: 'RevPAR Index (RGI)',
      headline: rgiChg != null ? fmtPct(rgiChg) : '—',
      headlineColor: rgiChg == null ? [100,116,139] : rgiChg >= 0.1 ? [76,175,80] : [239,68,68],
      sub: 'YOY Change',
      rows: [
        ['TY Index', fmtNum(rgiTy)],
        ['LY Index', fmtNum(rgiLy)],
      ],
    },
    {
      title: 'GSS Score (100-pt)',
      headline: gssVar != null ? fmtPts(gssVar) : '—',
      headlineColor: gssVar == null ? [100,116,139] : gssVar >= 0 ? [76,175,80] : [239,68,68],
      sub: 'pts vs LY',
      rows: [
        ['TY Score', fmtNum(gssNorm)],
        ['LY Score', fmtNum(gssPriorNorm)],
      ],
    },
  ];

  summaryBoxes.forEach((box, i) => {
    const bx = 28 + i * (boxW + boxGap);

    // Box background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(bx, boxY, boxW, boxH, 4, 4, 'FD');

    // Accent top strip
    doc.setFillColor(...accent);
    doc.roundedRect(bx, boxY, boxW, 3, 2, 2, 'F');

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(box.title.toUpperCase(), bx + 8, boxY + 14);

    // Headline value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...box.headlineColor);
    doc.text(box.headline, bx + 8, boxY + 32);

    // Sub label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(box.sub, bx + 8, boxY + 42);

    // Divider
    doc.setDrawColor(226, 232, 240);
    doc.line(bx + 8, boxY + 50, bx + boxW - 8, boxY + 50);

    // Sub-rows
    box.rows.forEach((row, ri) => {
      const ry = boxY + 62 + ri * 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(row[0], bx + 8, ry);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(row[1], bx + boxW - 8, ry, { align: 'right' });
    });
  });

  // ── KPI DETAIL TABLE ─────────────────────────────────────────────────────────
  const tableY = boxY + boxH + 12;
  const tableH = 126;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(28, tableY, W - 56, tableH, 4, 4, 'FD');

  // Table header
  doc.setFillColor(...accent);
  doc.roundedRect(28, tableY, W - 56, 18, 4, 4, 'F');
  doc.setFillColor(...accent);
  doc.rect(28, tableY + 10, W - 56, 8, 'F');

  const cols = [
    { label: 'KPI', x: 36, w: 160, align: 'left' },
    { label: 'Weight', x: 200, w: 44, align: 'center' },
    { label: 'Actual', x: 248, w: 80, align: 'center' },
    { label: 'Target', x: 332, w: 100, align: 'center' },
    { label: 'Variance', x: 436, w: 80, align: 'center' },
    { label: 'Score', x: 520, w: 56, align: 'center' },
    { label: 'Status', x: 580, w: 80, align: 'center' },
                                   // 660 — fits within 792-28=764
  ];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  cols.forEach(c => {
    const tx = c.align === 'center' ? c.x + c.w / 2 : c.x;
    doc.text(c.label, tx, tableY + 12, { align: c.align === 'center' ? 'center' : 'left' });
  });

  // Build KPI rows data
  const rgiTarget = (rgiTy != null && rgiChg != null) ? (rgiTy / (1 + rgiChg / 100)) * 1.001 : null;
  const gssStd = scorecard.gssStd;

  const kpiData = [
    {
      name: 'Budgeted GOP',
      weight: '35%',
      target: gopB != null ? fmtDollar(gopB) : '—',
      actual: fmtDollar(gopA),
      ly: fmtDollar(gopB), // LY = budget for GOP
      variance: gopVariance != null ? fmtDollar(gopVariance) : '—',
      variancePos: gopVariance != null ? gopVariance >= 0 : null,
      score: scorecard.gop.score,
      max: 35,
      pass: scorecard.gop.pass,
      incomplete: scorecard.gop.incomplete,
    },
    {
      name: 'GOP Margin Improvement',
      weight: '35%',
      target: marginPy != null ? (marginPy + 0.1).toFixed(1) + '%' : '—',
      actual: marginTy != null ? marginTy.toFixed(1) + '%' : '—',
      ly: marginPy != null ? marginPy.toFixed(1) + '%' : '—',
      variance: marginVar != null ? fmtPts(marginVar) : '—',
      variancePos: marginVar != null ? marginVar >= 0 : null,
      score: scorecard.gopMargin.score,
      max: 35,
      pass: scorecard.gopMargin.pass,
      incomplete: scorecard.gopMargin.incomplete,
    },
    {
      name: 'RevPAR Index % Change (RGI)',
      weight: '15%',
      target: rgiLy != null ? (rgiLy * 1.001).toFixed(1) : '—',
      actual: rgiTy != null ? rgiTy.toFixed(1) : '—',
      ly: rgiLy != null ? rgiLy.toFixed(1) : '—',
      variance: rgiChg != null ? fmtPct(rgiChg) : '—',
      variancePos: rgiChg != null ? rgiChg >= 0.1 : null,
      score: scorecard.rgi.score,
      max: 15,
      pass: scorecard.rgi.pass,
      incomplete: scorecard.rgi.incomplete,
    },
    {
      name: `GSS — ${gssStd.label}`,
      weight: '15%',
      target: gssPriorNorm != null ? '>' + gssPriorNorm.toFixed(1) : '—',
      actual: gssNorm != null ? gssNorm.toFixed(1) : '—',
      ly: gssPriorNorm != null ? gssPriorNorm.toFixed(1) : '—',
      variance: gssVar != null ? fmtPts(gssVar) : '—',
      variancePos: gssVar != null ? gssVar >= 0 : null,
      score: scorecard.gss.score,
      max: 15,
      pass: scorecard.gss.pass,
      incomplete: scorecard.gss.incomplete,
    },
  ];

  kpiData.forEach((row, ri) => {
    const ry = tableY + 18 + ri * 24;
    const rowBg = ri % 2 === 0 ? [255, 255, 255] : [248, 250, 252];
    doc.setFillColor(...rowBg);
    doc.rect(28, ry, W - 56, 24, 'F');

    const cy = ry + 15;

    // KPI name
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);
    doc.text(row.name, cols[0].x, cy);

    // Weight
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(row.weight, cols[1].x + cols[1].w / 2, cy, { align: 'center' });

    // Actual
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(row.actual, cols[2].x + cols[2].w / 2, cy, { align: 'center' });

    // Target (stacked: Target value on top, LY below in smaller gray text)
    const targetX = cols[3].x + cols[3].w / 2;
    const isGOP = row.name === 'Budgeted GOP';
    if (isGOP) {
      // Budgeted GOP: single line (already formatted as dollar amount)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(row.target, targetX, cy, { align: 'center' });
    } else {
      // Other KPIs: stacked format (Target on top, LY below)
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text(row.target, targetX, cy - 4, { align: 'center' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text('LY: ' + row.ly, targetX, cy + 3, { align: 'center' });
    }

    // Variance
    const varColor = row.variancePos == null ? [100, 116, 139] : row.variancePos ? [76, 175, 80] : [239, 68, 68];
    doc.setTextColor(...varColor);
    doc.text(row.variance, cols[4].x + cols[4].w / 2, cy, { align: 'center' });

    // Score
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    const scoreStr = row.incomplete ? '—' : `${row.score.toFixed(1)} / ${row.max}`;
    doc.text(scoreStr, cols[5].x + cols[5].w / 2, cy, { align: 'center' });

    // Status badge
    if (!row.incomplete) {
      const badgeColor = row.pass ? [76, 175, 80] : [239, 68, 68];
      const badgeLabel = row.pass ? 'PASS' : 'FAIL';
      const bx = cols[6].x + cols[6].w / 2;
      doc.setFillColor(...badgeColor);
      doc.roundedRect(bx - 18, cy - 9, 36, 13, 3, 3, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text(badgeLabel, bx, cy, { align: 'center' });
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('N/A', cols[6].x + cols[6].w / 2, cy, { align: 'center' });
    }
  });

  // Total score row
  const totalY = tableY + 18 + kpiData.length * 24;
  doc.setFillColor(...accent);
  doc.rect(28, totalY, W - 56, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('TOTAL SCORE', cols[0].x, totalY + 13);
  const anyIncomplete = kpiData.some(r => r.incomplete);
  const totalScore = scorecard.total.total;
  const maxPossible = scorecard.total.maxPossible;
  doc.text(anyIncomplete ? '—' : `${totalScore} / ${maxPossible}`, cols[5].x + cols[5].w / 2, totalY + 13, { align: 'center' });
  // No overall pass/fail badge — total score is a sum only, not evaluated against a threshold

  // ── BONUS EXCEPTION BANNER (if applicable) ─────────────────────────────────
  let exceptionBannerH = 0;
  if (entry.bonus_exceptions && entry.bonus_exceptions.length > 0) {
    const excY = tableY + tableH + 8;
    const excListH = entry.bonus_exceptions.length * 10;
    exceptionBannerH = 20 + excListH + 14;

    doc.setFillColor(255, 251, 235); // amber-50
    doc.setDrawColor(251, 191, 36);  // amber-400
    doc.roundedRect(28, excY, W - 56, exceptionBannerH, 4, 4, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(180, 83, 9); // amber-900
    doc.text('BONUS EXCEPTION ADJUSTMENT', 36, excY + 12);

    let ey = excY + 22;
    entry.bonus_exceptions.forEach((exc) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(180, 83, 9);
      doc.text(fmtDollar(exc.amount), 36, ey);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 53, 15); // amber-800
      const descText = `${exc.category}: ${exc.description}`;
      const descLines = doc.splitTextToSize(descText, W - 56 - 90);
      doc.text(descLines[0], 90, ey);
      ey += 10;
    });

    // Summary: raw → adjusted
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(120, 53, 15);
    const rawGop = entry.budgeted_gop_actual_raw;
    const adjGop = entry.budgeted_gop_actual;
    const rawMargin = entry.gop_margin_actual_raw;
    const adjMargin = entry.gop_margin_actual;
    const summaryParts = [];
    if (rawGop != null && adjGop != null) summaryParts.push(`GOP: ${fmtDollar(rawGop)} → ${fmtDollar(adjGop)}`);
    if (rawMargin != null && adjMargin != null) summaryParts.push(`Margin: ${rawMargin.toFixed(1)}% → ${adjMargin.toFixed(1)}%`);
    if (summaryParts.length) {
      doc.text(summaryParts.join('   |   '), 36, ey + 2);
    }
  }

  // ── FORECAST + KICKERS + NARRATIVE ──────────────────────────────────────────
  const bottomY = tableY + tableH + 10 + exceptionBannerH;
  const bottomH = H - bottomY - 28;

  // Forecast section (left ~38%)
  const fcW = Math.floor((W - 56) * 0.38);
  const fcX = 28;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(fcX, bottomY, fcW, bottomH, 4, 4, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...accent);
  doc.text('FORECAST KICKER', fcX + 8, bottomY + 12);

  const fcActual = entry.forecast_actual_revenue;
  const fcForecast = entry.forecast_primary_forecast;
  const fcVariance = (fcActual != null && fcForecast != null) ? fcActual - fcForecast : null;
  const fcHasData = hasForecastData(entry);
  const fcHit = fcHasData ? (entry.forecast_kicker || false) : false;

  doc.setDrawColor(226, 232, 240);
  doc.line(fcX + 8, bottomY + 16, fcX + fcW - 8, bottomY + 16);

  const fcRows = [
    ['Actual Revenue', fmtDollar(fcActual)],
    ['Primary Forecast', fmtDollar(fcForecast)],
    ['Variance', fcVariance != null ? fmtDollar(fcVariance) : '—'],
  ];

  fcRows.forEach(([label, val], ri) => {
    const ry = bottomY + 26 + ri * 14;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(label, fcX + 8, ry);
    doc.setFont('helvetica', 'bold');
    const isVariance = label === 'Variance';
    const valColor = isVariance && fcVariance != null
      ? (fcVariance >= 0 ? [76, 175, 80] : [239, 68, 68])
      : [30, 41, 59];
    doc.setTextColor(...valColor);
    doc.text(val, fcX + fcW - 8, ry, { align: 'right' });
  });

  // Kicker badge
  if (fcHasData) {
    const badgeColor = fcHit ? [76, 175, 80] : [239, 68, 68];
    doc.setFillColor(...badgeColor);
    doc.roundedRect(fcX + 8, bottomY + 70, 50, 14, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(fcHit ? 'HIT ✓' : 'MISS ✗', fcX + 33, bottomY + 80, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('No forecast data', fcX + 8, bottomY + 80);
  }

  // Red Zone kicker
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...accent);
  doc.text('RED ZONE KICKER', fcX + 8, bottomY + 100);
  doc.setDrawColor(226, 232, 240);
  doc.line(fcX + 8, bottomY + 104, fcX + fcW - 8, bottomY + 104);
  const rzHit = entry.red_zone_kicker || false;
  if (brand !== 'Independent') {
    const rzColor = rzHit ? [76, 175, 80] : [239, 68, 68];
    doc.setFillColor(...rzColor);
    doc.roundedRect(fcX + 8, bottomY + 110, 50, 14, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(rzHit ? 'HIT ✓' : 'MISS ✗', fcX + 33, bottomY + 120, { align: 'center' });
  } else {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('N/A (Independent)', fcX + 8, bottomY + 120);
  }

  // Narrative section (right ~60%)
  const narX = fcX + fcW + 8;
  const narW = W - 56 - fcW - 8;

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(narX, bottomY, narW, bottomH, 4, 4, 'FD');

  const narSections = [
    { label: 'KEY WINS', value: entry.key_wins },
    { label: 'PREVIOUS RESULTS', value: entry.previous_results },
    { label: 'NEXT PRIORITIES', value: entry.next_priorities },
  ];

  const narColW = Math.floor(narW / 3) - 6;
  narSections.forEach((sec, i) => {
    const nx = narX + 8 + i * (narColW + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...accent);
    doc.text(sec.label, nx, bottomY + 12);
    doc.setDrawColor(226, 232, 240);
    doc.line(nx, bottomY + 16, nx + narColW, bottomY + 16);
    if (sec.value) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(51, 65, 85);
      const lines = doc.splitTextToSize(sec.value, narColW);
      doc.text(lines.slice(0, Math.floor((bottomH - 24) / 10)), nx, bottomY + 26);
    } else {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('No data entered', nx, bottomY + 26);
    }
  });

  // ── FOOTER ───────────────────────────────────────────────────────────────────
  doc.setFillColor(248, 250, 252);
  doc.rect(0, H - 22, W, 22, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.line(0, H - 22, W, H - 22);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  const preparedBy = entry.prepared_by ? `Prepared by: ${entry.prepared_by}` : '';
  const reviewedBy = entry.reviewed_by ? `Reviewed by: ${entry.reviewed_by}` : '';
  const footerLeft = [preparedBy, reviewedBy].filter(Boolean).join('   |   ');
  if (footerLeft) doc.text(footerLeft, 28, H - 8);
  doc.text('Page 1 of 1', W - 28, H - 8, { align: 'right' });
  doc.setTextColor(...accent);
  doc.text('REBEL Hotel Co. — Confidential', W / 2, H - 8, { align: 'center' });

  // ── SAVE ─────────────────────────────────────────────────────────────────────
  const filename = `scorecard_${(property?.name || 'hotel').replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}.pdf`;
  doc.save(filename);
}