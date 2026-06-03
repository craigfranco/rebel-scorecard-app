import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { calculateScorecard, MONTHS, getQuarterFromMonth, hasForecastData, normalizeGssTo100 } from '@/lib/scoring';
import { formatBrandLabel } from '@/lib/portfolioHelpers';

const BRAND_COLORS = {
  Marriott: '#C41E3A',
  Hilton: '#003087',
  IHG: '#004B8D',
  Hyatt: '#8B1538',
  Choice: '#00447C',
  Independent: '#2d4b5e',
};

function fmt$(v) { return v != null ? '$' + Math.round(v).toLocaleString('en-US') : '—'; }
function fmtPct(v, d = 1) { return v != null ? (v >= 0 ? '+' : '') + v.toFixed(d) + '%' : '—'; }
function fmtPts(v, d = 1) { return v != null ? (v >= 0 ? '+' : '') + v.toFixed(d) + ' pts' : '—'; }
function fmtIdx(v) { return v != null ? v.toFixed(1) : '—'; }
function fmtRaw(v, d = 1) { return v != null ? v.toFixed(d) : '—'; }

function getPeriodLabel(periodType, selectedMonth, selectedYear) {
  if (periodType === 'ytd') return `YTD ${selectedYear}`;
  if (periodType === 'quarter') return `Q${getQuarterFromMonth(selectedMonth)} ${selectedYear}`;
  return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
}

