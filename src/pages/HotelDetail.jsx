import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Download, ArrowLeft, User, MapPin, Loader2 } from 'lucide-react';
import { calculateScorecard, MONTHS, getQuarterFromMonth, aggregateQuarterEntries } from '../lib/scoring';
import { useToast } from '@/components/ui/use-toast';

const today = new Date();
const CURRENT_YEAR = today.getFullYear();
// A month is "closed" (visible) only on or after the 18th of the following month.
const LAST_CLOSED_MONTH = today.getDate() >= 18 ? today.getMonth() : today.getMonth() - 1;


export default function HotelDetail() {
  const { id: propertyId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [timeFilter, setTimeFilter] = useState('quarter');
  const [selectedMonth, setSelectedMonth] = useState(LAST_CLOSED_MONTH);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const printRef = useRef();

  const { data: property } = useQuery({
    queryKey: ['property', propertyId],
    queryFn: () => base44.entities.Property.list('name', 100).then(ps => ps.find(p => p.id === propertyId)),
    enabled: !!propertyId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['entries', propertyId, CURRENT_YEAR],
    queryFn: () => base44.entities.ScoreEntry.filter({ property_id: propertyId, year: CURRENT_YEAR }),
    enabled: !!propertyId,
  });

  const getActiveEntry = () => {
    if (timeFilter === 'month') return entries.find(e => e.month === selectedMonth && e.year === CURRENT_YEAR) || {};
    if (timeFilter === 'quarter') {
      const q = getQuarterFromMonth(selectedMonth);
      const qEntries = entries.filter(e => getQuarterFromMonth(e.month) === q);
      return aggregateQuarterEntries(qEntries) || {};
    }
    const ytdEntries = entries.filter(e => e.month <= selectedMonth);
    return aggregateQuarterEntries(ytdEntries) || {};
  };

  const activeEntry = getActiveEntry();
  const scorecard = property ? calculateScorecard(activeEntry, property) : null;

  const periodLabel = timeFilter === 'month'
    ? `${MONTHS[selectedMonth - 1]} ${CURRENT_YEAR}`
    : timeFilter === 'quarter'
    ? `Q${getQuarterFromMonth(selectedMonth)} ${CURRENT_YEAR}`
    : `YTD ${CURRENT_YEAR}`;

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const W = 215.9;
      const NAVY = [45, 75, 94];
      const GREEN = [76, 175, 80];
      const RED = [239, 68, 68];
      const WHITE = [255, 255, 255];
      const LIGHT = [240, 244, 247];

      // Header bar
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 38, 'F');

      // Title centered
      doc.setTextColor(...WHITE);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('BALANCED SCORECARD — MONTHLY PERFORMANCE REVIEW', W / 2, 13, { align: 'center' });

      // Property name left, period right
      doc.setFontSize(14);
      doc.text(property?.name || '', 12, 24);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(periodLabel, W - 12, 24, { align: 'right' });

      // GM + location below
      doc.setFontSize(9);
      doc.text(`GM: ${property?.gm_name || '—'}   |   ${property?.city || ''}, ${property?.state || ''}   |   ${property?.parent_brand || ''}`, 12, 33);

      // Confidential tag
      doc.text('CONFIDENTIAL — FOR INTERNAL USE ONLY', W - 12, 33, { align: 'right' });

      // Score section
      const scorePass = scorecard?.total.pass;
      doc.setFillColor(...LIGHT);
      doc.rect(0, 40, W, 18, 'F');
      doc.setTextColor(...NAVY);
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text(`Overall Score: ${scorecard?.total.total ?? '—'} / 100`, 12, 52);

      // Status badge
      doc.setFillColor(...(scorePass ? GREEN : RED));
      doc.rect(100, 44, 28, 10, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(10);
      doc.text(scorePass ? '✓ PASS' : '✗ FAIL', 114, 51, { align: 'center' });

      // KPI Table header
      let y = 66;
      doc.setFillColor(...NAVY);
      doc.rect(0, y - 6, W, 8, 'F');
      doc.setTextColor(...WHITE);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('MEASURE', 12, y - 0.5);
      doc.text('WEIGHT', 85, y - 0.5);
      doc.text('TARGET', 105, y - 0.5);
      doc.text('ACTUAL', 135, y - 0.5);
      doc.text('SCORE', 162, y - 0.5);
      doc.text('STATUS', 185, y - 0.5);

      const kpiRows = scorecard ? [
        { label: 'Budgeted GOP', weight: '35%', target: '100% of Budget', actual: scorecard.gop.pct != null ? `${scorecard.gop.pct >= 0 ? '+' : ''}${scorecard.gop.pct.toFixed(2)}%` : '—', score: scorecard.gop.score, max: 35, pass: scorecard.gop.pass },
        { label: 'GOP Margin Improvement', weight: '35%', target: '+0.1% vs PY', actual: scorecard.gopMargin.diff != null ? `${scorecard.gopMargin.diff >= 0 ? '+' : ''}${scorecard.gopMargin.diff.toFixed(2)}pp` : '—', score: scorecard.gopMargin.score, max: 35, pass: scorecard.gopMargin.pass },
        { label: 'RevPAR Index % Change (STR RGI)', weight: '15%', target: '≥ +0.1% YOY', actual: scorecard.rgi.diff != null ? `${scorecard.rgi.diff >= 0 ? '+' : ''}${scorecard.rgi.diff.toFixed(2)}%` : '—', score: scorecard.rgi.score, max: 15, pass: scorecard.rgi.pass },
        { label: `GSS — ${scorecard.gssStd.label} (/${scorecard.gssStd.scale})`, weight: '15%', target: `+${scorecard.gssStd.target} YOY`, actual: scorecard.gss.diff != null ? `${scorecard.gss.diff >= 0 ? '+' : ''}${scorecard.gss.diff.toFixed(2)}` : '—', score: scorecard.gss.score, max: 15, pass: scorecard.gss.pass },
      ] : [];

      y += 4;
      kpiRows.forEach((row, i) => {
        doc.setFillColor(i % 2 === 0 ? 248 : 255, i % 2 === 0 ? 250 : 255, i % 2 === 0 ? 252 : 255);
        doc.rect(0, y - 5, W, 9, 'F');
        doc.setTextColor(30, 53, 71);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(row.label, 12, y);
        doc.text(row.weight, 85, y);
        doc.text(row.target, 105, y);
        doc.text(row.actual, 135, y);
        doc.setFont('helvetica', 'bold');
        doc.text(`${row.score.toFixed(1)}/${row.max}`, 162, y);
        doc.setFillColor(...(row.pass ? GREEN : RED));
        doc.rect(182, y - 5, 22, 7, 'F');
        doc.setTextColor(...WHITE);
        doc.setFontSize(7);
        doc.text(row.pass ? 'PASS' : 'FAIL', 193, y - 0.5, { align: 'center' });
        y += 10;
      });

      // Total row
      doc.setFillColor(...NAVY);
      doc.rect(0, y - 5, W, 9, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('TOTAL SCORE', 12, y);
      doc.text(`${scorecard?.total.total ?? '—'} / 100`, 162, y);
      doc.text(scorePass ? 'PASS' : 'FAIL', 193, y, { align: 'center' });
      y += 14;

      // Kickers
      doc.setFillColor(...LIGHT);
      doc.rect(0, y - 5, W, 14, 'F');
      doc.setTextColor(...NAVY);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('BONUS KICKERS', 12, y + 1);
      doc.setFont('helvetica', 'normal');
      doc.text(`Forecast Accuracy: ${activeEntry.forecast_kicker ? 'HIT ✓' : 'MISS ✗'}`, 12, y + 7);
      doc.text(`Red Zone: ${activeEntry.red_zone_kicker ? 'HIT ✓' : 'MISS ✗'}`, 90, y + 7);
      y += 18;

      // Notes panels
      const panels = [
        { title: 'Key Wins & Risks', value: activeEntry.key_wins || '—' },
        { title: 'Previous Period Results', value: activeEntry.previous_results || '—' },
        { title: 'Next Period Priorities', value: activeEntry.next_priorities || '—' },
      ];

      panels.forEach((panel, i) => {
        const x = 12 + i * 66;
        doc.setFillColor(...NAVY);
        doc.rect(x - 2, y - 5, 64, 7, 'F');
        doc.setTextColor(...WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(panel.title, x, y - 0.5);

        doc.setFillColor(250, 252, 255);
        doc.rect(x - 2, y + 2, 64, 35, 'F');
        doc.setTextColor(50, 70, 90);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const lines = doc.splitTextToSize(panel.value, 60);
        doc.text(lines.slice(0, 7), x, y + 8);
      });
      y += 46;

      // Footer
      doc.setFillColor(...LIGHT);
      doc.rect(0, y, W, 16, 'F');
      doc.setTextColor(100, 120, 140);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Prepared By: ${activeEntry.prepared_by || '—'}`, 12, y + 8);
      doc.text(`Reviewed By: ${activeEntry.reviewed_by || '—'}`, 90, y + 8);
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, W - 12, y + 8, { align: 'right' });
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.text('CONFIDENTIAL — FOR INTERNAL USE ONLY', W / 2, y + 13, { align: 'center' });

      doc.save(`${property?.name || 'Scorecard'} — ${periodLabel}.pdf`);
      toast({ title: 'PDF Downloaded!', description: 'Scorecard exported successfully.' });
    } catch (err) {
      toast({ title: 'Error', description: 'PDF generation failed.', variant: 'destructive' });
    }
    setGeneratingPdf(false);
  };

  if (!propertyId) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No property selected. <button className="text-primary underline" onClick={() => navigate('/properties')}>View All Properties</button>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto" ref={printRef}>
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-white/60 text-xs mb-3 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium">{property?.parent_brand || '—'}</span>
              {property?.sub_brand && <span className="text-xs text-white/60">{property.sub_brand}</span>}
            </div>
            <h1 className="text-2xl font-bold">{property?.name || 'Loading...'}</h1>
            <div className="flex items-center gap-3 mt-2 text-white/70 text-sm">
              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" />{property?.city}, {property?.state}</span>
              {property?.gm_name && <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />GM: {property.gm_name}</span>}
            </div>
          </div>
          <Button
            onClick={handleDownloadPdf}
            disabled={generatingPdf || !scorecard}
            className="gap-2 bg-white/20 hover:bg-white/30 text-white border border-white/30"
          >
            {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </Button>
        </div>
      </div>

      {/* Time filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={timeFilter} onValueChange={setTimeFilter}>
          <TabsList className="bg-card border border-border shadow-sm">
            <TabsTrigger value="month">Month</TabsTrigger>
            <TabsTrigger value="quarter">Quarter</TabsTrigger>
            <TabsTrigger value="ytd">YTD</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
          <SelectTrigger className="w-44 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => {
              if (i + 1 > LAST_CLOSED_MONTH) return null;
              return <SelectItem key={i + 1} value={String(i + 1)}>{m} {CURRENT_YEAR}</SelectItem>;
            })}
          </SelectContent>
        </Select>
      </div>

      {/* Score + KPI */}
      {scorecard && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Score summary */}
          <div className="px-6 py-4 border-b border-border flex items-center justify-between" style={{ backgroundColor: '#2d4b5e' }}>
            <span className="font-bold text-white">KPI Scorecard — {periodLabel}</span>
            <div className="flex items-center gap-3">
              <span className="text-white font-black text-xl">{scorecard.total.total}</span>
              <span
                className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: scorecard.total.pass ? '#4CAF50' : '#ef4444' }}
              >
                {scorecard.total.pass ? '✓ PASS' : '✗ FAIL'}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-left font-semibold">Measure</th>
                  <th className="py-3 px-4 text-center font-semibold">Weight</th>
                  <th className="py-3 px-4 text-center font-semibold">Target</th>
                  <th className="py-3 px-4 text-center font-semibold">Actual</th>
                  <th className="py-3 px-4 text-center font-semibold">Score</th>
                  <th className="py-3 px-4 text-center font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {[
                   { label: 'Budgeted GOP', weight: '35%', target: '100% of Budget', actual: scorecard.gop.pct != null ? `${scorecard.gop.pct >= 0 ? '+' : ''}${scorecard.gop.pct.toFixed(2)}%` : '—', score: scorecard.gop.score, max: 35, pass: scorecard.gop.pass },
                   { label: 'GOP Margin Improvement', weight: '35%', target: '+0.1% vs PY', actual: scorecard.gopMargin.diff != null ? `${scorecard.gopMargin.diff >= 0 ? '+' : ''}${scorecard.gopMargin.diff.toFixed(2)}pp` : '—', score: scorecard.gopMargin.score, max: 35, pass: scorecard.gopMargin.pass },
                   { label: 'RevPAR Index % Change (STR RGI)', weight: '15%', target: '≥ +0.1% YOY', actual: scorecard.rgi.diff != null ? `${scorecard.rgi.diff >= 0 ? '+' : ''}${scorecard.rgi.diff.toFixed(2)}%` : '—', score: scorecard.rgi.score, max: 15, pass: scorecard.rgi.pass },
                   { label: `GSS — ${scorecard.gssStd.label} (/${scorecard.gssStd.scale})`, weight: '15%', target: `+${scorecard.gssStd.target} YOY`, actual: scorecard.gss.diff != null ? `${scorecard.gss.diff >= 0 ? '+' : ''}${scorecard.gss.diff.toFixed(2)}` : '—', score: scorecard.gss.score, max: 15, pass: scorecard.gss.pass },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-border ${i % 2 === 0 ? '' : 'bg-muted/20'}`}>
                    <td className="py-3 px-4 font-medium">{row.label}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground">{row.weight}</td>
                    <td className="py-3 px-4 text-center text-muted-foreground text-xs">{row.target}</td>
                    <td className="py-3 px-4 text-center font-semibold">{row.actual}</td>
                    <td className="py-3 px-4 text-center font-bold">{row.score.toFixed(1)}/{row.max}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: row.pass ? '#4CAF50' : '#ef4444' }}>
                        {row.pass ? 'PASS' : 'FAIL'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Kickers */}
           <div className="px-6 py-4 border-t border-border bg-muted/30 flex gap-6">
             <div className="flex items-center gap-2">
               <span className="text-sm font-medium text-muted-foreground">Forecast Kicker:</span>
               {!activeEntry.forecast_primary_forecast ? (
                 <span className="text-sm font-bold text-red-500">ERROR: Forecast value is zero</span>
               ) : (
                 <span className={`text-sm font-bold ${activeEntry.forecast_kicker ? 'text-green-600' : 'text-red-500'}`}>
                   {activeEntry.forecast_kicker ? 'HIT ✓' : 'MISS ✗'}
                 </span>
               )}
             </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">Red Zone Kicker:</span>
              <span className={`text-sm font-bold ${activeEntry.red_zone_kicker ? 'text-green-600' : 'text-red-500'}`}>
                {activeEntry.red_zone_kicker ? 'HIT ✓' : 'MISS ✗'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Notes panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: '🏆 Key Wins & Risks', value: activeEntry.key_wins },
          { title: '📊 Previous Period Results', value: activeEntry.previous_results },
          { title: '🎯 Next Period Priorities', value: activeEntry.next_priorities },
        ].map(({ title, value }) => (
          <div key={title} className="bg-card rounded-2xl border border-border p-4 shadow-sm">
            <h3 className="font-semibold text-sm mb-2">{title}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{value || 'No notes recorded.'}</p>
          </div>
        ))}
      </div>

      {/* Prepared by */}
      {(activeEntry.prepared_by || activeEntry.reviewed_by) && (
        <div className="bg-muted/30 rounded-xl px-5 py-3 flex gap-6 text-sm">
          {activeEntry.prepared_by && <span><span className="text-muted-foreground">Prepared by:</span> <strong>{activeEntry.prepared_by}</strong></span>}
          {activeEntry.reviewed_by && <span><span className="text-muted-foreground">Reviewed by:</span> <strong>{activeEntry.reviewed_by}</strong></span>}
        </div>
      )}


    </div>
  );
}