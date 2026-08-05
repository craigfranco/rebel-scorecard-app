import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';
import jsPDF from 'jspdf';
import { calculateScorecard, getQuarterFromMonth, aggregateQuarterEntries } from '@/lib/scoring';
import { calcKpiBonus } from '@/lib/bonusCalculation';
import { calculateActualYtdSalary } from '@/lib/salaryCalculation';

const NAVY = [45, 75, 94];
const LIGHT = [245, 247, 250];
const PASS_COLOR = [76, 175, 80];
const FAIL_COLOR = [239, 68, 68];
const PARTIAL_COLOR = [245, 158, 11];

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtPts = (n, max) => n != null ? `${n}/${max}` : '—';
const fmtK = (n) => n != null ? `$${Math.round(n / 1000).toLocaleString('en-US')}K` : '—';
const fmtPct = (n, d = 1) => n != null ? `${n.toFixed(d)}%` : '—';

function statusLabel(result) {
  if (!result || result.incomplete) return '—';
  if (result.tier === 'partial') return 'PARTIAL';
  if (result.pass) return 'PASS';
  return 'FAIL';
}

/**
 * StaffPdfExport — generates a per-employee PDF with quarterly KPI breakdown,
 * bonus payout detail, and approval signature lines for GM, DOF, and VP Ops.
 */
