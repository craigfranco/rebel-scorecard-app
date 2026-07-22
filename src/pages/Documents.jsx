import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { FileText, Download, Trash2, Building2, Globe, Loader2, Eraser, Trash, Search, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MONTHS, getQuarterFromMonth } from '../lib/scoring';
import UploadZone from '@/components/documents/UploadZone';
import ImportWizard from '@/components/documents/ImportWizard';
import DataHealthPanel from '@/components/documents/DataHealthPanel';
import DashboardSyncButton from '@/components/documents/DashboardSyncButton';

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 1;

const KPI_TAG_STYLES = {
  'GOP Report':     { label: 'GOP',     bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'RGI/STR Report': { label: 'RGI/STR', bg: 'bg-blue-50',    text: 'text-blue-700' },
  'GSS Report':     { label: 'GSS',     bg: 'bg-purple-50',  text: 'text-purple-700' },
  'Forecast Accuracy': { label: 'Forecast', bg: 'bg-amber-50', text: 'text-amber-700' },
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

const DOC_TYPE_FIELDS = {
  'GOP Report': ['budgeted_gop_actual', 'budgeted_gop_target', 'gop_margin_actual', 'gop_margin_budget', 'gop_margin_variance', 'gop_margin_prior'],
  'RGI/STR Report': ['revpar_index_change'],
  'GSS Report': ['gss_actual', 'gss_prior'],
  'Forecast Accuracy': ['forecast_kicker'],
};

export default function Documents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [pendingFile, setPendingFile] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [clearMonth, setClearMonth] = useState(CURRENT_MONTH);
  const [clearYear] = useState(CURRENT_YEAR);
  const [clearDocType, setClearDocType] = useState('all');
  const [clearing, setClearing] = useState(false);

  // File list filters
  const [filterType, setFilterType] = useState('all');
  const [filterScope, setFilterScope] = useState('all'); // all | company-wide | hotel-specific
  const [filterProperty, setFilterProperty] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');
  const [filterSearch, setFilterSearch] = useState('');

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
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

  const handleFile = (file) => {
    setParsing(true);
    // Small delay to show loading state before opening wizard
    setTimeout(() => {
      setParsing(false);
      setPendingFile(file);
    }, 100);
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
    queryClient.invalidateQueries({ queryKey: ['all-entries'] });
    setClearing(false);
    toast({ title: 'Cleared', description: `${label} data cleared for ${MONTHS[clearMonth - 1]} ${clearYear} (${entries.length} record${entries.length !== 1 ? 's' : ''}).` });
  };

  const propertyName = (id) => properties.find(p => p.id === id)?.name || '—';

  const availableYears = Array.from(new Set(documents.map(d => d.period_year).filter(Boolean))).sort((a, b) => b - a);

  const filteredDocs = documents.filter(doc => {
    if (filterType !== 'all' && doc.doc_type !== filterType) return false;
    if (filterScope !== 'all' && doc.scope !== filterScope) return false;
    if (filterProperty !== 'all' && doc.property_id !== filterProperty) return false;
    if (filterMonth !== 'all' && String(doc.period_month) !== filterMonth) return false;
    if (filterYear !== 'all' && String(doc.period_year) !== filterYear) return false;
    if (filterSearch && !(doc.filename || '').toLowerCase().includes(filterSearch.toLowerCase())) return false;
    return true;
  });

  const hasActiveFilters =
    filterType !== 'all' || filterScope !== 'all' || filterProperty !== 'all' ||
    filterMonth !== 'all' || filterYear !== 'all' || filterSearch !== '';

  const clearFilters = () => {
    setFilterType('all');
    setFilterScope('all');
    setFilterProperty('all');
    setFilterMonth('all');
    setFilterYear('all');
    setFilterSearch('');
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg flex flex-wrap items-center justify-between gap-3" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div>
          <h1 className="text-2xl font-bold">Documents</h1>
          <p className="text-white/70 text-sm mt-1">Upload Excel or CSV files — data is parsed client-side and imported directly into scorecards</p>
        </div>
        <DashboardSyncButton />
      </div>

      {/* Data Health */}
      <DataHealthPanel />

      {/* Upload Zone */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-4">
        <h2 className="font-bold text-foreground">Upload a Report</h2>
        <p className="text-sm text-muted-foreground">
          Upload a GOP, RGI/STR, GSS, or Forecast Accuracy report. The app will read the file, let you map columns, match hotels, and confirm before writing any data.
        </p>
        <UploadZone
          onFile={handleFile}
          loading={parsing}
          label="Drop Excel or CSV file here, or click to browse"
          subLabel="Supports .xlsx, .xls, .csv — PDFs can be stored for reference only"
        />
      </div>

      {/* Clear KPI Data */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 flex-1">
            <Eraser className="w-4 h-4 text-destructive shrink-0" />
            <div>
              <h2 className="font-bold text-foreground text-sm">Clear KPI Data</h2>
              <p className="text-xs text-muted-foreground">Delete scorecard entries for a specific period</p>
            </div>
          </div>
          <Select value={clearDocType} onValueChange={setClearDocType}>
            <SelectTrigger className="w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All KPI Types</SelectItem>
              <SelectItem value="GOP Report">GOP</SelectItem>
              <SelectItem value="RGI/STR Report">RGI/STR</SelectItem>
              <SelectItem value="GSS Report">GSS</SelectItem>
              <SelectItem value="Forecast Accuracy">Forecast Accuracy</SelectItem>
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
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash className="w-3.5 h-3.5" />}
            Clear Data
          </Button>
        </div>
      </div>

      {/* File List */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Filters */}
        <div className="px-6 py-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="font-bold text-foreground">Uploaded Files ({filteredDocs.length}{hasActiveFilters ? ` of ${documents.length}` : ''})</h2>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 gap-1.5 text-xs text-muted-foreground">
                <X className="w-3 h-3" /> Clear filters
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                value={filterSearch}
                onChange={e => setFilterSearch(e.target.value)}
                placeholder="Search filename..."
                className="w-full h-9 pl-8 pr-3 text-sm rounded-md border border-input bg-transparent focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-36 text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="GOP Report">GOP</SelectItem>
                <SelectItem value="RGI/STR Report">RGI/STR</SelectItem>
                <SelectItem value="GSS Report">GSS</SelectItem>
                <SelectItem value="Forecast Accuracy">Forecast</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterScope} onValueChange={setFilterScope}>
              <SelectTrigger className="w-36 text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scopes</SelectItem>
                <SelectItem value="company-wide">Shared</SelectItem>
                <SelectItem value="hotel-specific">Hotel-specific</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterProperty} onValueChange={setFilterProperty} disabled={filterScope === 'company-wide'}>
              <SelectTrigger className="w-44 text-sm h-9 disabled:opacity-50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Hotels</SelectItem>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-32 text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-28 text-sm h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
                    {documents.length === 0
                      ? 'No files uploaded yet. Use the upload area above.'
                      : 'No files match the current filters.'}
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
                      <div className="ml-6 mt-0.5">
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

      {/* Import Wizard Modal */}
      {pendingFile && (
        <ImportWizard
          file={pendingFile}
          properties={properties}
          onClose={() => setPendingFile(null)}
          onSuccess={(result) => {
            if (result.ok > 0) {
              toast({ title: '✅ Import complete!', description: `${result.ok} hotel records updated for ${result.periodLabel || `${MONTHS[CURRENT_MONTH - 1]} ${CURRENT_YEAR}`}.` });
            }
          }}
        />
      )}
    </div>
  );
}