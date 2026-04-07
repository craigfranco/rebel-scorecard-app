import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Download, Trash2, Building2, Globe, Loader2, CheckCircle, AlertCircle, Sparkles, RefreshCw, Eraser } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MONTHS, getQuarterFromMonth } from '../lib/scoring';

const KPI_TAG_STYLES = {
  'GOP Report':     { label: 'GOP',     bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'RGI/STR Report': { label: 'RGI/STR', bg: 'bg-blue-50',    text: 'text-blue-700' },
  'GSS Report':     { label: 'GSS',     bg: 'bg-purple-50',  text: 'text-purple-700' },
  'Other':          { label: 'Other',   bg: 'bg-muted',      text: 'text-muted-foreground' },
};

function KpiTag({ docType }) {
  const style = KPI_TAG_STYLES[docType] || KPI_TAG_STYLES['Other'];
  return (
    <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
      {style.label}
    </span>
  );
}

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 1;
const DOC_TYPES = ['GOP Report', 'RGI/STR Report', 'GSS Report', 'Other'];
const KPI_DOC_TYPES = ['GOP Report', 'RGI/STR Report', 'GSS Report'];
const FILE_TYPE_MAP = { pdf: 'PDF', xlsx: 'Excel', xls: 'Excel', csv: 'CSV' };

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_TYPE_MAP[ext] || 'Other';
}

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
  return bestScore >= 0.25 ? best : null;
}

function parseMonth(raw) {
  if (!raw) return null;
  const r = raw.toString().trim();
  for (let i = 0; i < MONTHS.length; i++) {
    if (r.toLowerCase().startsWith(MONTHS[i].slice(0, 3).toLowerCase())) return i + 1;
  }
  const n = parseInt(r, 10);
  if (!isNaN(n) && n >= 1 && n <= 12) return n;
  const iso = r.match(/(\d{4})-(\d{2})/);
  if (iso) return parseInt(iso[2], 10);
  return null;
}

function parseYear(raw, monthRaw) {
  if (raw) { const n = parseInt(raw.toString(), 10); if (!isNaN(n) && n > 2000) return n; }
  const m = (monthRaw || '').toString().match(/\b(20\d{2})\b/);
  return m ? parseInt(m[1], 10) : new Date().getFullYear();
}

