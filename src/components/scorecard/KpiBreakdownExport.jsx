import React from 'react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { hasForecastData } from '@/lib/scoring';

function fmt$(v) { return v == null ? '' : '$' + Math.round(v).toLocaleString('en-US'); }
function signed$(v) {
  if (v == null) return '';
  return (v >= 0 ? '+' : '-') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
}

function statusLabel(r, activeKpi) {
  if (!r.entry) return 'NO DATA';
  if (activeKpi === 'redzone' && r.property.parent_brand === 'Independent') return 'N/A';
  if (activeKpi === 'forecast') return r.pass ? 'HIT' : (!hasForecastData(r.entry) ? 'NO DATA' : 'MISS');
  if (activeKpi === 'redzone') return r.pass ? 'HIT' : 'OUT';
  return r.pass ? 'PASS' : 'FAIL';
}

function buildColumns(activeKpi, kpiTab) {
  const cols = [
    { header: 'Rank', get: (r, i) => String(i + 1) },
    { header: 'Hotel', get: r => r.property.name || '' },
    { header: 'City', get: r => r.property.city || '' },
    { header: 'State', get: r => r.property.state || '' },
    { header: 'GM', get: r => r.property.gm_name || '' },
  ];
  if (activeKpi === 'gop') {
    cols.push({ header: 'Achievement', get: r => r.actual });
    cols.push({ header: 'Actual $', get: r => r.entry ? fmt$(r.entry._gop_actual_dollars) : '' });
    cols.push({ header: 'Budget $', get: r => r.entry ? fmt$(r.entry.budgeted_gop_target) : '' });
    cols.push({ header: 'Variance $', get: r => r.entry ? signed$(r.entry._gop_variance) : '' });
  } else if (activeKpi === 'gopMargin') {
    cols.push({ header: 'TY Margin %', get: r => r.actual });
    cols.push({ header: 'Prior Year %', get: r => r.entry ? (r.entry._ly_margin || '') : '' });
    cols.push({ header: 'Improvement (pts)', get: r => r.entry && r.entry._margin_yoy != null ? (r.entry._margin_yoy >= 0 ? '+' : '') + r.entry._margin_yoy.toFixed(1) : '' });
  } else if (activeKpi === 'rgi') {
    cols.push({ header: 'TY Index', get: r => r.actual });
    cols.push({ header: 'Target', get: r => r.entry && r.entry._rgi_target != null ? r.entry._rgi_target.toFixed(1) : '' });
    cols.push({ header: 'Change %', get: r => r.entry && r.entry._rgi_change != null ? (r.entry._rgi_change >= 0 ? '+' : '') + r.entry._rgi_change.toFixed(1) + '%' : '' });
  } else if (activeKpi === 'gss') {
    cols.push({ header: 'Actual (norm)', get: r => r.actual });
    cols.push({ header: 'Target (PY)', get: r => r.target });
    cols.push({ header: 'Variance', get: r => r.entry && r.entry._gss_variance != null ? (r.entry._gss_variance >= 0 ? '+' : '') + r.entry._gss_variance.toFixed(1) : '' });
  } else if (activeKpi === 'forecast') {
    cols.push({ header: 'Actual $', get: r => r.actual });
    cols.push({ header: 'Forecast $', get: r => r.target });
    cols.push({ header: 'Variance $', get: r => r.entry ? signed$(r.entry._forecast_variance) : '' });
  } else if (activeKpi === 'redzone') {
    cols.push({ header: 'Status', get: r => statusLabel(r, activeKpi) });
  }
  cols.push({ header: 'Score', get: r => r.score != null ? (kpiTab.max ? r.score.toFixed(1) + '/' + kpiTab.max : (r.pass ? 'Hit' : 'Miss')) : '' });
  cols.push({ header: 'Status', get: r => statusLabel(r, activeKpi) });
  return cols;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function slugify(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }

export default function KpiBreakdownExport({ rows, activeKpi, kpiTab, periodLabel }) {
  const exportExcel = () => {
    const cols = buildColumns(activeKpi, kpiTab);
    const header = cols.map(c => csvCell(c.header)).join(',');
    const lines = rows.map((r, i) => cols.map(c => csvCell(c.get(r, i))).join(','));
    const csv = '\uFEFF' + [header, ...lines].join('\n');
    downloadBlob(csv, `kpi-breakdown-${slugify(activeKpi)}-${slugify(periodLabel)}.csv`, 'text/csv;charset=utf-8;');
  };

  const exportPDF = () => {
    const cols = buildColumns(activeKpi, kpiTab);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'letter' });
    const W = 279.4, H = 215.9, M = 8;
    const availW = W - 2 * M;
    const NAVY = [45, 75, 94], NAVY_DARK = [30, 53, 71], WHITE = [255, 255, 255], GREY = [110, 125, 140];
    const GREEN = [76, 175, 80], RED = [239, 68, 68], AMBER = [245, 158, 11];

    // Column widths based on content
    const rawWidths = cols.map(c => {
      let maxLen = c.header.length;
      rows.forEach((r, i) => { maxLen = Math.max(maxLen, String(c.get(r, i) ?? '').length); });
      return Math.min(55, Math.max(14, maxLen * 1.7));
    });
    const totalRaw = rawWidths.reduce((s, w) => s + w, 0);
    const scale = totalRaw > availW ? availW / totalRaw : 1;
    const widths = rawWidths.map(w => w * scale);
    const tableW = widths.reduce((s, w) => s + w, 0);
    const startX = M + (availW - tableW) / 2;

    // Title block
    let y = 14;
    doc.setFillColor(...NAVY);
    doc.rect(0, 0, W, 9, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('REBEL Hotel Performance Scorecard', M, 6);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`${kpiTab.label} — ${periodLabel}`, M, 8.2);

    doc.setTextColor(...NAVY_DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`KPI Breakdown: ${kpiTab.label}`, M, y);
    y += 3;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...GREY);
    doc.text(`${rows.filter(r => r.pass === true).length} of ${rows.filter(r => r.pass !== null).length} hotels passing · ${periodLabel}`, M, y);
    y += 4;

    const rowH = 6.5;
    const headerH = 7;
    const statusColIdx = cols.length - 1;
    const scoreColIdx = cols.length - 2;

    const drawHeader = () => {
      doc.setFillColor(...NAVY_DARK);
      doc.rect(startX, y, tableW, headerH, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.8);
      let cx = startX;
      cols.forEach((c, i) => {
        doc.text(String(c.header), cx + 1.3, y + headerH / 2 + 1.2);
        cx += widths[i];
      });
      y += headerH;
    };

    const pageBottom = H - 12;
    drawHeader();
    rows.forEach((r, i) => {
      if (y + rowH > pageBottom) {
        doc.addPage();
        y = 14;
        drawHeader();
      }
      // row background
      if (i % 2 === 0) { doc.setFillColor(248, 250, 252); doc.rect(startX, y, tableW, rowH, 'F'); }
      doc.setDrawColor(225, 230, 235);
      doc.line(startX, y + rowH, startX + tableW, y + rowH);
      let cx = startX;
      cols.forEach((c, ci) => {
        const val = String(c.get(r, i) ?? '');
        let color = NAVY_DARK;
        let bold = false;
        if (ci === statusColIdx) {
          const lbl = val;
          if (lbl === 'PASS' || lbl === 'HIT') color = GREEN;
          else if (lbl === 'FAIL' || lbl === 'MISS') color = RED;
          else if (lbl === 'OUT' || lbl === 'N/A' || lbl === 'NO DATA') color = GREY;
          bold = true;
        } else if (ci === scoreColIdx) {
          bold = true;
          color = NAVY_DARK;
        }
        doc.setTextColor(...color);
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.setFontSize(6.8);
        // clip text to width
        const maxChars = Math.max(3, Math.floor(widths[ci] / 1.05));
        const text = val.length > maxChars ? val.slice(0, maxChars - 1) + '…' : val;
        doc.text(text, cx + 1.3, y + rowH / 2 + 1.2);
        cx += widths[ci];
      });
      y += rowH;
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...GREY);
      doc.text(`Source: 2026 GM/EC/Department Head Incentive Plan`, M, H - 5);
      doc.text(`Page ${p} of ${pageCount}`, W - M - 16, H - 5);
    }

    doc.save(`kpi-breakdown-${slugify(activeKpi)}-${slugify(periodLabel)}.pdf`);
  };

  return (
    <div className="flex items-center gap-2 shrink-0">
      <Button variant="outline" size="sm" onClick={exportExcel} className="gap-1.5">
        <FileSpreadsheet className="w-4 h-4" />
        Excel
      </Button>
      <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
        <FileText className="w-4 h-4" />
        PDF
      </Button>
    </div>
  );
}