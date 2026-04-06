import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Upload, FileText, Download, Trash2, Building2, Globe, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { MONTHS } from '../lib/scoring';

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 3;

const DOC_TYPES = ['GOP Report', 'RGI/STR Report', 'GSS Report', 'Other'];
const FILE_TYPE_MAP = { pdf: 'PDF', xlsx: 'Excel', xls: 'Excel', csv: 'CSV' };

function getFileType(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  return FILE_TYPE_MAP[ext] || 'Other';
}

export default function Documents() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef();
  const [dragOver, setDragOver] = useState(false);
  const [scope, setScope] = useState('company-wide');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [docType, setDocType] = useState('GOP Report');
  const [periodMonth, setPeriodMonth] = useState(CURRENT_MONTH);
  const [periodYear] = useState(CURRENT_YEAR);
  const [uploading, setUploading] = useState(false);
  const [filterScope, setFilterScope] = useState('all');
  const [filterProperty, setFilterProperty] = useState('');

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

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
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
    toast({ title: 'Uploaded!', description: `${file.name} uploaded successfully.` });
    setUploading(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  const filteredDocs = documents.filter(d => {
    if (filterScope === 'company-wide') return d.scope === 'company-wide';
    if (filterScope === 'hotel-specific') return d.scope === 'hotel-specific';
    return true;
  }).filter(d => {
    if (filterProperty) return d.property_id === filterProperty;
    return true;
  });

  const propertyName = (id) => properties.find(p => p.id === id)?.name || '—';

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-white/70 text-sm mt-1">Upload and manage source files — financial reports, STR data, GSS scores</p>
      </div>

      {/* Upload Panel */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 space-y-5">
        <h2 className="font-bold text-foreground">Upload New File</h2>

        {/* Config row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={scope} onValueChange={setScope}>
            <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="company-wide">Company-Wide</SelectItem>
              <SelectItem value="hotel-specific">Hotel-Specific</SelectItem>
            </SelectContent>
          </Select>

          {scope === 'hotel-specific' && (
            <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="Select hotel..." /></SelectTrigger>
              <SelectContent>
                {properties.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

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

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/40'}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.csv"
            className="hidden"
            onChange={e => handleFileUpload(e.target.files)}
          />
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-muted-foreground" />
              <p className="font-medium text-sm">Drag & drop a file here, or click to browse</p>
              <p className="text-xs text-muted-foreground">PDF, Excel, or CSV accepted</p>
            </div>
          )}
        </div>
      </div>

      {/* File List */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Filters */}
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
                      <div className="text-xs text-muted-foreground ml-6">{doc.doc_type}</div>
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
                          <Globe className="w-3 h-3" /> Shared — All Properties
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
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(doc.id)}
                        >
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