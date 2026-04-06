import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Upload, CheckCircle, AlertCircle, Loader2, Download, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MONTHS, getQuarterFromMonth } from '@/lib/scoring';

// --- CSV/Excel parser (uses built-in FileReader; Excel via simple binary parse) ---
function parseCsv(text) {
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });
}

// Fuzzy match: lowercase + strip punctuation, pick best partial match
function bestMatch(name, properties) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
  const needle = norm(name);
  let best = null, bestScore = 0;
  for (const p of properties) {
    const hay = norm(p.name);
    if (hay === needle) return p; // exact
    // Score: count matching words
    const needleWords = needle.split(' ');
    const hayWords = hay.split(' ');
    const matches = needleWords.filter(w => hayWords.includes(w)).length;
    const score = matches / Math.max(needleWords.length, hayWords.length);
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return bestScore >= 0.4 ? best : null;
}

// Parse month: accepts "Jan", "January", "1", "01", "2026-01", "1/2026"
function parseMonth(raw) {
  if (!raw) return null;
  const r = raw.toString().trim();
  const monthNames = MONTHS.map(m => m.toLowerCase());
  // "January 2026" or "Jan 2026"
  for (let i = 0; i < monthNames.length; i++) {
    if (r.toLowerCase().startsWith(monthNames[i].slice(0, 3))) return i + 1;
  }
  // numeric
  const n = parseInt(r, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  // ISO: 2026-01
  const iso = r.match(/(\d{4})-(\d{2})/);
  if (iso) return parseInt(iso[2], 10);
  return null;
}

function parseYear(raw, monthRaw) {
  if (!raw) {
    // try to extract year from monthRaw
    const m = (monthRaw || '').toString().match(/\b(20\d{2})\b/);
    if (m) return parseInt(m[1], 10);
    return new Date().getFullYear();
  }
  const n = parseInt(raw.toString(), 10);
  return isNaN(n) ? new Date().getFullYear() : n;
}

export default function StrImport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef();
  const [rows, setRows] = useState(null); // parsed preview rows
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null);
  const [dragOver, setDragOver] = useState(false);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('name', 100),
  });

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    let rawRows = [];

    if (ext === 'csv') {
      const text = await file.text();
      rawRows = parseCsv(text);
    } else if (ext === 'xlsx' || ext === 'xls') {
      // Use LLM extraction for Excel
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            rows: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  hotel_name: { type: 'string' },
                  month: { type: 'string' },
                  year: { type: 'string' },
                  revpar_index_change: { type: 'string' },
                },
              },
            },
          },
        },
      });
      rawRows = result?.output?.rows || [];
    } else {
      toast({ title: 'Unsupported file', description: 'Please upload a CSV or Excel file.', variant: 'destructive' });
      return;
    }

    // Normalize column names & match hotels
    const preview = rawRows
      .filter(r => r.hotel_name || r['hotel name'] || r.hotel || r.property)
      .map(r => {
        const hotelName = r.hotel_name || r['hotel name'] || r.hotel || r.property || '';
        const monthRaw = r.month || r['period month'] || r.period || r.date || '';
        const yearRaw = r.year || r['period year'] || '';
        const changeRaw = r.revpar_index_change || r['revpar index change'] || r['rgi'] || r['revpar % change'] || r['index change'] || r['str rgi'] || r['% change'] || '';

        const month = parseMonth(monthRaw);
        const year = parseYear(yearRaw, monthRaw);
        const change = parseFloat(changeRaw.toString().replace('%', ''));
        const matched = bestMatch(hotelName, properties);

        return { hotelName, monthRaw, month, year, change, matched, error: !matched || isNaN(change) || !month };
      });

    setRows(preview);
    setResults(null);
  };

  const handleImport = async () => {
    if (!rows) return;
    setImporting(true);
    const ok = [], fail = [];

    for (const row of rows) {
      if (row.error) { fail.push(row.hotelName); continue; }
      // Fetch existing entry for this property+month+year
      const existing = await base44.entities.ScoreEntry.filter({
        property_id: row.matched.id,
        month: row.month,
        year: row.year,
      });

      const data = {
        property_id: row.matched.id,
        month: row.month,
        year: row.year,
        quarter: getQuarterFromMonth(row.month),
        revpar_index_change: row.change,
      };

      if (existing.length > 0) {
        await base44.entities.ScoreEntry.update(existing[0].id, { revpar_index_change: row.change });
      } else {
        await base44.entities.ScoreEntry.create(data);
      }
      ok.push(row.hotelName);
    }

    queryClient.invalidateQueries({ queryKey: ['score-entries'] });
    setResults({ ok, fail });
    setImporting(false);
    toast({ title: `Import complete`, description: `${ok.length} updated, ${fail.length} skipped.` });
  };

  const downloadTemplate = () => {
    const csv = `hotel_name,month,year,revpar_index_change\nSheraton Orlando North Hotel,January,2026,2.5\nInk 48 Hotel,January,2026,-1.2`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'str_import_template.csv'; a.click();
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
        <h1 className="text-2xl font-bold">STR RevPAR Index Import</h1>
        <p className="text-white/70 text-sm mt-1">Upload a CSV or Excel file to bulk-import RevPAR Index % change data by hotel and month.</p>
      </div>

      {/* Template download */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex items-center justify-between gap-4">
        <div>
          <p className="font-semibold text-sm">Required columns</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            <code className="bg-muted px-1 rounded">hotel_name</code> · <code className="bg-muted px-1 rounded">month</code> · <code className="bg-muted px-1 rounded">year</code> · <code className="bg-muted px-1 rounded">revpar_index_change</code>
            <span className="ml-2 text-muted-foreground">(e.g. 2.5 for +2.5%, -1.2 for -1.2%)</span>
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate} className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> Download Template
        </Button>
      </div>

      {/* Upload zone */}
      <div
        className={`bg-card rounded-2xl border-2 border-dashed p-12 text-center cursor-pointer transition-all shadow-sm ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => fileInputRef.current?.click()}
      >
        <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
          onChange={e => handleFile(e.target.files[0])} />
        <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="font-semibold">Drag & drop your STR file here, or click to browse</p>
        <p className="text-xs text-muted-foreground mt-1">CSV or Excel (.xlsx / .xls)</p>
      </div>

      {/* Preview table */}
      {rows && rows.length > 0 && (
        <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-bold text-foreground">Preview — {rows.length} rows</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="text-green-600 font-medium">{validRows.length} ready</span>
                {invalidRows.length > 0 && <span className="text-red-500 font-medium ml-2">{invalidRows.length} will be skipped</span>}
              </p>
            </div>
            <Button
              onClick={handleImport}
              disabled={importing || validRows.length === 0}
              style={{ backgroundColor: '#2d4b5e' }}
              className="gap-2"
            >
              {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : `Import ${validRows.length} Records`}
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-left">Hotel (from file)</th>
                  <th className="py-3 px-4 text-left">Matched Property</th>
                  <th className="py-3 px-4 text-center">Month</th>
                  <th className="py-3 px-4 text-center">Year</th>
                  <th className="py-3 px-4 text-center">RGI % Change</th>
                  <th className="py-3 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className={`border-b border-border ${row.error ? 'bg-red-50/50' : 'hover:bg-muted/20'}`}>
                    <td className="py-3 px-4 text-sm font-medium">{row.hotelName}</td>
                    <td className="py-3 px-4 text-sm text-muted-foreground">{row.matched?.name || <span className="text-red-500">No match found</span>}</td>
                    <td className="py-3 px-4 text-center text-sm">{row.month ? MONTHS[row.month - 1] : <span className="text-red-500">?</span>}</td>
                    <td className="py-3 px-4 text-center text-sm">{row.year}</td>
                    <td className="py-3 px-4 text-center font-mono font-semibold">
                      {isNaN(row.change) ? <span className="text-red-500">?</span> : (
                        <span className={row.change >= 0 ? 'text-green-600' : 'text-red-500'}>
                          {row.change >= 0 ? '+' : ''}{row.change.toFixed(2)}%
                        </span>
                      )}
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
                <p className="font-semibold text-sm">{results.ok.length} records imported successfully</p>
                <p className="text-xs mt-1">{results.ok.join(', ')}</p>
              </div>
            </div>
          )}
          {results.fail.length > 0 && (
            <div className="flex items-start gap-2 text-red-700 bg-red-50 rounded-xl p-4">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">{results.fail.length} rows skipped</p>
                <p className="text-xs mt-1">{results.fail.join(', ')}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}