function buildHtmlPage(property, entry, scorecard, periodLabel) {
  const brand = property.parent_brand || 'Independent';
  const accentColor = BRAND_COLORS[brand] || BRAND_COLORS.Independent;
  const anyIncomplete = !scorecard || scorecard.gop.incomplete || scorecard.gopMargin.incomplete;

  const gopA = entry.budgeted_gop_actual;
  const gopB = entry.budgeted_gop_target;
  const gopVariance = (gopA != null && gopB != null) ? gopA - gopB : null;
  const gopPct = (gopA != null && gopB != null && gopB !== 0)
    ? gopB > 0 ? (gopA / gopB) * 100 : ((gopA - gopB) / Math.abs(gopB)) * 100
    : null;

  const marginTy = entry.gop_margin_actual;
  const marginLy = entry.gop_margin_prior;
  const marginVar = (marginTy != null && marginLy != null) ? marginTy - marginLy : null;

  const rgiTy = entry.revpar_index;
  const rgiChg = entry.revpar_index_change;
  const rgiLy = (rgiTy != null && rgiChg != null) ? rgiTy / (1 + rgiChg / 100) : null;

  const gssNorm = normalizeGssTo100(entry.gss_actual, brand);
  const gssPriorNorm = normalizeGssTo100(entry.gss_prior, brand);
  const gssVar = (gssNorm != null && gssPriorNorm != null) ? gssNorm - gssPriorNorm : null;

  const forecastVar = (entry.forecast_actual_revenue != null && entry.forecast_primary_forecast != null)
    ? entry.forecast_actual_revenue - entry.forecast_primary_forecast : null;
  const hasForecData = hasForecastData(entry);

  const totalScore = scorecard ? scorecard.total.total : null;
  const totalPass = scorecard ? scorecard.total.pass : false;

  const kpiRows = scorecard ? [
    {
      name: 'Budgeted GOP', weight: '35%',
      target: fmt$(gopB), actual: fmt$(gopA),
      variance: gopVariance != null ? `${gopVariance >= 0 ? '+' : '-'}$${Math.abs(Math.round(gopVariance)).toLocaleString('en-US')}` : '—',
      score: scorecard.gop.score, max: 35, pass: scorecard.gop.pass, incomplete: scorecard.gop.incomplete,
    },
    {
      name: 'GOP Margin Improvement', weight: '35%',
      target: marginLy != null ? marginLy.toFixed(1) + '%' : '—',
      actual: marginTy != null ? marginTy.toFixed(1) + '%' : '—',
      variance: fmtPts(marginVar),
      score: scorecard.gopMargin.score, max: 35, pass: scorecard.gopMargin.pass, incomplete: scorecard.gopMargin.incomplete,
    },
    {
      name: 'RevPAR Index % Change (RGI)', weight: '15%',
      target: rgiLy != null ? (rgiLy * 1.001).toFixed(1) : '—',
      actual: fmtIdx(rgiTy),
      variance: fmtPct(rgiChg),
      score: scorecard.rgi.score, max: 15, pass: scorecard.rgi.pass, incomplete: scorecard.rgi.incomplete,
    },
    {
      name: `GSS — ${scorecard.gssStd.label}`, weight: '15%',
      target: fmtRaw(gssPriorNorm),
      actual: fmtRaw(gssNorm),
      variance: fmtPts(gssVar),
      score: scorecard.gss.score, max: 15, pass: scorecard.gss.pass, incomplete: scorecard.gss.incomplete,
    },
  ] : [];

  const green = '#2e7d32';
  const red = '#c62828';
  const navy = '#2d4b5e';

  const metricBox = (label, value) => `
    <div style="flex:1;min-width:0;border-right:1px solid #e5e7eb;padding:0 12px;text-align:center;">
      <div style="font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">${label}</div>
      <div style="font-size:13px;font-weight:700;color:#111;">${value}</div>
    </div>`;

  const coloredVal = (val, isGood) => `<span style="color:${isGood ? green : red};font-weight:700;">${val}</span>`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Scorecard — ${property.name}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: landscape; margin: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #111; background: #fff; width: 279mm; min-height: 215mm; }
  .page { width: 279mm; min-height: 215mm; padding: 0; display: flex; flex-direction: column; }
  .accent-bar { height: 6px; background: ${accentColor}; width: 100%; }
  .header { padding: 10px 20px 8px; display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e5e7eb; }
  .header-left h1 { font-size: 18px; font-weight: 800; color: ${navy}; line-height: 1.1; }
  .header-left .sub { font-size: 10px; color: #6b7280; margin-top: 2px; }
  .header-right { text-align: right; }
  .header-right .period { font-size: 13px; font-weight: 700; color: ${navy}; }
  .header-right .meta { font-size: 9px; color: #9ca3af; margin-top: 2px; }
  .brand-badge { display: inline-block; background: ${accentColor}; color: #fff; font-size: 9px; font-weight: 700; padding: 2px 8px; border-radius: 3px; letter-spacing: 0.05em; margin-top: 4px; }
  .kpi-summary { display: flex; padding: 10px 20px; gap: 0; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
  .kpi-summary-box { flex: 1; padding: 6px 12px; border-right: 1px solid #e5e7eb; }
  .kpi-summary-box:last-child { border-right: none; }
  .kpi-summary-box .kpi-title { font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #6b7280; margin-bottom: 6px; }
  .kpi-summary-box .kpi-metrics { display: flex; gap: 16px; flex-wrap: wrap; }
  .kpi-summary-box .metric { }
  .kpi-summary-box .metric .mlabel { font-size: 8px; color: #9ca3af; text-transform: uppercase; }
  .kpi-summary-box .metric .mval { font-size: 13px; font-weight: 800; color: #111; }
  .kpi-table { margin: 8px 20px; }
  .kpi-table table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .kpi-table th { background: ${navy}; color: #fff; padding: 5px 8px; text-align: left; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; }
  .kpi-table th.center { text-align: center; }
  .kpi-table td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; }
  .kpi-table td.center { text-align: center; }
  .kpi-table tr:last-child td { border-bottom: none; }
  .kpi-table .total-row td { background: ${navy}; color: #fff; font-weight: 700; }
  .badge { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 9px; font-weight: 700; color: #fff; }
  .badge-pass { background: ${green}; }
  .badge-fail { background: ${red}; }
  .badge-na { background: #9ca3af; }
  .bottom-section { display: flex; gap: 12px; padding: 8px 20px; flex: 1; }
  .forecast-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; min-width: 200px; }
  .forecast-box .box-title { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; letter-spacing: 0.05em; }
  .forecast-metrics { display: flex; gap: 12px; flex-wrap: wrap; }
  .narrative-box { flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; padding: 8px 12px; }
  .narrative-box .box-title { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; letter-spacing: 0.05em; }
  .narrative-cols { display: flex; gap: 12px; }
  .narrative-col { flex: 1; }
  .narrative-col .nc-label { font-size: 8px; font-weight: 700; color: ${navy}; margin-bottom: 2px; }
  .narrative-col .nc-text { font-size: 9px; color: #374151; line-height: 1.4; white-space: pre-wrap; word-break: break-word; }
  .footer { padding: 6px 20px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; background: #f9fafb; }
  .footer-left { font-size: 9px; color: #6b7280; }
  .footer-right { font-size: 9px; color: #9ca3af; }
  .score-chip { display: inline-flex; align-items: center; gap: 6px; background: ${totalPass ? green : red}; color: #fff; border-radius: 4px; padding: 2px 10px; font-size: 12px; font-weight: 800; }
</style>
</head>
<body>
<div class="page">
  <div class="accent-bar"></div>

  <div class="header">
    <div class="header-left">
      <div style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">REBEL Hotel Co.</div>
      <h1>${property.name}</h1>
      <div class="sub">${property.city || ''}, ${property.state || ''}${property.gm_name ? ' &nbsp;·&nbsp; GM: ' + property.gm_name : ''}</div>
      <span class="brand-badge">${formatBrandLabel(property.parent_brand, property.sub_brand)}</span>
    </div>
    <div class="header-right">
      <div class="period">${periodLabel}</div>
      <div class="meta">Generated ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
      <div style="margin-top:8px;">
        <span class="score-chip">
          ${anyIncomplete ? '— INCOMPLETE' : totalScore + ' / 100 &nbsp; ' + (totalPass ? '✓ PASS' : '✗ FAIL')}
        </span>
      </div>
    </div>
  </div>

  <!-- KPI Summary Row -->
  <div class="kpi-summary">
    <!-- GOP -->
    <div class="kpi-summary-box">
      <div class="kpi-title">Budgeted GOP</div>
      <div class="kpi-metrics">
        <div class="metric"><div class="mlabel">Actual</div><div class="mval">${fmt$(gopA)}</div></div>
        <div class="metric"><div class="mlabel">Budget</div><div class="mval">${fmt$(gopB)}</div></div>
        <div class="metric"><div class="mlabel">Achievement</div><div class="mval" style="color:${gopPct != null ? (gopPct >= 100 ? green : red) : '#111'};">${gopPct != null ? gopPct.toFixed(1) + '%' : '—'}</div></div>
      </div>
    </div>
    <!-- Margin -->
    <div class="kpi-summary-box">
      <div class="kpi-title">GOP Margin Improvement</div>
      <div class="kpi-metrics">
        <div class="metric"><div class="mlabel">TY</div><div class="mval">${marginTy != null ? marginTy.toFixed(1) + '%' : '—'}</div></div>
        <div class="metric"><div class="mlabel">PY</div><div class="mval">${marginLy != null ? marginLy.toFixed(1) + '%' : '—'}</div></div>
        <div class="metric"><div class="mlabel">Variance</div><div class="mval" style="color:${marginVar != null ? (marginVar >= 0.1 ? green : red) : '#111'};">${fmtPts(marginVar)}</div></div>
      </div>
    </div>
    <!-- RGI -->
    <div class="kpi-summary-box">
      <div class="kpi-title">RevPAR Index (RGI)</div>
      <div class="kpi-metrics">
        <div class="metric"><div class="mlabel">TY Index</div><div class="mval">${fmtIdx(rgiTy)}</div></div>
        <div class="metric"><div class="mlabel">LY Index</div><div class="mval">${fmtIdx(rgiLy)}</div></div>
        <div class="metric"><div class="mlabel">YOY</div><div class="mval" style="color:${rgiChg != null ? (rgiChg >= 0.1 ? green : red) : '#111'};">${fmtPct(rgiChg)}</div></div>
      </div>
    </div>
    <!-- GSS -->
    <div class="kpi-summary-box" style="border-right:none;">
      <div class="kpi-title">GSS Score</div>
      <div class="kpi-metrics">
        <div class="metric"><div class="mlabel">TY</div><div class="mval">${fmtRaw(gssNorm)}</div></div>
        <div class="metric"><div class="mlabel">PY</div><div class="mval">${fmtRaw(gssPriorNorm)}</div></div>
        <div class="metric"><div class="mlabel">Variance</div><div class="mval" style="color:${gssVar != null ? (gssVar >= 0 ? green : red) : '#111'};">${fmtPts(gssVar)}</div></div>
      </div>
    </div>
  </div>

  <!-- KPI Detail Table -->
  <div class="kpi-table">
    <table>
      <thead>
        <tr>
          <th>KPI Measure</th>
          <th class="center">Weight</th>
          <th class="center">Target</th>
          <th class="center">Actual</th>
          <th class="center">Variance</th>
          <th class="center">Score</th>
          <th class="center">Max</th>
          <th class="center">Status</th>
        </tr>
      </thead>
      <tbody>
        ${kpiRows.map(r => `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td class="center">${r.weight}</td>
          <td class="center">${r.target}</td>
          <td class="center">${r.actual}</td>
          <td class="center">${r.variance}</td>
          <td class="center"><strong>${r.incomplete ? '—' : r.score.toFixed(1)}</strong></td>
          <td class="center">${r.max}</td>
          <td class="center">
            ${r.incomplete
              ? '<span class="badge badge-na">N/A</span>'
              : `<span class="badge ${r.pass ? 'badge-pass' : 'badge-fail'}">${r.pass ? 'PASS' : 'FAIL'}</span>`}
          </td>
        </tr>`).join('')}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="5"><strong>TOTAL SCORE</strong></td>
          <td class="center"><strong>${anyIncomplete ? '—' : totalScore}</strong></td>
          <td class="center"><strong>100</strong></td>
          <td class="center">
            ${anyIncomplete
              ? '<span class="badge badge-na">INCOMPLETE</span>'
              : `<span class="badge ${totalPass ? 'badge-pass' : 'badge-fail'}">${totalPass ? '✓ PASS' : '✗ FAIL'}</span>`}
          </td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Bottom: Forecast + Narrative -->
  <div class="bottom-section">
    <div class="forecast-box">
      <div class="box-title">Forecast Accuracy Kicker</div>
      ${hasForecData ? `
      <div class="forecast-metrics">
        <div class="metric"><div class="mlabel">Actual</div><div class="mval">${fmt$(entry.forecast_actual_revenue)}</div></div>
        <div class="metric"><div class="mlabel">Forecast</div><div class="mval">${fmt$(entry.forecast_primary_forecast)}</div></div>
        <div class="metric"><div class="mlabel">Variance</div><div class="mval" style="color:${forecastVar != null ? (forecastVar >= 0 ? green : red) : '#111'};">${forecastVar != null ? (forecastVar >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(forecastVar)).toLocaleString('en-US') : '—'}</div></div>
        <div class="metric"><div class="mlabel">Result</div><div class="mval"><span class="badge ${entry.forecast_kicker ? 'badge-pass' : 'badge-fail'}">${entry.forecast_kicker ? 'HIT' : 'MISS'}</span></div></div>
      </div>` : '<div style="font-size:9px;color:#9ca3af;">No forecast data</div>'}
      ${!entry.red_zone_kicker && entry.red_zone_kicker !== undefined
        ? `<div style="margin-top:8px;font-size:9px;"><strong style="color:#6b7280;">Red Zone Kicker:</strong> <span class="badge ${entry.red_zone_kicker ? 'badge-pass' : 'badge-fail'}">${entry.red_zone_kicker ? 'HIT' : 'MISS'}</span></div>`
        : `<div style="margin-top:8px;font-size:9px;"><strong style="color:#6b7280;">Red Zone Kicker:</strong> <span class="badge ${entry.red_zone_kicker ? 'badge-pass' : 'badge-fail'}">${entry.red_zone_kicker ? 'HIT' : 'MISS'}</span></div>`}
    </div>

    ${(entry.key_wins || entry.previous_results || entry.next_priorities) ? `
    <div class="narrative-box">
      <div class="box-title">Narrative</div>
      <div class="narrative-cols">
        ${entry.key_wins ? `<div class="narrative-col"><div class="nc-label">Key Wins</div><div class="nc-text">${entry.key_wins}</div></div>` : ''}
        ${entry.previous_results ? `<div class="narrative-col"><div class="nc-label">Previous Results</div><div class="nc-text">${entry.previous_results}</div></div>` : ''}
        ${entry.next_priorities ? `<div class="narrative-col"><div class="nc-label">Next Priorities</div><div class="nc-text">${entry.next_priorities}</div></div>` : ''}
      </div>
    </div>` : ''}
  </div>

  <div class="footer">
    <div class="footer-left">
      ${entry.prepared_by ? `Prepared by: <strong>${entry.prepared_by}</strong>` : ''}
      ${entry.prepared_by && entry.reviewed_by ? '&nbsp;&nbsp;|&nbsp;&nbsp;' : ''}
      ${entry.reviewed_by ? `Reviewed by: <strong>${entry.reviewed_by}</strong>` : ''}
    </div>
    <div class="footer-right">REBEL Hotel Co. · Balanced Scorecard · Confidential</div>
  </div>
</div>
</body>
</html>`;
}

export default function ScorecardPdfExport({ property, entry, scorecard, periodLabel }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = () => {
    if (!property || !entry || !scorecard) return;
    setLoading(true);
    const html = buildHtmlPage(property, entry, scorecard, periodLabel);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const win = window.open(url, '_blank');
    if (win) {
      win.addEventListener('load', () => {
        setTimeout(() => {
          win.print();
          setLoading(false);
          URL.revokeObjectURL(url);
        }, 500);
      });
    } else {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={loading || !property || !entry}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 active:scale-95"
      style={{ backgroundColor: '#2d4b5e' }}
    >
      <Download className="w-4 h-4" />
      {loading ? 'Preparing…' : 'Download PDF'}
    </button>
  );
}