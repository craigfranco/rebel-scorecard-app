import React, { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

function simpleAvg(items, fn) {
  const vals = items.map(fn).filter(v => v != null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}
function weightedAvg(items, valFn, weightFn) {
  let acc = 0, wsum = 0;
  for (const it of items) {
    const v = valFn(it); const w = weightFn(it);
    if (v == null || !w) continue;
    acc += v * w; wsum += w;
  }
  return wsum ? acc / wsum : null;
}
function fmt(v, dec = 1) { return v == null ? '—' : v.toFixed(dec); }
function fmt$(v) { return v == null ? '—' : (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US'); }

function buildSummaries(groups) {
  return groups.map(([name, rows]) => {
    const withData = rows.filter(r => r.hasData);
    const rooms = r => r.rooms || 0;
    const totalRooms = withData.reduce((s, r) => s + rooms(r), 0);
    const avg = simpleAvg(withData, r => r.sc?.total?.total);
    const portfolio = weightedAvg(withData, r => r.sc?.total?.total, rooms) ?? avg;
    const gopActual = withData.reduce((s, r) => s + (r.entry?.budgeted_gop_actual || 0), 0);
    const gopBudget = withData.reduce((s, r) => s + (r.entry?.budgeted_gop_target || 0), 0);
    const gopVar = gopActual - gopBudget;
    const gopVarPct = gopBudget > 0 ? (gopVar / gopBudget) * 100 : null;
    const marginActual = weightedAvg(withData, r => r.entry?.gop_margin_actual, rooms);
    const marginPrior = weightedAvg(withData, r => r.entry?.gop_margin_prior, rooms);
    const marginDelta = (marginActual != null && marginPrior != null) ? marginActual - marginPrior : null;
    const rgiIndex = weightedAvg(withData, r => r.entry?.revpar_index, rooms);
    const rgiChange = simpleAvg(withData, r => r.entry?.revpar_index_change);
    const rgiPrior = weightedAvg(withData, r => {
      const e = r.entry;
      if (e?.revpar_index_prior != null) return e.revpar_index_prior;
      if (e?.revpar_index != null && e?.revpar_index_change != null) return e.revpar_index / (1 + e.revpar_index_change / 100);
      return null;
    }, rooms);
    const gssActual = weightedAvg(withData, r => r.sc?.gss?.normActual, rooms);
    const gssPrior = weightedAvg(withData, r => r.sc?.gss?.normPrior, rooms);
    const gssDelta = (gssActual != null && gssPrior != null) ? gssActual - gssPrior : null;
    return {
      name,
      hotels: withData.length,
      rooms: totalRooms,
      gop: simpleAvg(withData, r => r.sc?.gop?.score),
      gopMargin: simpleAvg(withData, r => r.sc?.gopMargin?.score),
      rgi: simpleAvg(withData, r => r.sc?.rgi?.score),
      gss: simpleAvg(withData, r => r.sc?.gss?.score),
      avg,
      portfolio,
      forecastHits: withData.filter(r => r.forecast === true).length,
      forecastTotal: withData.filter(r => r.forecast != null).length,
      redZoneApplicable: withData.filter(r => r.property?.parent_brand !== 'Independent').length,
      redZoneCompliant: withData.filter(r => r.property?.parent_brand !== 'Independent' && r.redzone === true).length,
      gopActual, gopBudget, gopVar, gopVarPct,
      marginActual, marginPrior, marginDelta,
      rgiIndex, rgiPrior, rgiChange,
      gssActual, gssPrior, gssDelta,
      rows: withData,
    };
  });
}

export default function LeadershipRollupPdfExport({ groups, roleLabel, periodLabel, summaryText, title = 'LEADERSHIP SCORECARD — PORTFOLIO ROLLUP', label = 'Download PDF' }) {
  const [busy, setBusy] = useState(false);

  const handleDownload = async () => {
    setBusy(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
      const W = 215.9;
      const H = 279.4;
      const M = 12;
      const NAVY = [45, 75, 94];
      const GREEN = [76, 175, 80];
      const RED = [239, 68, 68];
      const AMBER = [245, 158, 11];
      const WHITE = [255, 255, 255];
      const LIGHT = [240, 244, 247];
      const GREY = [100, 120, 140];

      const scoreColor = (total, max = 100) => {
        if (total == null) return GREY;
        const pct = total / max;
        if (pct >= 0.7) return GREEN;
        if (pct >= 0.5) return AMBER;
        return RED;
      };

      let page = 1;
      let y = 0;

      const addFooter = () => {
        doc.setFontSize(7);
        doc.setTextColor(...GREY);
        doc.setFont('helvetica', 'normal');
        doc.text('CONFIDENTIAL — FOR INTERNAL USE ONLY', W / 2, H - 6, { align: 'center' });
        doc.text(`Page ${page}`, W - M, H - 6, { align: 'right' });
      };

      const ensureSpace = (need) => {
        if (y + need > H - 14) {
          addFooter();
          doc.addPage();
          page++;
          y = 14;
        }
      };

      // Header
      doc.setFillColor(...NAVY);
      doc.rect(0, 0, W, 30, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.text(title, M, 13);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.text(`Grouped by ${roleLabel}  ·  ${periodLabel}`, M, 22);
      doc.text(new Date().toLocaleDateString(), W - M, 22, { align: 'right' });
      y = 38;

      const summaries = buildSummaries(groups);

      // Portfolio summary text
      if (summaryText && summaryText.trim()) {
        ensureSpace(14);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...NAVY);
        doc.text('Portfolio Summary', M, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(50, 70, 90);
        const lines = doc.splitTextToSize(summaryText, W - 2 * M);
        const lineH = 4.2;
        let i = 0;
        while (i < lines.length) {
          ensureSpace(lineH + 2);
          const avail = Math.max(1, Math.floor((H - 14 - y) / lineH));
          const chunk = lines.slice(i, i + avail);
          doc.text(chunk, M, y + 3);
          y += chunk.length * lineH;
          i += chunk.length;
        }
        y += 6;
      }

      // Overview table
      const cX = { op: M, hotels: M + 50, gop: M + 66, margin: M + 84, rgi: M + 102, gss: M + 118, fcst: M + 134, redz: M + 150, avg: M + 166, port: M + 180 };
      ensureSpace(10);
      doc.setFillColor(...NAVY);
      doc.rect(M, y, W - 2 * M, 7, 'F');
      doc.setTextColor(...WHITE);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.text('OPERATOR', cX.op, y + 4.6);
      doc.text('HOTELS', cX.hotels, y + 4.6, { align: 'center' });
      doc.text('GOP/35', cX.gop, y + 4.6, { align: 'center' });
      doc.text('MARGIN/35', cX.margin, y + 4.6, { align: 'center' });
      doc.text('RGI/15', cX.rgi, y + 4.6, { align: 'center' });
      doc.text('GSS/15', cX.gss, y + 4.6, { align: 'center' });
      doc.text('FCST', cX.fcst, y + 4.6, { align: 'center' });
      doc.text('RED ZN', cX.redz, y + 4.6, { align: 'center' });
      doc.text('AVG', cX.avg, y + 4.6, { align: 'center' });
      doc.text('PORT', cX.port, y + 4.6, { align: 'center' });
      y += 7;

      summaries.forEach((g, idx) => {
        ensureSpace(8);
        if (idx % 2 === 0) {
          doc.setFillColor(248, 250, 252);
          doc.rect(M, y, W - 2 * M, 7, 'F');
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(30, 53, 71);
        doc.text(g.name.length > 34 ? g.name.slice(0, 33) + '…' : g.name, cX.op + 1, y + 4.6);
        doc.setTextColor(...GREY);
        doc.text(String(g.hotels), cX.hotels, y + 4.6, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...scoreColor(g.gop, 35)); doc.text(fmt(g.gop), cX.gop, y + 4.6, { align: 'center' });
        doc.setTextColor(...scoreColor(g.gopMargin, 35)); doc.text(fmt(g.gopMargin), cX.margin, y + 4.6, { align: 'center' });
        doc.setTextColor(...scoreColor(g.rgi, 15)); doc.text(fmt(g.rgi), cX.rgi, y + 4.6, { align: 'center' });
        doc.setTextColor(...scoreColor(g.gss, 15)); doc.text(fmt(g.gss), cX.gss, y + 4.6, { align: 'center' });
        doc.setTextColor(...GREY); doc.setFont('helvetica', 'normal'); doc.text(`${g.forecastHits}/${g.forecastTotal}`, cX.fcst, y + 4.6, { align: 'center' });
        doc.text(g.redZoneApplicable > 0 ? `${g.redZoneCompliant}/${g.redZoneApplicable}` : 'N/A', cX.redz, y + 4.6, { align: 'center' });
        doc.setTextColor(...scoreColor(g.avg)); doc.setFont('helvetica', 'bold'); doc.text(fmt(g.avg), cX.avg, y + 4.6, { align: 'center' });
        doc.setTextColor(...scoreColor(g.portfolio)); doc.text(fmt(g.portfolio), cX.port, y + 4.6, { align: 'center' });
        y += 7;
      });
      y += 6;

      // Summary details (actual KPI rollups) per operator
      summaries.forEach((g) => {
        ensureSpace(24);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...NAVY);
        doc.text(`${g.name} — Summary Details`, M, y);
        y += 5;
        const tiles = [
          { label: 'GOP ACTUAL', value: fmt$(g.gopActual), sub: `Budget ${fmt$(g.gopBudget)}`, foot: g.gopVarPct != null ? `${g.gopVar >= 0 ? '+' : '-'}${fmt$(Math.abs(g.gopVar))} · ${g.gopVarPct >= 0 ? '+' : ''}${g.gopVarPct.toFixed(1)}%` : (g.gopVar != null ? `${g.gopVar >= 0 ? '+' : '-'}${fmt$(Math.abs(g.gopVar))}` : '—'), footColor: g.gopVar >= 0 ? GREEN : RED },
          { label: 'GOP MARGIN', value: g.marginActual != null ? `${g.marginActual.toFixed(1)}%` : '—', sub: `LY ${g.marginPrior != null ? g.marginPrior.toFixed(1) + '%' : '—'}`, foot: g.marginDelta != null ? `${g.marginDelta >= 0 ? '+' : ''}${g.marginDelta.toFixed(1)} pts` : '—', footColor: g.marginDelta != null && g.marginDelta > 0.1 ? GREEN : g.marginDelta != null && g.marginDelta < 0 ? RED : AMBER },
          { label: 'RGI INDEX', value: g.rgiIndex != null ? g.rgiIndex.toFixed(1) : '—', sub: `LY ${g.rgiPrior != null ? g.rgiPrior.toFixed(1) : '—'}`, foot: g.rgiChange != null ? `${g.rgiChange >= 0 ? '+' : ''}${g.rgiChange.toFixed(1)}%` : '—', footColor: g.rgiChange != null && g.rgiChange >= 0.1 ? GREEN : RED },
          { label: 'GSS (NORM)', value: g.gssActual != null ? g.gssActual.toFixed(1) : '—', sub: `LY ${g.gssPrior != null ? g.gssPrior.toFixed(1) : '—'}`, foot: g.gssDelta != null ? `${g.gssDelta >= 0 ? '+' : ''}${g.gssDelta.toFixed(1)}` : '—', footColor: g.gssDelta != null && g.gssDelta > 0 ? GREEN : RED },
          { label: 'FORECAST', value: `${g.forecastHits}/${g.forecastTotal}`, sub: 'hotels hitting', foot: '', footColor: GREY },
          { label: 'RED ZONE', value: g.redZoneApplicable > 0 ? `${g.redZoneCompliant}/${g.redZoneApplicable}` : 'N/A', sub: 'hotels earning', foot: '', footColor: GREY },
        ];
        const tw = (W - 2 * M - 5 * 2) / 6;
        const th = 16;
        tiles.forEach((t, i) => {
          const tx = M + i * (tw + 2);
          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(225, 230, 235);
          doc.roundedRect(tx, y, tw, th, 1.2, 1.2, 'FD');
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(5.5);
          doc.setTextColor(...GREY);
          doc.text(t.label, tx + 1.5, y + 3.5);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(30, 53, 71);
          doc.text(t.value, tx + 1.5, y + 8.5);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(5.5);
          doc.setTextColor(...GREY);
          doc.text(t.sub, tx + 1.5, y + 12.5);
          if (t.foot) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(5.8);
            doc.setTextColor(...t.footColor);
            doc.text(t.foot, tx + 1.5, y + 15);
          }
        });
        y += th + 6;
      });

      // Per-operator hotel detail
      const hX = { rank: M, hotel: M + 12, gop: M + 82, margin: M + 98, rgi: M + 114, gss: M + 130, total: M + 146, fcst: M + 164, redz: M + 180 };

      summaries.forEach((g) => {
        ensureSpace(20);
        doc.setFillColor(...NAVY);
        doc.rect(M, y, W - 2 * M, 8, 'F');
        doc.setTextColor(...WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(g.name, M + 2, y + 5.4);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(`${g.hotels} hotels · ${g.rooms.toLocaleString('en-US')} rms`, M + 72, y + 5.4);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(`Portfolio ${fmt(g.portfolio)}`, W - M - 2, y + 5.4, { align: 'right' });
        y += 8;

        ensureSpace(8);
        doc.setFillColor(230, 235, 240);
        doc.rect(M, y, W - 2 * M, 6, 'F');
        doc.setTextColor(...GREY);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.text('#', hX.rank + 2, y + 4);
        doc.text('HOTEL', hX.hotel + 1, y + 4);
        doc.text('GOP', hX.gop, y + 4, { align: 'center' });
        doc.text('MARGIN', hX.margin, y + 4, { align: 'center' });
        doc.text('RGI', hX.rgi, y + 4, { align: 'center' });
        doc.text('GSS', hX.gss, y + 4, { align: 'center' });
        doc.text('TOTAL', hX.total, y + 4, { align: 'center' });
        doc.text('FCST', hX.fcst, y + 4, { align: 'center' });
        doc.text('RED ZN', hX.redz, y + 4, { align: 'center' });
        y += 6;

        const sortedRows = [...g.rows].sort((a, b) => (b.total ?? -1) - (a.total ?? -1));
        sortedRows.forEach((r, i) => {
          ensureSpace(7);
          if (i % 2 === 0) {
            doc.setFillColor(248, 250, 252);
            doc.rect(M, y, W - 2 * M, 6.5, 'F');
          }
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7);
          doc.setTextColor(...GREY);
          doc.text(String(i + 1), hX.rank + 2, y + 4.4);
          doc.setTextColor(30, 53, 71);
          const nm = r.property.name.length > 32 ? r.property.name.slice(0, 31) + '…' : r.property.name;
          doc.text(nm, hX.hotel + 1, y + 4.4);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...scoreColor(r.gop, 35)); doc.text(fmt(r.gop), hX.gop, y + 4.4, { align: 'center' });
          doc.setTextColor(...scoreColor(r.gopMargin, 35)); doc.text(fmt(r.gopMargin), hX.margin, y + 4.4, { align: 'center' });
          doc.setTextColor(...scoreColor(r.rgi, 15)); doc.text(fmt(r.rgi), hX.rgi, y + 4.4, { align: 'center' });
          doc.setTextColor(...scoreColor(r.gss, 15)); doc.text(fmt(r.gss), hX.gss, y + 4.4, { align: 'center' });
          doc.setTextColor(...scoreColor(r.total, r.maxPossible || 100)); doc.text(r.total != null ? r.total.toFixed(1) : '—', hX.total, y + 4.4, { align: 'center' });
          doc.setTextColor(...(r.forecast == null ? GREY : (r.forecast ? GREEN : RED))); doc.text(r.forecast == null ? '—' : (r.forecast ? 'HIT' : 'MISS'), hX.fcst, y + 4.4, { align: 'center' });
          {
            const rzNa = r.property?.parent_brand === 'Independent';
            const rzLabel = rzNa ? 'N/A' : (r.redzone == null ? '—' : (r.redzone ? 'HIT' : 'OUT'));
            const rzColor = (rzNa || r.redzone == null || r.redzone === false) ? GREY : GREEN;
            doc.setTextColor(...rzColor); doc.text(rzLabel, hX.redz, y + 4.4, { align: 'center' });
          }
          y += 6.5;
        });
        y += 5;
      });

      addFooter();
      doc.save(`Leadership Rollup — ${periodLabel}.pdf`);
    } catch (e) {
      console.error(e);
    }
    setBusy(false);
  };

  return (
    <Button
      onClick={handleDownload}
      disabled={busy || !groups?.length}
      variant="outline"
      size="sm"
      className="text-xs gap-1.5"
    >
      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
      {label}
    </Button>
  );
}