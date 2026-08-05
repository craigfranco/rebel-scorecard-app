import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries, MONTHS } from '@/lib/scoring';
import { calcKpiBonus } from '@/lib/bonusCalculation';
import { calculateActualYtdSalary } from '@/lib/salaryCalculation';

const NAVY = [45, 75, 94];
const LIGHT = [245, 247, 250];
const BORDER = [214, 222, 230];

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtPts = (n, max) => n != null ? `${n}/${max}` : '—';
const fmtK = (n) => n != null ? `$${Math.round(n / 1000).toLocaleString('en-US')}K` : '—';
const fmtPct = (n, d = 1) => n != null ? `${n.toFixed(d)}%` : '—';

function statusIcon(result) {
  if (!result || result.incomplete) return '—';
  if (result.tier === 'partial') return 'PARTIAL';
  if (result.pass) return 'PASS';
  return 'FAIL';
}

/**
 * PayoutsPdfExport — generates a PDF with property KPIs at top and all
 * employees + their quarterly incentive payouts below.
 */
export default function PayoutsPdfExport({ property, staff = [], jobClassifications = [], selectedYear, selectedMonth, periodLabel }) {
  const [generating, setGenerating] = useState(false);

  const quarter = getQuarterFromMonth(selectedMonth);
  const quarterLabel = `Q${quarter} ${selectedYear}`;

  // Fetch score entries for the property
  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries-pdf', property?.id, selectedYear],
    queryFn: () =>
      property?.id
        ? base44.entities.ScoreEntry.filter({ property_id: property.id, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!property?.id,
  });

  // Fetch RGI quarterly report overrides (must match StaffExpandedRow so PDF figures agree)
  const { data: rgiQuarterlyReports = [] } = useQuery({
    queryKey: ['rgi-quarterly', selectedYear],
    queryFn: () => base44.entities.RgiQuarterlyReport.filter({ year: selectedYear }),
  });

  // Fetch approved bonus exceptions so add-backs are reflected in the PDF
  const { data: bonusExceptions = [] } = useQuery({
    queryKey: ['bonus-exceptions', property?.id, selectedYear],
    queryFn: () =>
      property?.id
        ? base44.entities.BonusException.filter({ property_id: property.id, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!property?.id,
  });

  const handleDownload = () => {
    if (!property || staff.length === 0) return;
    setGenerating(true);

    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 14;
      let y = margin;

      // ---- Header bar ----
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('REBEL Hotel Operations Bonus Report', margin, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${property.name} — ${property.city || ''}, ${property.state || ''}`, margin, 16);
      doc.text(`${quarterLabel}  |  ${periodLabel}`, pageW - margin, 16, { align: 'right' });

      y = 28;

      // ---- KPI Summary (top section) ----
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === quarter);
      const entry = aggregateQuarterEntries(qEntries, rgiQuarterlyReports, bonusExceptions);
      const scorecard = entry ? calculateScorecard(entry, property) : null;

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Property KPI Summary', margin, y);
      y += 3;

      // KPI table
      const kpiCols = [
        { header: 'KPI', w: 55 },
        { header: 'Status', w: 30 },
        { header: 'Score', w: 30 },
        { header: 'Detail', w: 80 },
      ];
      const kpiRowH = 7;
      const kpiTableW = kpiCols.reduce((s, c) => s + c.w, 0);

      // header row
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, kpiTableW, kpiRowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      let cx = margin;
      kpiCols.forEach(c => {
        doc.text(c.header, cx + 2, y + 5);
        cx += c.w;
      });
      y += kpiRowH;

      const kpiData = scorecard ? [
        {
          name: 'Budgeted GOP',
          status: statusIcon(scorecard.gop),
          score: fmtPts(scorecard.gop?.score, 35),
          detail: scorecard.gop?.incomplete ? 'No data' : (scorecard.gop?.pass ? 'Actual >= Budget' : 'Actual < Budget'),
        },
        {
          name: 'GOP Margin',
          status: statusIcon(scorecard.gopMargin),
          score: fmtPts(scorecard.gopMargin?.score, 35),
          detail: scorecard.gopMargin?.incomplete ? 'No data' : `Improvement: ${scorecard.gopMargin?.diff ?? 0}%`,
        },
        {
          name: 'RGI (RevPAR Index)',
          status: statusIcon(scorecard.rgi),
          score: fmtPts(scorecard.rgi?.score, 15),
          detail: scorecard.rgi?.incomplete ? 'No data' : `Change: ${scorecard.rgi?.diff ?? 0}% (${scorecard.rgi?.tier || 'fail'})`,
        },
        {
          name: 'GSS',
          status: statusIcon(scorecard.gss),
          score: fmtPts(scorecard.gss?.score, 15),
          detail: scorecard.gss?.incomplete ? 'No data' : `Tier: ${scorecard.gss?.tier || 'below'} (${Math.round((scorecard.gss?.payoutPct ?? 0) * 100)}% payout)`,
        },
      ] : [
        { name: 'Budgeted GOP', status: '—', score: '—', detail: 'No scorecard data for this quarter' },
        { name: 'GOP Margin', status: '—', score: '—', detail: '' },
        { name: 'RGI', status: '—', score: '—', detail: '' },
        { name: 'GSS', status: '—', score: '—', detail: '' },
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      kpiData.forEach((row, idx) => {
        if (y > pageH - 40) { doc.addPage(); y = margin; }
        // zebra
        if (idx % 2 === 0) {
          doc.setFillColor(...LIGHT);
          doc.rect(margin, y, kpiTableW, kpiRowH, 'F');
        }
        doc.setTextColor(40, 40, 40);
        cx = margin;
        doc.text(row.name, cx + 2, y + 5); cx += kpiCols[0].w;
        doc.text(row.status, cx + 2, y + 5); cx += kpiCols[1].w;
        doc.text(String(row.score), cx + 2, y + 5); cx += kpiCols[2].w;
        doc.text(String(row.detail).substring(0, 45), cx + 2, y + 5);
        y += kpiRowH;
      });

      // Total score row
      if (scorecard) {
        doc.setFillColor(...NAVY);
        doc.rect(margin, y, kpiTableW, kpiRowH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        cx = margin;
        doc.text('Total Score', cx + 2, y + 5); cx += kpiCols[0].w + kpiCols[1].w;
        doc.text(`${scorecard.total?.total ?? '—'}/${scorecard.total?.maxPossible ?? 100}`, cx + 2, y + 5);
        y += kpiRowH + 2;
      } else {
        y += 2;
      }

      // ---- KPI Values (actual figures) ----
      y += 6;
      if (y > pageH - 40) { doc.addPage(); y = margin; }
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Property KPI Values', margin, y);
      y += 3;

      const valCols = [
        { header: 'Measure', w: 55 },
        { header: 'Actual', w: 45 },
        { header: 'Target / Prior', w: 45 },
        { header: 'Result', w: 50 },
      ];
      const valRowH = 7;
      const valTableW = valCols.reduce((s, c) => s + c.w, 0);

      doc.setFillColor(...NAVY);
      doc.rect(margin, y, valTableW, valRowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      cx = margin;
      valCols.forEach(c => { doc.text(c.header, cx + 2, y + 5); cx += c.w; });
      y += valRowH;

      const valRows = entry ? [
        ['Budgeted GOP', fmtK(entry.budgeted_gop_actual), fmtK(entry.budgeted_gop_target),
          scorecard?.gop?.incomplete ? 'No data' : (scorecard.gop.pass ? `PASS (+${fmtK(scorecard.gop.variance)})` : `MISS (${fmtK(scorecard.gop.variance)})`)],
        ['GOP Margin', fmtPct(entry.gop_margin_actual), fmtPct(entry.gop_margin_prior),
          scorecard?.gopMargin?.incomplete ? 'No data' : `${scorecard.gopMargin.diff >= 0 ? '+' : ''}${scorecard.gopMargin.diff} pts`],
        ['RGI (RevPAR Index)', entry.revpar_index != null ? entry.revpar_index.toFixed(1) : '—',
          entry.revpar_index_prior != null ? entry.revpar_index_prior.toFixed(1) : '—',
          scorecard?.rgi?.incomplete ? 'No data' : `${scorecard.rgi.diff >= 0 ? '+' : ''}${scorecard.rgi.diff}% (${scorecard.rgi.tier})`],
        ['GSS', entry.gss_actual != null ? String(entry.gss_actual) : '—',
          entry.gss_prior != null ? String(entry.gss_prior) : '—',
          scorecard?.gss?.incomplete ? 'No data' : `${scorecard.gss.tier} (${Math.round((scorecard.gss.payoutPct ?? 0) * 100)}%)`],
      ] : [['No scorecard data for this quarter', '—', '—', '—']];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      valRows.forEach((row, idx) => {
        if (y > pageH - 20) { doc.addPage(); y = margin; }
        if (idx % 2 === 0) { doc.setFillColor(...LIGHT); doc.rect(margin, y, valTableW, valRowH, 'F'); }
        doc.setTextColor(40, 40, 40);
        cx = margin;
        row.forEach((cell, i) => { doc.text(String(cell).substring(0, 28), cx + 2, y + 5); cx += valCols[i].w; });
        y += valRowH;
      });

      // ---- Staff payout table ----
      y += 6;
      if (y > pageH - 50) { doc.addPage(); y = margin; }

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('Employee Incentive Payouts', margin, y);
      y += 3;

      const staffCols = [
        { header: 'Name', w: 55 },
        { header: 'Job Classification', w: 55 },
        { header: 'Quarter Salary', w: 35 },
        { header: 'GOP', w: 25 },
        { header: 'Bonus Earned', w: 35 },
        { header: 'Paid Out (50%)', w: 35 },
        { header: 'Held (50%)', w: 35 },
      ];
      const staffRowH = 7;
      const staffTableW = staffCols.reduce((s, c) => s + c.w, 0);

      // header
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, staffTableW, staffRowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      cx = margin;
      staffCols.forEach(c => {
        doc.text(c.header, cx + 2, y + 5);
        cx += c.w;
      });
      y += staffRowH;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      // Group staff like the StaffTable
      const grouped = {};
      staff.forEach(s => {
        const jc = jobClassifications.find(j => j.id === s.job_classification_id);
        const title = jc?.title || 'Unknown';
        if (!grouped[title]) grouped[title] = [];
        grouped[title].push({ s, jc });
      });

      const groupOrder = ['General Manager', 'Asst. General Manager / EC Member', 'Department Head'];
      const sortedTitles = Object.keys(grouped).sort((a, b) => {
        const ia = groupOrder.indexOf(a);
        const ib = groupOrder.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

      let grandTotalEarned = 0;
      let grandTotalPaid = 0;
      let grandTotalHeld = 0;

      sortedTitles.forEach(title => {
        if (y > pageH - 25) { doc.addPage(); y = margin; }
        // group header
        doc.setFillColor(230, 235, 240);
        doc.rect(margin, y, staffTableW, staffRowH, 'F');
        doc.setTextColor(...NAVY);
        doc.setFont('helvetica', 'bold');
        doc.text(`${title} (${grouped[title].length})`, margin + 2, y + 5);
        y += staffRowH;

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);

        grouped[title].forEach(({ s, jc }, idx) => {
          if (y > pageH - 20) { doc.addPage(); y = margin; }
          if (idx % 2 === 0) {
            doc.setFillColor(...LIGHT);
            doc.rect(margin, y, staffTableW, staffRowH, 'F');
          }

          const salary = s[`salary_q${quarter}`] || 0;
          const bonus = salary && scorecard && jc
            ? calcKpiBonus(salary, scorecard, jc, property)
            : null;
          const earned = bonus?.total ?? 0;
          const paid = earned * 0.5;
          const held = earned * 0.5;
          grandTotalEarned += earned;
          grandTotalPaid += paid;
          grandTotalHeld += held;

          const gateLabel = bonus
            ? (bonus.gopGatePassed ? 'PASS' : 'FAIL')
            : (salary ? '—' : 'N/A');

          cx = margin;
          doc.text(s.name.substring(0, 30), cx + 2, y + 5); cx += staffCols[0].w;
          doc.text((jc?.title || '—').substring(0, 30), cx + 2, y + 5); cx += staffCols[1].w;
          doc.text(salary ? fmt(salary) : '—', cx + 2, y + 5); cx += staffCols[2].w;
          doc.text(gateLabel, cx + 2, y + 5); cx += staffCols[3].w;
          doc.text(salary && bonus ? fmt(earned) : '—', cx + 2, y + 5); cx += staffCols[4].w;
          doc.text(salary && bonus ? fmt(paid) : '—', cx + 2, y + 5); cx += staffCols[5].w;
          doc.text(salary && bonus ? fmt(held) : '—', cx + 2, y + 5);
          y += staffRowH;
        });
      });

      // Grand total row
      if (y > pageH - 15) { doc.addPage(); y = margin; }
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, staffTableW, staffRowH + 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      cx = margin;
      doc.text('Grand Total', cx + 2, y + 5); cx += staffCols[0].w + staffCols[1].w + staffCols[2].w + staffCols[3].w;
      doc.text(fmt(grandTotalEarned), cx + 2, y + 5); cx += staffCols[4].w;
      doc.text(fmt(grandTotalPaid), cx + 2, y + 5); cx += staffCols[5].w;
      doc.text(fmt(grandTotalHeld), cx + 2, y + 5);

      // ---- Approval Signatures ----
      y += 16;
      if (y > pageH - 30) { doc.addPage(); y = margin + 10; }

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Approvals', margin, y);
      y += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(40, 40, 40);

      const sigRoles = ['General Manager', 'Director of Finance', 'VP of Operations'];
      const sigSpacing = (pageW - margin * 2) / sigRoles.length;
      sigRoles.forEach((role, i) => {
        const sx = margin + i * sigSpacing;
        // signature line
        doc.setDrawColor(...BORDER);
        doc.setLineWidth(0.3);
        doc.line(sx + 4, y, sx + sigSpacing - 8, y);
        // label
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...NAVY);
        doc.text(role, sx + 4, y + 5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(120, 120, 120);
        doc.text('Signature / Date', sx + 4, y + 9);
      });

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated ${new Date().toLocaleDateString('en-US')} · Source: 2026 GM/EC/Department Head Incentive Plan`, margin, pageH - 6);

      doc.save(`Bonus_Report_${property.name.replace(/[^a-zA-Z0-9]/g, '_')}_${quarterLabel.replace(/\s/g, '')}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  const hasStaff = staff.length > 0;

  return (
    <Button
      onClick={handleDownload}
      disabled={generating || !hasStaff}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {generating ? 'Generating...' : 'Download PDF'}
    </Button>
  );
}