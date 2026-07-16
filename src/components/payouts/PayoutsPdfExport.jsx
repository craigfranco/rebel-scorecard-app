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
const LOGO_URL = 'https://media.base44.com/images/public/69d3e20c8254476c324dc91c/d054aef74_generated_image.png';

const fmt = (n) => `$${Math.round(n).toLocaleString('en-US')}`;
const fmtPts = (n, max) => n != null ? `${n}/${max}` : '—';

async function fetchLogoDataUrl() {
  try {
    const res = await fetch(LOGO_URL);
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

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

  const handleDownload = async () => {
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
      const logoData = await fetchLogoDataUrl();
      if (logoData) {
        doc.addImage(logoData, 'PNG', margin, 3, 14, 14);
      }
      const textX = margin + 18;
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.text('REBEL Hotel Operations Bonus Report', textX, 10);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${property.name} — ${property.city || ''}, ${property.state || ''}`, textX, 16);
      doc.text(`${quarterLabel}  |  ${periodLabel}`, pageW - margin, 16, { align: 'right' });

      y = 28;

      // ---- KPI Summary (top section) ----
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === quarter);
      const entry = aggregateQuarterEntries(qEntries);
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
        { header: 'GOP Gate', w: 25 },
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