import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, CheckCircle, AlertCircle, ArrowRight, ArrowLeft, FileText } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { parseFile, autoDetectMapping, applyMapping, bestMatch, detectRebelPLLayout } from '@/lib/fileParser';
import ColumnMapper from './ColumnMapper';
import HotelMatchTable from './HotelMatchTable';
import { MONTHS, getQuarterFromMonth } from '@/lib/scoring';

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 1;
const DOC_TYPES = ['GOP Report', 'RGI/STR Report', 'GSS Report', 'Forecast Accuracy', 'Other'];

// For the known Rebel P&L file format, hardcode the column mapping
const REBEL_PL_MAPPING = {
  hotel_name:          10,
  budgeted_gop_actual: 0,
  gop_margin_actual:   1,
  budgeted_gop_target: 2,
  gop_margin_budget:   3,
  budgeted_gop_prior:  6,
  gop_margin_prior:    7,
};

export default function ImportWizard({ file, properties, onClose, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep] = useState('parsing'); // parsing | pdf_notice | period | mapping | matching | importing | done
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null); // { headers, rows }
  const [docType, setDocType] = useState('GOP Report');
  const [periodMonth, setPeriodMonth] = useState(CURRENT_MONTH);
  const [periodYear] = useState(CURRENT_YEAR);
  const [mapping, setMapping] = useState({});
  const [mappedRows, setMappedRows] = useState([]);
  const [matches, setMatches] = useState([]);
  const [importResult, setImportResult] = useState(null);

  const ext = file.name.split('.').pop().toLowerCase();
  const isPdf = ext === 'pdf';

  // Step 1: parse on mount
  useEffect(() => {
    if (isPdf) { setStep('pdf_notice'); return; }
    parseFile(file)
      .then(result => {
        setParsed(result);
        // Auto-detect doc type from filename
           const fn = file.name.toLowerCase();
           let detectedType = 'GOP Report';
           if (fn.includes('str') || fn.includes('rgi') || fn.includes('revpar')) detectedType = 'RGI/STR Report';
           else if (fn.includes('gss') || fn.includes('satisfaction')) detectedType = 'GSS Report';
           else if (fn.includes('forecast')) detectedType = 'Forecast Accuracy';
           setDocType(detectedType);

        // Auto-detect mapping
        let autoMap;
        if (detectRebelPLLayout(result.headers) && detectedType === 'GOP Report') {
          autoMap = { ...REBEL_PL_MAPPING };
        } else {
          autoMap = autoDetectMapping(result.headers, detectedType);
        }
        setMapping(autoMap);
        setStep('period');
      })
      .catch(err => {
        if (err.message === 'unsupported_type') setStep('pdf_notice');
        else { setError(err.message); setStep('error'); }
      });
  }, []);

  const goToMapping = () => setStep('mapping');

  const goToMatching = () => {
    const rows = applyMapping(parsed.rows, mapping);
    const autoMatches = rows.map(r => bestMatch(r.hotel_name, properties));
    setMappedRows(rows);
    setMatches(autoMatches);
    setStep('matching');
  };

  const handleImport = async () => {
    setStep('importing');
    let ok = 0, fail = 0;

    // Upload file first
    const user = await base44.auth.me();
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Document.create({
      filename: file.name,
      file_url,
      file_type: ext === 'csv' ? 'CSV' : 'Excel',
      doc_type: docType,
      scope: 'company-wide',
      property_id: null,
      period_month: periodMonth,
      period_year: periodYear,
      uploaded_by: user?.full_name || user?.email || 'Unknown',
    });

    // Import each matched row
    for (let i = 0; i < mappedRows.length; i++) {
      const row = mappedRows[i];
      const prop = matches[i];
      if (!prop) { fail++; continue; }

      const patch = {};
      if (row.budgeted_gop_actual != null) patch.budgeted_gop_actual = row.budgeted_gop_actual;
      if (row.budgeted_gop_target != null) patch.budgeted_gop_target = row.budgeted_gop_target;
      if (row.budgeted_gop_prior != null)  patch.budgeted_gop_prior  = row.budgeted_gop_prior;
      if (row.gop_margin_actual != null)   patch.gop_margin_actual   = row.gop_margin_actual;
      if (row.gop_margin_prior != null)    patch.gop_margin_prior    = row.gop_margin_prior;
      if (row.gop_margin_budget != null)   patch.gop_margin_budget   = row.gop_margin_budget;
      if (row.revpar_index_change != null) patch.revpar_index_change = row.revpar_index_change;
      if (row.revpar_index != null)        patch.revpar_index        = row.revpar_index;
      if (row.revpar_index_prior != null)  patch.revpar_index_prior  = row.revpar_index_prior;
      if (row.gss_actual != null)          patch.gss_actual          = row.gss_actual;
       if (row.gss_prior != null)           patch.gss_prior           = row.gss_prior;
       if (row.forecast_actual_revenue != null && row.forecast_primary_forecast != null) {
         const diff = row.forecast_actual_revenue - row.forecast_primary_forecast;
         patch.forecast_kicker = diff >= 0 ? 'Hit' : 'Miss';
       }

      if (Object.keys(patch).length === 0) { fail++; continue; }

      const existing = await base44.entities.ScoreEntry.filter({ property_id: prop.id, month: periodMonth, year: periodYear });
      if (existing.length > 0) {
        await base44.entities.ScoreEntry.update(existing[0].id, patch);
      } else {
        await base44.entities.ScoreEntry.create({
          property_id: prop.id,
          month: periodMonth,
          year: periodYear,
          quarter: getQuarterFromMonth(periodMonth),
          ...patch,
        });
      }
      ok++;
    }

    queryClient.invalidateQueries({ queryKey: ['score-entries'] });
    queryClient.invalidateQueries({ queryKey: ['all-entries'] });
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    setImportResult({ ok, fail });
    setStep('done');
  };

  const handlePdfSave = async () => {
    setStep('importing');
    const user = await base44.auth.me();
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.Document.create({
      filename: file.name,
      file_url,
      file_type: 'PDF',
      doc_type: docType,
      scope: 'company-wide',
      period_month: periodMonth,
      period_year: periodYear,
      uploaded_by: user?.full_name || user?.email || 'Unknown',
    });
    queryClient.invalidateQueries({ queryKey: ['documents'] });
    setStep('done');
    setImportResult({ ok: 0, fail: 0, pdfOnly: true });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <FileText className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {step === 'parsing' && 'Parsing file…'}
              {step === 'pdf_notice' && 'PDF file'}
              {step === 'period' && 'Step 1 of 4 — Report type & period'}
              {step === 'mapping' && 'Step 2 of 4 — Column mapping'}
              {step === 'matching' && 'Step 3 of 4 — Hotel matching'}
              {step === 'importing' && 'Importing…'}
              {step === 'done' && 'Import complete'}
              {step === 'error' && 'Error'}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {/* PARSING */}
          {step === 'parsing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Reading file contents…</p>
            </div>
          )}

          {/* PDF NOTICE */}
          {step === 'pdf_notice' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4 text-amber-800">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">PDF detected — data import not available</p>
                  <p className="text-xs mt-1">PDFs cannot be automatically parsed. For KPI data import, please re-save the report as CSV or Excel (.xlsx).</p>
                  <p className="text-xs mt-1">You can still save this PDF as a reference document.</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Report Type</label>
                  <Select value={docType} onValueChange={setDocType}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Period</label>
                  <Select value={String(periodMonth)} onValueChange={v => setPeriodMonth(Number(v))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m} {periodYear}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handlePdfSave}>Save PDF for Reference</Button>
              </div>
            </div>
          )}

          {/* PERIOD + DOC TYPE */}
          {step === 'period' && (
            <div className="space-y-4">
              <p className="text-sm font-medium">What type of report is this, and what period does it cover?</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium">Report Type</label>
                  <Select value={docType} onValueChange={(v) => {
                    setDocType(v);
                    if (parsed) {
                      const autoMap = detectRebelPLLayout(parsed.headers) && v === 'GOP Report'
                        ? { ...REBEL_PL_MAPPING }
                        : autoDetectMapping(parsed.headers, v);
                      setMapping(autoMap);
                    }
                  }}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium">Period</label>
                  <Select value={String(periodMonth)} onValueChange={v => setPeriodMonth(Number(v))}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m} {periodYear}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {parsed && (
                <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{parsed.rows.length} data rows</span> detected with <span className="font-medium text-foreground">{parsed.headers.length} columns</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                {docType !== 'Other' ? (
                  <Button onClick={goToMapping}>Next: Map Columns <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
                ) : (
                  <Button onClick={async () => {
                    setStep('importing');
                    const user = await base44.auth.me();
                    const { file_url } = await base44.integrations.Core.UploadFile({ file });
                    await base44.entities.Document.create({
                      filename: file.name, file_url,
                      file_type: ext === 'csv' ? 'CSV' : 'Excel',
                      doc_type: 'Other', scope: 'company-wide',
                      period_month: periodMonth, period_year: periodYear,
                      uploaded_by: user?.full_name || user?.email || 'Unknown',
                    });
                    queryClient.invalidateQueries({ queryKey: ['documents'] });
                    setStep('done'); setImportResult({ ok: 0, fail: 0, otherOnly: true });
                  }}>Save File</Button>
                )}
              </div>
            </div>
          )}

          {/* COLUMN MAPPING */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <ColumnMapper headers={parsed.headers} mapping={mapping} setMapping={setMapping} docType={docType} />
              {/* Preview first 3 rows */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Preview (first 3 data rows)</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-muted/50">
                        {parsed.headers.map((h, i) => (
                          <th key={i} className="py-1.5 px-2 text-left font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {parsed.headers.map((_, j) => (
                            <td key={j} className="py-1.5 px-2 whitespace-nowrap">{String(row[j] ?? '')}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep('period')}><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back</Button>
                <Button onClick={goToMatching}>Next: Match Hotels <ArrowRight className="w-3.5 h-3.5 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* HOTEL MATCHING */}
          {step === 'matching' && (
            <div className="space-y-4">
              <HotelMatchTable rows={mappedRows} matches={matches} setMatches={setMatches} properties={properties} />
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => setStep('mapping')}><ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back</Button>
                <Button
                  onClick={handleImport}
                  disabled={mappedRows.filter((_, i) => matches[i]).length === 0}
                >
                  Import {mappedRows.filter((_, i) => matches[i]).length} Records
                </Button>
              </div>
            </div>
          )}

          {/* IMPORTING */}
          {step === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Writing scorecard records…</p>
            </div>
          )}

          {/* DONE */}
          {step === 'done' && importResult && (
            <div className="space-y-4">
              {importResult.pdfOnly ? (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-sm">PDF saved successfully</p>
                    <p className="text-xs mt-1">The file is stored for reference. Re-save as Excel or CSV to import KPI data.</p>
                  </div>
                </div>
              ) : importResult.otherOnly ? (
                <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl p-4 text-blue-800">
                  <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-semibold">File saved successfully.</p>
                </div>
              ) : (
                <div className={`flex items-start gap-3 rounded-xl p-4 ${importResult.ok > 0 ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
                  {importResult.ok > 0 ? <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" /> : <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />}
                  <div>
                    <p className="font-semibold text-sm">
                      {importResult.ok > 0 ? `✅ Imported ${importResult.ok} hotel record${importResult.ok > 1 ? 's' : ''} for ${MONTHS[periodMonth-1]} ${periodYear}` : 'No records imported'}
                    </p>
                    {importResult.fail > 0 && <p className="text-xs mt-1">{importResult.fail} rows skipped (unmatched or no data).</p>}
                  </div>
                </div>
              )}
              <div className="flex justify-end">
                <Button onClick={() => { onSuccess && onSuccess(importResult); onClose(); }}>Done</Button>
              </div>
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Failed to parse file</p>
                  <p className="text-xs mt-1">{error}</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button variant="outline" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}