export default function StaffPdfExport({ staff, property, jobClass, selectedYear, selectedMonth }) {
  const [generating, setGenerating] = useState(false);

  const quarter = getQuarterFromMonth(selectedMonth);
  const quarterLabel = `Q${quarter} ${selectedYear}`;

  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries-staff-pdf', property?.id, selectedYear],
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
    if (!staff || !property) return;
    setGenerating(true);

    try {
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 16;
      let y = margin;

      // ---- Header bar ----
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, pageW, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text('Operations Bonus — Individual Payout Report', margin, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${property.name} — ${property.city || ''}, ${property.state || ''}`, margin, 17);
      doc.text(`${quarterLabel}`, pageW - margin, 17, { align: 'right' });

      y = 32;

      // ---- Employee info ----
      const salary = staff[`salary_q${quarter}`] || 0;
      const { total: ytdSalary } = calculateActualYtdSalary(staff);
      const maxBonusPct = jobClass?.max_bonus_percentage || 0;

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Employee Information', margin, y);
      y += 3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      const infoLines = [
        `Name: ${staff.name}`,
        `Job Classification: ${jobClass?.title || '—'}`,
        `Property: ${property.name}`,
        `Quarter: ${quarterLabel}`,
        `Quarterly Salary: ${salary ? fmt(salary) : '—'}`,
        `YTD Salary: ${ytdSalary > 0 ? fmt(ytdSalary) : '—'}`,
        `Max Bonus Potential: ${maxBonusPct}%`,
      ];
      infoLines.forEach(line => {
        doc.text(line, margin, y);
        y += 5;
      });
      y += 4;

      // ---- KPI Summary ----
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === quarter);
      const entry = aggregateQuarterEntries(qEntries, rgiQuarterlyReports, bonusExceptions);
      const scorecard = entry ? calculateScorecard(entry, property) : null;

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Property KPI Summary', margin, y);
      y += 3;

      // KPI table
      const kpiCols = [
        { header: 'KPI', w: 50 },
        { header: 'Status', w: 28 },
        { header: 'Score', w: 25 },
        { header: 'Detail', w: 75 },
      ];
      const rowH = 7;
      const tableW = kpiCols.reduce((s, c) => s + c.w, 0);

      // header
      doc.setFillColor(...NAVY);
      doc.rect(margin, y, tableW, rowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      let cx = margin;
      kpiCols.forEach(c => {
        doc.text(c.header, cx + 2, y + 5);
        cx += c.w;
      });
      y += rowH;

      const kpiData = scorecard ? [
        { name: 'Budgeted GOP', status: statusLabel(scorecard.gop), score: fmtPts(scorecard.gop?.score, 35), detail: scorecard.gop?.incomplete ? 'No data' : (scorecard.gop?.pass ? 'Actual >= Budget' : 'Actual < Budget') },
        { name: 'GOP Margin', status: statusLabel(scorecard.gopMargin), score: fmtPts(scorecard.gopMargin?.score, 35), detail: scorecard.gopMargin?.incomplete ? 'No data' : `Improvement: ${scorecard.gopMargin?.diff ?? 0}%` },
        { name: 'RGI', status: statusLabel(scorecard.rgi), score: fmtPts(scorecard.rgi?.score, 15), detail: scorecard.rgi?.incomplete ? 'No data' : `Change: ${scorecard.rgi?.diff ?? 0}% (${scorecard.rgi?.tier || 'fail'})` },
        { name: 'GSS', status: statusLabel(scorecard.gss), score: fmtPts(scorecard.gss?.score, 15), detail: scorecard.gss?.incomplete ? 'No data' : `Tier: ${scorecard.gss?.tier || 'below'} (${Math.round((scorecard.gss?.payoutPct ?? 0) * 100)}%)` },
      ] : [
        { name: 'Budgeted GOP', status: '—', score: '—', detail: 'No data for this quarter' },
        { name: 'GOP Margin', status: '—', score: '—', detail: '' },
        { name: 'RGI', status: '—', score: '—', detail: '' },
        { name: 'GSS', status: '—', score: '—', detail: '' },
      ];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      kpiData.forEach((row, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(...LIGHT);
          doc.rect(margin, y, tableW, rowH, 'F');
        }
        cx = margin;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(row.name, cx + 2, y + 5); cx += kpiCols[0].w;
        const statusColor = row.status === 'PASS' ? PASS_COLOR : row.status === 'PARTIAL' ? PARTIAL_COLOR : row.status === 'FAIL' ? FAIL_COLOR : [120, 120, 120];
        doc.setTextColor(...statusColor);
        doc.setFont('helvetica', 'bold');
        doc.text(row.status, cx + 2, y + 5); cx += kpiCols[1].w;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(40, 40, 40);
        doc.text(String(row.score), cx + 2, y + 5); cx += kpiCols[2].w;
        doc.text(String(row.detail).substring(0, 42), cx + 2, y + 5);
        y += rowH;
      });

      // Total
      if (scorecard) {
        doc.setFillColor(...NAVY);
        doc.rect(margin, y, tableW, rowH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        cx = margin;
        doc.text('Total Score', cx + 2, y + 5); cx += kpiCols[0].w + kpiCols[1].w;
        doc.text(`${scorecard.total?.total ?? '—'}/${scorecard.total?.maxPossible ?? 100}`, cx + 2, y + 5);
        y += rowH + 2;
      } else {
        y += 2;
      }

      // ---- KPI Values (actual figures) ----
      y += 6;
      if (y > pageH - 40) { doc.addPage(); y = margin; }
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Property KPI Values', margin, y);
      y += 3;

      const valCols = [
        { header: 'Measure', w: 44 },
        { header: 'Actual', w: 36 },
        { header: 'Target / Prior', w: 36 },
        { header: 'Result', w: 60 },
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

      const gopPctVar = (scorecard?.gop?.achievementPct != null) ? scorecard.gop.achievementPct - 100 : null;
      const marginPctVar = (scorecard?.gopMargin?.diff != null && entry.gop_margin_prior != null && entry.gop_margin_prior !== 0)
        ? (scorecard.gopMargin.diff / Math.abs(entry.gop_margin_prior)) * 100 : null;
      const rgiIdxDiff = (entry.revpar_index != null && entry.revpar_index_prior != null)
        ? entry.revpar_index - entry.revpar_index_prior : null;
      const gssPtsDiff = (scorecard?.gss?.normActual != null && scorecard?.gss?.normPrior != null)
        ? scorecard.gss.normActual - scorecard.gss.normPrior : null;
      const gssPctVar = (gssPtsDiff != null && scorecard?.gss?.normPrior != null && scorecard.gss.normPrior !== 0)
        ? (gssPtsDiff / scorecard.gss.normPrior) * 100 : null;

      const valRows = entry ? [
        ['Budgeted GOP', fmtK(entry.budgeted_gop_actual), fmtK(entry.budgeted_gop_target),
          scorecard?.gop?.incomplete ? 'No data'
            : `${scorecard.gop.pass ? 'PASS' : 'FAIL'} ${scorecard.gop.variance >= 0 ? '+' : '-'}${fmtK(Math.abs(scorecard.gop.variance))}${gopPctVar != null ? ` (${gopPctVar >= 0 ? '+' : ''}${gopPctVar.toFixed(1)}%)` : ''}`,
          !scorecard?.gop?.incomplete ? !!scorecard.gop.pass : null],
        ['GOP Margin', fmtPct(entry.gop_margin_actual), fmtPct(entry.gop_margin_prior),
          scorecard?.gopMargin?.incomplete ? 'No data'
            : `${scorecard.gopMargin.pass ? 'PASS' : 'FAIL'} ${scorecard.gopMargin.diff >= 0 ? '+' : ''}${scorecard.gopMargin.diff.toFixed(1)} pts${marginPctVar != null ? ` (${marginPctVar >= 0 ? '+' : ''}${marginPctVar.toFixed(1)}%)` : ''}`,
          !scorecard?.gopMargin?.incomplete ? !!scorecard.gopMargin.pass : null],
        ['RGI (RevPAR Idx)', entry.revpar_index != null ? entry.revpar_index.toFixed(1) : '—',
          entry.revpar_index_prior != null ? entry.revpar_index_prior.toFixed(1) : '—',
          scorecard?.rgi?.incomplete ? 'No data'
            : `${scorecard.rgi.pass ? 'PASS' : 'FAIL'} ${rgiIdxDiff != null ? `${rgiIdxDiff >= 0 ? '+' : ''}${rgiIdxDiff.toFixed(1)} pts ` : ''}${scorecard.rgi.diff >= 0 ? '+' : ''}${scorecard.rgi.diff.toFixed(1)}%`,
          !scorecard?.rgi?.incomplete ? !!scorecard.rgi.pass : null],
        ['GSS', entry.gss_actual != null ? entry.gss_actual.toFixed(1) : '—',
          entry.gss_prior != null ? entry.gss_prior.toFixed(1) : '—',
          scorecard?.gss?.incomplete ? 'No data'
            : `${scorecard.gss.pass ? 'PASS' : 'FAIL'} ${gssPtsDiff != null ? `${gssPtsDiff >= 0 ? '+' : ''}${gssPtsDiff.toFixed(1)} pts` : ''}${gssPctVar != null ? ` (${gssPctVar >= 0 ? '+' : ''}${gssPctVar.toFixed(1)}%)` : ''}`,
          !scorecard?.gss?.incomplete ? !!scorecard.gss.pass : null],
      ] : [['No scorecard data', '—', '—', '—', null]];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      valRows.forEach((row, idx) => {
        if (idx % 2 === 0) { doc.setFillColor(...LIGHT); doc.rect(margin, y, valTableW, valRowH, 'F'); }
        cx = margin;
        for (let i = 0; i < 4; i++) {
          if (i === 3 && row[4] != null) {
            doc.setTextColor(...(row[4] ? PASS_COLOR : FAIL_COLOR));
            doc.setFont('helvetica', 'bold');
          } else {
            doc.setTextColor(40, 40, 40);
            doc.setFont('helvetica', 'normal');
          }
          doc.text(String(row[i]).substring(0, 36), cx + 2, y + 5);
          cx += valCols[i].w;
        }
        y += valRowH;
      });

      // ---- Bonus payout detail ----
      y += 6;
      const bonus = salary && scorecard && jobClass
        ? calcKpiBonus(salary, scorecard, jobClass, property)
        : null;

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Bonus Payout Detail', margin, y);
      y += 3;

      const bonusCols = [
        { header: 'Component', w: 55 },
        { header: 'Status', w: 30 },
        { header: 'Amount', w: 40 },
      ];
      const bonusTableW = bonusCols.reduce((s, c) => s + c.w, 0);

      doc.setFillColor(...NAVY);
      doc.rect(margin, y, bonusTableW, rowH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      cx = margin;
      bonusCols.forEach(c => {
        doc.text(c.header, cx + 2, y + 5);
        cx += c.w;
      });
      y += rowH;

      const bonusRows = bonus ? [
        { comp: 'GOP Bonus', gate: bonus.gopPassed ? 'Passed' : 'Failed', amt: fmt(bonus.gop) },
        { comp: 'GOP Margin Bonus', gate: bonus.marginPassed ? 'Passed' : 'Failed', amt: fmt(bonus.gopMargin) },
        { comp: 'RGI Bonus', gate: bonus.rgi > 0 ? 'Earned' : 'Not earned', amt: fmt(bonus.rgi) },
        { comp: 'GSS Bonus', gate: bonus.gss > 0 ? 'Earned' : 'Not earned', amt: fmt(bonus.gss) },
        ...(bonus.redZoneKicker > 0 ? [{ comp: 'Red Zone Kicker (+25% GSS)', gate: 'Earned', amt: fmt(bonus.redZoneKicker) }] : []),
      ] : [{ comp: '—', gate: 'No data', amt: '—' }];

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      bonusRows.forEach((row, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(...LIGHT);
          doc.rect(margin, y, bonusTableW, rowH, 'F');
        }
        doc.setTextColor(40, 40, 40);
        cx = margin;
        doc.text(row.comp, cx + 2, y + 5); cx += bonusCols[0].w;
        doc.text(row.gate, cx + 2, y + 5); cx += bonusCols[1].w;
        doc.text(row.amt, cx + 2, y + 5);
        y += rowH;
      });

      // Total bonus row
      if (bonus) {
        doc.setFillColor(...NAVY);
        doc.rect(margin, y, bonusTableW, rowH, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        cx = margin;
        doc.text('Total Bonus Earned', cx + 2, y + 5); cx += bonusCols[0].w + bonusCols[1].w;
        doc.text(fmt(bonus.total), cx + 2, y + 5);
        y += rowH;

        // Payout split
        y += 4;
        doc.setTextColor(50, 50, 50);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Paid Out (50%):  ${fmt(bonus.total * 0.5)}`, margin, y); y += 5;
        doc.text(`Held to Year-End (50%):  ${fmt(bonus.total * 0.5)}`, margin, y); y += 5;
      }

      // ---- Approval signature lines ----
      y += 14;
      if (y > pageH - 50) { doc.addPage(); y = margin; }

      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('Approvals', margin, y);
      y += 8;

      const signColW = (pageW - margin * 2) / 3;
      const roles = ['General Manager', 'Director of Finance', 'VP of Operations'];
      const signY = y + 15;

      roles.forEach((role, i) => {
        const x = margin + i * signColW;
        // Signature line
        doc.setDrawColor(100, 100, 100);
        doc.setLineWidth(0.3);
        doc.line(x, signY, x + signColW - 10, signY);
        // Label
        doc.setTextColor(60, 60, 60);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(role, x, signY + 5);
        doc.text('Signature & Date', x, signY + 10);
      });

      // Footer
      doc.setFontSize(7);
      doc.setTextColor(120, 120, 120);
      doc.text(`Generated ${new Date().toLocaleDateString('en-US')} · Source: 2026 GM/EC/Department Head Incentive Plan`, margin, pageH - 8);

      doc.save(`Bonus_${staff.name.replace(/[^a-zA-Z0-9]/g, '_')}_${quarterLabel.replace(/\s/g, '')}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={generating}
      variant="outline"
      size="sm"
      className="gap-2 h-7 text-xs"
    >
      {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {generating ? 'Generating...' : 'Download PDF'}
    </Button>
  );
}