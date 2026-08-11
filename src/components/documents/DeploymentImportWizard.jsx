import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, ArrowRight, Building2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { parseFile } from '@/lib/fileParser';
import { deploymentSync } from '@/functions/deploymentSync';

const DEPLOYMENT_FIELDS = [
  { field: 'str_id', label: 'STR ID' },
  { field: 'name', label: 'Hotel Name' },
  { field: 'city', label: 'City' },
  { field: 'state', label: 'State' },
  { field: 'rooms', label: 'Rooms' },
  { field: 'parent_brand', label: 'Parent Brand' },
  { field: 'sub_brand', label: 'Sub Brand' },
  { field: 'corporate_operations', label: 'Corporate Operations' },
  { field: 'corporate_finance', label: 'Corporate Finance' },
  { field: 'corporate_hr', label: 'Corporate HR' },
  { field: 'corporate_revenue', label: 'Corporate Revenue' },
  { field: 'corporate_sales', label: 'Corporate Sales' },
  { field: 'corporate_ecommerce', label: 'Corporate E-Commerce' },
  { field: 'property_gm', label: 'GM' },
  { field: 'property_dof', label: 'DOF' },
  { field: 'property_hrd', label: 'HRD' },
  { field: 'property_dorm', label: 'DORM' },
  { field: 'property_dosm', label: 'DOSM' },
  { field: 'property_doe', label: 'DOE' },
  { field: 'address', label: 'Physical Address' },
  { field: 'website', label: 'Website' },
];

const normHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9]/g, '');

// The deployment sheet uses a grouped two-row header (a "DEPLOYMENT / Corporate Lead /
// Property Lead" band sits above the real column names). parseFile may latch onto that
// band as the header row, so we re-detect the real header row by looking for the row
// that actually holds the STR ID + Hotel Name columns.
function findDeploymentHeaderRow(allRows) {
  for (let i = 0; i < Math.min(allRows.length, 8); i++) {
    const cells = allRows[i].map(normHeader);
    const hasStr = cells.some((c) => c === 'strid' || c.includes('strid') || c === 'str');
    const hasHotel = cells.some((c) => c.includes('hotelname') || c.includes('propertyname') || c.includes('hotel'));
    if (hasStr && hasHotel) return i;
  }
  return null;
}

const DEPLOYMENT_CANDIDATES = {
  str_id: ['strid', 'str', 'deploymentid'],
  name: ['hotelname', 'propertyname', 'hotel', 'property', 'name'],
  city: ['city'],
  state: ['state'],
  rooms: ['rooms', 'roomcount', 'keys'],
  parent_brand: ['parentbrand', 'parent', 'brand'],
  sub_brand: ['subbrand', 'sub'],
  corporate_operations: ['operations', 'operation'],
  corporate_finance: ['finance'],
  corporate_hr: ['humanresources', 'hr'],
  corporate_revenue: ['revenue'],
  corporate_sales: ['salesmktg', 'salesmarketing', 'sales'],
  corporate_ecommerce: ['ecommerce', 'ecomm'],
  property_gm: ['gm', 'generalmanager'],
  property_dof: ['dof', 'directoroffinance'],
  property_hrd: ['hrd', 'directorofhr'],
  property_dorm: ['dorm', 'directorofrevenue'],
  property_dosm: ['dosm', 'directorofsales'],
  property_doe: ['doe', 'directorofengineering'],
  address: ['physicaladdress', 'address'],
  website: ['websiteaddress', 'website', 'url'],
};

