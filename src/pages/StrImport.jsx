import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, AlertCircle, Loader2, Download, ChevronRight, FileSpreadsheet } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MONTHS, getQuarterFromMonth } from '@/lib/scoring';

// Fuzzy match hotel name to known properties
function bestMatch(name, properties) {
  if (!name) return null;
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const needle = norm(name);
  let best = null, bestScore = 0;
  for (const p of properties) {
    const hay = norm(p.name);
    if (hay === needle) return p;
    const needleWords = needle.split(' ');
    const hayWords = hay.split(' ');
    const matches = needleWords.filter(w => w.length > 2 && hayWords.includes(w)).length;
    const score = matches / Math.max(needleWords.length, hayWords.length);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 0.35 ? best : null;
}

// Parse month name or number
function parseMonth(raw) {
  if (!raw) return null;
  const r = raw.toString().trim();
  const names = MONTHS.map(m => m.toLowerCase());
  for (let i = 0; i < names.length; i++) {
    if (r.toLowerCase().startsWith(names[i].slice(0, 3))) return i + 1;
  }
  const n = parseInt(r, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  const iso = r.match(/(\d{4})-(\d{2})/);
  if (iso) return parseInt(iso[2], 10);
  return null;
}

function parseYear(raw, monthRaw) {
  if (raw) {
    const n = parseInt(raw.toString(), 10);
    if (!isNaN(n) && n > 2000) return n;
  }
  const m = (monthRaw || '').toString().match(/\b(20\d{2})\b/);
  if (m) return parseInt(m[1], 10);
  return new Date().getFullYear();
}

export default function StrImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef();
  const [rows, setRows] = useState(null);
  const [importing, setImporting] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('name', 100),
  });

  const handleFile = async (file) => {
    if (!file) return;
    setFileName(file.name);
    setRows(null);
    setResults(null);
    setExtracting(true);

    // Upload the file first
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    // Use AI extraction to pull all KPI data regardless of file format/layout
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            description: 'One row per hotel per month found in the file',
            items: {
              type: 'object',
              properties: {
                hotel_name: { type: 'string', description: 'Hotel or property name' },
                month: { type: 'string', description: 'Month name or number (e.g. January, Jan, 1)' },
                year: { type: 'string', description: 'Year (e.g. 2026)' },
                revpar_index_change: { type: 'string', description: 'RevPAR Index % change vs prior year (e.g. 2.5 or -1.2). Also called RGI, Index Change, MPI change, ARI change, RevPAR Index' },
                budgeted_gop_actual: { type: 'string', description: 'Actual GOP achieved this period in dollars' },
                budgeted_gop_target: { type: 'string', description: 'Budgeted/target GOP for this period in dollars' },
                gop_margin_actual: { type: 'string', description: 'GOP margin % this period' },
                gop_margin_prior: { type: 'string', description: 'GOP margin % prior year same period' },
                gss_actual: { type: 'string', description: 'Guest satisfaction score this period (GSS, ITR, Stay Score, Overall Experience, etc.)' },
                gss_prior: { type: 'string', description: 'Guest satisfaction score prior year' },
              },
            },
          },
        },
      },
    });

    setExtracting(false);

    const rawRows = result?.output?.rows || [];
    if (!rawRows.length) {
      toast({ title: 'No data found', description: 'The AI could not extract hotel data from this file. Make sure it contains hotel names, months, and KPI values.', variant: 'destructive' });
      return;
    }

    const preview = rawRows.map(r => {
      const hotelName = r.hotel_name || '';
      const monthRaw = r.month || '';
      const yearRaw = r.year || '';
      const month = parseMonth(monthRaw);
      const year = parseYear(yearRaw, monthRaw);
      const matched = bestMatch(hotelName, properties);

      const change = parseFloat((r.revpar_index_change || '').toString().replace('%', ''));
      const gopActual = parseFloat((r.budgeted_gop_actual || '').toString().replace(/[$,]/g, ''));
      const gopTarget = parseFloat((r.budgeted_gop_target || '').toString().replace(/[$,]/g, ''));
      const gopMarginActual = parseFloat((r.gop_margin_actual || '').toString().replace('%', ''));
      const gopMarginPrior = parseFloat((r.gop_margin_prior || '').toString().replace('%', ''));
      const gssActual = parseFloat((r.gss_actual || '').toString());
      const gssPrior = parseFloat((r.gss_prior || '').toString());

      const hasAnyData = !isNaN(change) || !isNaN(gopActual) || !isNaN(gopMarginActual) || !isNaN(gssActual);
      const error = !matched || !month || !hasAnyData;

      return { hotelName, month, year, matched, change, gopActual, gopTarget, gopMarginActual, gopMarginPrior, gssActual, gssPrior, error };
    });

    setRows(preview);
  };

  const handleImport = async () => {
    if (!rows) return;
    setImporting(true);
    const ok = [], fail = [];

    for (const row of rows) {
      if (row.error) { fail.push(row.hotelName || '(unknown)'); continue; }

      const existing = await base44.entities.ScoreEntry.filter({
        property_id: row.matched.id,
        month: row.month,
        year: row.year,
      });

      const patch = {};
      if (!isNaN(row.change)) patch.revpar_index_change = row.change;
      if (!isNaN(row.gopActual)) patch.budgeted_gop_actual = row.gopActual;
      if (!isNaN(row.gopTarget)) patch.budgeted_gop_target = row.gopTarget;
      if (!isNaN(row.gopMarginActual)) patch.gop_margin_actual = row.gopMarginActual;
      if (!isNaN(row.gopMarginPrior)) patch.gop_margin_prior = row.gopMarginPrior;
      if (!isNaN(row.gssActual)) patch.gss_actual = row.gssActual;
      if (!isNaN(row.gssPrior)) patch.gss_prior = row.gssPrior;

      if (existing.length > 0) {
        await base44.entities.ScoreEntry.update(existing[0].id, patch);
      } else {
        await base44.entities.ScoreEntry.create({
          property_id: row.matched.id,
          month: row.month,
          year: row.year,
          quarter: getQuarterFromMonth(row.month),
          ...patch,
        });
      }
      ok.push(row.hotelName);
    }

    queryClient.invalidateQueries({ queryKey: ['score-entries'] });
    setResults({ ok, fail });
    setImporting(false);
    toast({ title: 'Import complete', description: `${ok.length} updated, ${fail.length} skipped.` });
  };

  const downloadTemplate = () => {
    const csv = `hotel_name,month,year,revpar_index_change,budgeted_gop_actual,budgeted_gop_target,gop_margin_actual,gop_margin_prior,gss_actual,gss_prior\nSheraton Orlando North Hotel,January,2026,2.5,850000,900000,32.5,31.2,72,70\nInk 48 Hotel,January,2026,-1.2,320000,300000,28.1,29.0,85,83`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'str_kpi_template.csv'; a.click();
  };

  const validRows = rows?.filter(r => !r.error) || [];
  const invalidRows = rows?.filter(r => r.error) || [];

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <span>Balanced Scorecard</span><ChevronRight className="w-3 h-3" /><span>STR Import</span>
        </div>
        <h1 className="text-2xl font-bold">KPI Data Import</h1>
        <p className="text-white/70 text-sm mt-1">
          Upload your STR, GOP, or GSS report — AI will extract hotel names, months, and KPI values automatically.
        </p>
      </div>

      {/* Info panel */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">Supported KPIs extracted automatically</p>
          <p className="text-xs text-muted-foreground mt-1">
            RevPAR Index % Change (RGI) · GOP Actual & Budget · GOP Margin (actual & prior) · GSS Score (actual & prior)
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Accepts <strong>any</strong> Excel, CSV, or PDF layout — AI maps columns intelligently.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> CSV Template
        </Button>
      </div>

      {/* Upload zone */}
      <div
        className={`bg-card rounded-2xl border-2 border-dashed p-14 text-center cursor-pointer transition-all shadow-sm ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => !extracting && fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls,.pdf" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        {extracting ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
            <p className="font-semibold">AI is extracting data from <span className="text-primary">{fileName}</span>…</p>
            <p className="text-xs text-muted-foreground">This may take 10–20 seconds</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-1" />
            <p className="font-semibold">Drag & drop your report here, or click to browse</p>
            <p className="text-xs text-muted-foreground">CSV, Excel (.xlsx / .xls), or PDF</p>
          </div>
        )}
      </div>

      {/* Preview table */}
      {rows && rows.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between gap-4">
            <div>
              <h2 className="font-bold text-foreground">Preview — {rows.length} rows found</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="text-green-600 font-medium">{validRows.length} ready to import</span>
                {invalidRows.length > 0 && <span className="text-red-500 font-medium ml-3">{invalidRows.length} will be skipped</span>}
              </p>
            </div>
            <Button
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              style={{ backgroundColor: '#2d4b5e' }}
              className="gap-2 shrink-0"
            >
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</> : `Import ${validRows.length} Records`}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-left">Hotel (from file)</th>
                  <th className="py-3 px-4 text-left">Matched Property</th>
                  <th className="py-3 px-4 text-center">Month / Year</th>
                  <th className="py-3 px-4 text-center">RGI %</th>
                  <th className="py-3 px-4 text-center">GOP Actual</th>
                  <th className="py-3 px-4 text-center">GOP Margin</th>
                  <th className="py-3 px-4 text-center">GSS</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-border ${row.error ? 'bg-red-50/40' : 'hover:bg-muted/20'}`}>
                    <td className="py-3 px-4 font-medium text-sm">{row.hotelName}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">
                      {row.matched?.name || <span className="text-red-500 text-xs">No match</span>}
                    </td>
                    <td className="py-3 px-4 text-center text-sm">
                      {row.month ? `${MONTHS[row.month - 1]} ${row.year}` : <span className="text-red-500">?</span>}
                    </td>
                    <td className="py-3 px-4 text-center font-mono text-sm">
                      {!isNaN(row.change) ? (
                        <span className={row.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}%
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                      {!isNaN(row.gopActual) ? `$${(row.gopActual / 1000).toFixed(0)}K` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                      {!isNaN(row.gopMarginActual) ? `${row.gopMarginActual}%` : '—'}
                    </td>
                    <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                      {!isNaN(row.gssActual) ? row.gssActual : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {row.error
                        ? <span className="inline-flex items-center gap-1 text-xs text-red-500"><AlertCircle className="w-3.5 h-3.5" /> Skip</span>
                        : <span className="inline-flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3.5 h-3.5" /> Ready</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-3">
          <h2 className="font-bold text-foreground">Import Results</h2>
          {results.ok.length > 0 && (
            <div className="flex items-start gap-2 text-green-700 bg-green-50 rounded-xl p-4">
              <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{results.ok.length} records saved successfully</p>
                <p className="text-xs mt-1 leading-relaxed">{results.ok.join(' · ')}</p>
              </div>
            </div>
          )}
          {results.fail.length > 0 && (
            <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{results.fail.length} rows skipped (no hotel match or missing month/data)</p>
                <p className="text-xs mt-1 leading-relaxed">{results.fail.join(' · ')}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}