export default function Documents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [scope] = useState('company-wide');
  const [selectedPropertyId] = useState('');
  const [docType, setDocType] = useState('GOP Report');
  const [periodMonth, setPeriodMonth] = useState(CURRENT_MONTH);
  const [periodYear] = useState(CURRENT_YEAR);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [filterScope, setFilterScope] = useState('all');
  const [filterProperty, setFilterProperty] = useState('');
  const [reextractingId, setReextractingId] = useState(null);
  const [clearMonth, setClearMonth] = useState(CURRENT_MONTH);
  const [clearYear] = useState(CURRENT_YEAR);
  const [clearDocType, setClearDocType] = useState('all');
  const [clearing, setClearing] = useState(false);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('name', 100),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents'],
    queryFn: () => base44.entities.Document.list('-created_date', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Document.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      toast({ title: 'Deleted', description: 'File removed.' });
    },
  });

  const extractAndImportKpis = async (file_url, properties, month, year) => {
    console.log('Starting extraction for:', file_url);
    setUploadStatus('AI is extracting KPI data…');
    const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
      file_url,
      json_schema: {
        type: 'object',
        properties: {
          rows: {
            type: 'array',
            description: 'Extract every hotel/property data row. For P&L files: each row has numeric columns first, then the Property name in the middle. For STR files: the property name is the first column. Skip header rows, total rows, and blank rows.',
            items: {
              type: 'object',
              properties: {
                hotel_name: { type: 'string', description: 'Hotel or property name. In P&L files look for the column labeled "Property" which appears in the middle of the row.' },
                budgeted_gop_actual: { type: 'string', description: 'Period Actuals AMT — the first dollar amount column (GOP actual for the period).' },
                gop_margin_actual: { type: 'string', description: 'Period Actuals %REV — the percentage column next to Actuals AMT.' },
                budgeted_gop_target: { type: 'string', description: 'Period Budget AMT — the Budget dollar amount column.' },
                gop_margin_budget: { type: 'string', description: 'Period Budget %REV — the percentage column next to Budget AMT.' },
                gop_margin_prior: { type: 'string', description: 'Prior Year %REV — the percentage column for last year.' },
                gop_margin_variance: { type: 'string', description: 'Variance %REV — difference between actual and budget %REV.' },
                revpar_index_change: { type: 'string', description: 'RevPAR Index % Change — only present in STR/RGI files.' },
                gss_actual: { type: 'string', description: 'GSS score — only present in GSS report files.' },
                gss_prior: { type: 'string', description: 'Prior year GSS score — only present in GSS report files.' },
              },
              required: ['hotel_name'],
            },
          },
        },
      },
    });

    const rawRows = result?.output?.rows || result?.rows || [];
    console.log('=== EXTRACTION: got', rawRows.length, 'rows');
    if (rawRows.length > 0) {
      console.log('First row:', JSON.stringify(rawRows[0], null, 2));
    }
    if (!rawRows.length) return { ok: 0, fail: 0, skipped: true };

    let ok = 0, fail = 0;
    for (const r of rawRows) {
      const hotelName = r.hotel_name || '';
      const matched = bestMatch(hotelName, properties);

      const change = parseFloat((r.revpar_index_change || '').replace('%', ''));
      const gopActual = parseFloat((r.budgeted_gop_actual || '').replace(/[$,]/g, ''));
      const gopTarget = parseFloat((r.budgeted_gop_target || '').replace(/[$,]/g, ''));
      const gopMarginActual = parseFloat((r.gop_margin_actual || '').replace('%', ''));
      const gopMarginBudget = parseFloat((r.gop_margin_budget || '').replace('%', ''));
      const gopMarginPrior = parseFloat((r.gop_margin_prior || '').replace('%', ''));
      const gopMarginVariance = parseFloat((r.gop_margin_variance || '').replace('%', ''));
      const gssActual = parseFloat(r.gss_actual || '');
      const gssPrior = parseFloat(r.gss_prior || '');

      const hasData = !isNaN(change) || !isNaN(gopActual) || !isNaN(gopMarginActual) || !isNaN(gssActual);
      
      if (!matched || !hasData) {
        console.log(`Skipped "${hotelName}": matched=${!!matched}, hasData=${hasData}, change=${change}, gop=${gopActual}, margin=${gopMarginActual}, gss=${gssActual}`);
        fail++;
        continue;
      }
      console.log(`Importing "${hotelName}" (${matched.name}): change=${change}, gop=${gopActual}, margin=${gopMarginActual}, gss=${gssActual}`);

      const patch = {};
      if (!isNaN(change)) patch.revpar_index_change = change;
      if (!isNaN(gopActual)) patch.budgeted_gop_actual = gopActual;
      if (!isNaN(gopTarget)) patch.budgeted_gop_target = gopTarget;
      if (!isNaN(gopMarginActual)) patch.gop_margin_actual = gopMarginActual;
      if (!isNaN(gopMarginBudget)) patch.gop_margin_budget = gopMarginBudget;
      if (!isNaN(gopMarginVariance)) patch.gop_margin_variance = gopMarginVariance;
      if (!isNaN(gopMarginPrior)) patch.gop_margin_prior = gopMarginPrior;
      if (!isNaN(gssActual)) patch.gss_actual = gssActual;
      if (!isNaN(gssPrior)) patch.gss_prior = gssPrior;

      const existing = await base44.entities.ScoreEntry.filter({ property_id: matched.id, month, year });
      if (existing.length > 0) {
        await base44.entities.ScoreEntry.update(existing[0].id, patch);
      } else {
        await base44.entities.ScoreEntry.create({ property_id: matched.id, month, year, quarter: getQuarterFromMonth(month), ...patch });
      }
      ok++;
    }

    queryClient.invalidateQueries({ queryKey: ['score-entries'] });
    return { ok, fail, skipped: false };
  };

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    setImportResult(null);
    setUploadStatus('Uploading file…');

    const user = await base44.auth.me();
    const { file_url } = await base44.integrations.Core.UploadFile({ file });

    await base44.entities.Document.create({
      filename: file.name,
      file_url,
      file_type: getFileType(file.name),
      doc_type: docType,
      scope,
      property_id: scope === 'hotel-specific' ? selectedPropertyId : null,
      period_month: periodMonth,
      period_year: periodYear,
      uploaded_by: user?.full_name || user?.email || 'Unknown',
    });
    queryClient.invalidateQueries({ queryKey: ['documents'] });

    if (KPI_DOC_TYPES.includes(docType)) {
      const result = await extractAndImportKpis(file_url, properties, periodMonth, periodYear);
      if (!result.skipped) {
        setImportResult(result);
      }
    }

    setUploadStatus('');
    setUploading(false);
    toast({ title: 'Uploaded!', description: `${file.name} saved successfully.` });
  };

  const handleReextract = async (doc) => {
    setReextractingId(doc.id);
    const month = doc.period_month || CURRENT_MONTH;
    const year = doc.period_year || CURRENT_YEAR;
    const result = await extractAndImportKpis(doc.file_url, properties, month, year);
    setReextractingId(null);
    if (!result.skipped) {
      setImportResult(result);
      toast({
        title: result.ok > 0 ? 'KPI data updated!' : 'No data extracted',
        description: result.ok > 0
          ? `${result.ok} hotel record${result.ok > 1 ? 's' : ''} updated.`
          : 'No matching hotel data found in this file.',
      });
    }
  };

  const DOC_TYPE_FIELDS = {
    'GOP Report': ['budgeted_gop_actual', 'budgeted_gop_target', 'gop_margin_actual', 'gop_margin_budget', 'gop_margin_variance', 'gop_margin_prior'],
    'RGI/STR Report': ['revpar_index_change'],
    'GSS Report': ['gss_actual', 'gss_prior'],
  };

  const handleClearKpiData = async () => {
    const label = clearDocType === 'all' ? 'all KPI types' : clearDocType;
    if (!window.confirm(`Clear ${label} data for ${MONTHS[clearMonth - 1]} ${clearYear}? This cannot be undone.`)) return;
    setClearing(true);
    const entries = await base44.entities.ScoreEntry.filter({ month: clearMonth, year: clearYear });
    for (const e of entries) {
      if (clearDocType === 'all') {
        await base44.entities.ScoreEntry.delete(e.id);
      } else {
        const fields = DOC_TYPE_FIELDS[clearDocType] || [];
        const patch = {};
        fields.forEach(f => { patch[f] = null; });
        await base44.entities.ScoreEntry.update(e.id, patch);
      }
    }
    queryClient.invalidateQueries({ queryKey: ['score-entries'] });
    setClearing(false);
    toast({ title: 'Cleared', description: `${label} data cleared for ${MONTHS[clearMonth - 1]} ${clearYear} (${entries.length} record${entries.length !== 1 ? 's' : ''}).` });
  };

  const filteredDocs = documents
    .filter(d => filterScope === 'all' || d.scope === filterScope)
    .filter(d => !filterProperty || d.property_id === filterProperty);

  const propertyName = (id) => properties.find(p => p.id === id)?.name || '—';

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-white/70 text-sm mt-1">Upload and manage source files — financial reports, STR data, GSS scores</p>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-bold text-foreground">Upload New File</h2>
          {KPI_DOC_TYPES.includes(docType) && (
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
              <Sparkles className="w-3 h-3" /> KPI data will be auto-extracted
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={docType} onValueChange={setDocType}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={String(periodMonth)} onValueChange={v => setPeriodMonth(Number(v))}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m} {periodYear}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e.dataTransfer.files); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".pdf,.xlsx,.xls,.csv" className="hidden"
            onChange={e => handleFileUpload(e.target.files)} />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-muted-foreground">{uploadStatus}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="font-medium text-sm">Drag & drop a file here, or click to browse</p>
              <p className="text-xs text-muted-foreground">PDF, Excel, or CSV accepted</p>
            </div>
          )}
        </div>

        {importResult && !uploading && (
          <div className={`flex items-start gap-2 rounded-xl p-4 text-sm ${importResult.ok > 0 ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
            {importResult.ok > 0
              ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            <span>
              {importResult.ok > 0
                ? `KPI data extracted — ${importResult.ok} hotel record${importResult.ok > 1 ? 's' : ''} updated in scorecard.`
                : `File saved, but no matching hotel KPI data could be extracted.`}
              {importResult.fail > 0 && ` (${importResult.fail} rows skipped — hotel not matched or missing data)`}
            </span>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Eraser className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <h2 className="font-bold text-foreground text-sm">Clear KPI Data</h2>
              <p className="text-xs text-muted-foreground">Delete all scorecard entries for a specific period</p>
            </div>
          </div>
          <Select value={clearDocType} onValueChange={setClearDocType}>
            <SelectTrigger className="w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All KPI Types</SelectItem>
              <SelectItem value="GOP Report">GOP</SelectItem>
              <SelectItem value="RGI/STR Report">RGI/STR</SelectItem>
              <SelectItem value="GSS Report">GSS</SelectItem>
            </SelectContent>
          </Select>
          <Select value={String(clearMonth)} onValueChange={v => setClearMonth(Number(v))}>
            <SelectTrigger className="w-40 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m} {clearYear}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="destructive" size="sm" onClick={handleClearKpiData} disabled={clearing} className="gap-1.5">
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Clear Data
          </Button>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex flex-wrap items-center gap-3">
          <h2 className="font-bold text-foreground flex-1">Uploaded Files ({filteredDocs.length})</h2>
          <Select value={filterScope} onValueChange={(v) => { setFilterScope(v); setFilterProperty(''); }}>
            <SelectTrigger className="w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Files</SelectItem>
              <SelectItem value="company-wide">Company-Wide</SelectItem>
              <SelectItem value="hotel-specific">Hotel-Specific</SelectItem>
            </SelectContent>
          </Select>
          {filterScope !== 'company-wide' && (
            <Select value={filterProperty} onValueChange={setFilterProperty}>
              <SelectTrigger className="w-52 text-sm"><SelectValue placeholder="All hotels" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Hotels</SelectItem>
                {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold">Filename</th>
                <th className="py-3 px-4 text-center font-semibold">Type</th>
                <th className="py-3 px-4 text-center font-semibold">Period</th>
                <th className="py-3 px-4 text-center font-semibold">Scope</th>
                <th className="py-3 px-4 text-center font-semibold">Uploaded By</th>
                <th className="py-3 px-4 text-center font-semibold">Date</th>
                <th className="py-3 px-4 text-center font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-muted-foreground text-sm">
                    No files uploaded yet. Use the upload area above.
                  </td>
                </tr>
              ) : (
                filteredDocs.map(doc => (
                  <tr key={doc.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4">
                     <div className="flex items-center gap-2">
                       <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                       <span className="font-medium text-sm">{doc.filename}</span>
                     </div>
                     <div className="flex items-center gap-1.5 ml-6 mt-0.5">
                       <KpiTag docType={doc.doc_type} />
                     </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs bg-muted px-2 py-1 rounded-full font-medium">{doc.file_type}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                      {doc.period_month ? MONTHS[doc.period_month - 1] : '—'} {doc.period_year}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {doc.scope === 'company-wide' ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full font-medium">
                          <Globe className="w-3 h-3" /> Shared
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-full font-medium">
                          <Building2 className="w-3 h-3" /> {propertyName(doc.property_id)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">{doc.uploaded_by || '—'}</td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                      {doc.created_date ? new Date(doc.created_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {KPI_DOC_TYPES.includes(doc.doc_type) && (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-primary hover:text-primary"
                            title="Re-extract KPI data"
                            disabled={reextractingId === doc.id}
                            onClick={() => handleReextract(doc)}>
                            {reextractingId === doc.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <RefreshCw className="w-3.5 h-3.5" />}
                          </Button>
                        )}
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                            <Download className="w-3.5 h-3.5" />
                          </Button>
                        </a>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(doc.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}