// Two-pass matcher: exact normalized matches first (so "Human Resources"→corporate_hr
// and "HRD"→property_hrd don't collide), then substring matches for anything left,
// never reusing a column that already matched another field.
function autoMapDeployment(headers) {
  const h = headers.map(normHeader);
  const used = new Set();
  const result = {};

  Object.entries(DEPLOYMENT_CANDIDATES).forEach(([field, terms]) => {
    for (const t of terms) {
      const idx = h.findIndex((x, i) => x === t && !used.has(i));
      if (idx !== -1) { result[field] = idx; used.add(idx); return; }
    }
  });
  Object.entries(DEPLOYMENT_CANDIDATES).forEach(([field, terms]) => {
    if (result[field] != null) return;
    for (const t of terms) {
      const idx = h.findIndex((x, i) => x.includes(t) && !used.has(i));
      if (idx !== -1) { result[field] = idx; used.add(idx); return; }
    }
    result[field] = null;
  });
  return result;
}

const strVal = (v) => (v != null && String(v).trim() !== '' ? String(v).trim() : null);
const numVal = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
};

export default function DeploymentImportWizard({ file, onClose, onSuccess }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [step, setStep] = useState('parsing'); // parsing | mapping | importing | done | error
  const [error, setError] = useState(null);
  const [parsed, setParsed] = useState(null);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);

  useEffect(() => {
    parseFile(file)
      .then((res) => {
        // Re-detect the real column-header row (skips the grouped "DEPLOYMENT /
        // Corporate Lead / Property Lead" band that sits above it).
        const all = [res.headers, ...res.rows];
        const idx = findDeploymentHeaderRow(all);
        let headers, rows;
        if (idx != null) {
          headers = all[idx].map((hd, i) => (hd !== '' && hd != null ? String(hd).trim() : `col_${i}`));
          rows = all.slice(idx + 1);
        } else {
          headers = res.headers;
          rows = res.rows;
        }
        setParsed({ headers, rows });
        setMapping(autoMapDeployment(headers));
        setStep('mapping');
      })
      .catch((err) => {
        setError(err.message === 'unsupported_type' ? 'Unsupported file type. Use .xlsx, .xls, or .csv.' : err.message);
        setStep('error');
      });
  }, []);

  const buildProperties = () => {
    if (!parsed) return [];
    return parsed.rows
      .map((row) => {
        const get = (idx) => (idx != null && idx >= 0 && idx < row.length) ? row[idx] : null;
        const gm = strVal(get(mapping.property_gm));
        return {
          str_id: strVal(get(mapping.str_id)) ? String(get(mapping.str_id)) : null,
          name: strVal(get(mapping.name)),
          city: strVal(get(mapping.city)),
          state: strVal(get(mapping.state)),
          rooms: numVal(get(mapping.rooms)),
          parent_brand: strVal(get(mapping.parent_brand)),
          sub_brand: strVal(get(mapping.sub_brand)),
          corporate_operations: strVal(get(mapping.corporate_operations)),
          corporate_finance: strVal(get(mapping.corporate_finance)),
          corporate_hr: strVal(get(mapping.corporate_hr)),
          corporate_revenue: strVal(get(mapping.corporate_revenue)),
          corporate_sales: strVal(get(mapping.corporate_sales)),
          corporate_ecommerce: strVal(get(mapping.corporate_ecommerce)),
          property_gm: gm,
          gm_name: gm,
          property_dof: strVal(get(mapping.property_dof)),
          property_hrd: strVal(get(mapping.property_hrd)),
          property_dorm: strVal(get(mapping.property_dorm)),
          property_dosm: strVal(get(mapping.property_dosm)),
          property_doe: strVal(get(mapping.property_doe)),
          address: strVal(get(mapping.address)),
          website: strVal(get(mapping.website)),
        };
      })
      .filter((p) => p.name || p.str_id);
  };

  const handleImport = async () => {
    const properties = buildProperties();
    if (!properties.length) {
      toast({ title: 'No rows to import', description: 'No property rows detected in the file.', variant: 'destructive' });
      return;
    }
    setStep('importing');
    try {
      const res = await deploymentSync({ source: 'deployment_upload', properties });
      const data = res?.data || {};
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['score-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-entries'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      setResult({
        properties_upserted: data.properties_upserted ?? 0,
        properties_deactivated: data.properties_deactivated ?? 0,
        total: properties.length,
      });
      setStep('done');
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Import failed');
      setStep('error');
    }
  };

  const previewRows = parsed ? parsed.rows.slice(0, 3) : [];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
          <Building2 className="w-5 h-5 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {step === 'parsing' && 'Parsing deployment file…'}
              {step === 'mapping' && 'Review column mapping'}
              {step === 'importing' && 'Upserting properties & leadership…'}
              {step === 'done' && 'Deployment import complete'}
              {step === 'error' && 'Error'}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          {step === 'parsing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Reading deployment spreadsheet…</p>
            </div>
          )}

          {step === 'mapping' && parsed && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
                Detected <span className="font-semibold">{parsed.rows.length}</span> property rows. Confirm the column mapping below, then import. Properties not in this file will be deactivated.
              </div>
              <div className="overflow-x-auto rounded-lg border border-border max-h-[320px] overflow-y-auto">
                <table className="text-xs w-full">
                  <thead className="sticky top-0">
                    <tr className="bg-muted/50">
                      <th className="py-2 px-3 text-left font-medium text-muted-foreground">Deployment Field</th>
                      <th className="py-2 px-3 text-left font-medium text-muted-foreground">Spreadsheet Column</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DEPLOYMENT_FIELDS.map(({ field, label }) => (
                      <tr key={field} className="border-t border-border">
                        <td className="py-1.5 px-3 font-medium text-foreground">{label}</td>
                        <td className="py-1.5 px-3">
                          <select
                            value={mapping[field] == null ? '' : mapping[field]}
                            onChange={(e) => {
                              const v = e.target.value === '' ? null : Number(e.target.value);
                              setMapping({ ...mapping, [field]: v });
                            }}
                            className="h-7 text-xs px-2 rounded border border-input bg-white w-full"
                          >
                            <option value="">— skip —</option>
                            {parsed.headers.map((hd, i) => (
                              <option key={i} value={i}>{hd || `col_${i}`}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Preview (first 3 rows)</p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">STR ID</th>
                        <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Hotel Name</th>
                        <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">City</th>
                        <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">Brand</th>
                        <th className="py-1.5 px-2 text-left font-medium text-muted-foreground">GM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => {
                        const get = (idx) => (idx != null && idx >= 0 && idx < row.length) ? row[idx] : '';
                        return (
                          <tr key={i} className="border-t border-border">
                            <td className="py-1.5 px-2">{String(get(mapping.str_id) ?? '')}</td>
                            <td className="py-1.5 px-2 font-medium">{String(get(mapping.name) ?? '')}</td>
                            <td className="py-1.5 px-2">{String(get(mapping.city) ?? '')}</td>
                            <td className="py-1.5 px-2">{String(get(mapping.parent_brand) ?? '')}</td>
                            <td className="py-1.5 px-2">{String(get(mapping.property_gm) ?? '')}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleImport}>
                  Import {parsed.rows.filter((r) => strVal(r[mapping.name]) || strVal(r[mapping.str_id])).length} Properties
                  <ArrowRight className="w-3.5 h-3.5 ml-1" />
                </Button>
              </div>
            </>
          )}

          {step === 'importing' && (
            <div className="flex flex-col items-center gap-3 py-8">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Upserting properties and leadership assignments…</p>
            </div>
          )}

          {step === 'done' && result && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4 text-green-800">
                <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Deployment roster imported</p>
                  <p className="text-xs mt-1">
                    {result.properties_upserted} properties upserted · {result.properties_deactivated} deactivated · {result.total} rows in file.
                  </p>
                  <p className="text-xs mt-1 text-green-700">Lead-person filters will reflect the new assignments on next page load.</p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => { onSuccess && onSuccess(result); onClose(); }}>Done</Button>
              </div>
            </div>
          )}

          {step === 'error' && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-800">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Import failed</p>
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