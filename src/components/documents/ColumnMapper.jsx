import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const KPI_FIELDS = {
  'GOP Report': [
    { key: 'hotel_name',          label: 'Hotel / Property Name', required: true },
    { key: 'budgeted_gop_actual', label: 'Actual GOP ($)', required: true },
    { key: 'budgeted_gop_target', label: 'Budget GOP ($)' },
    { key: 'budgeted_gop_prior',  label: 'Prior Year GOP ($)' },
    { key: 'gop_margin_actual',   label: 'Actual % REV' },
    { key: 'gop_margin_budget',   label: 'Budget % REV' },
    { key: 'gop_margin_prior',    label: 'Last Year % REV' },
  ],
  'RGI/STR Report': [
    { key: 'str_id',              label: 'STR Property ID' },
    { key: 'hotel_name',          label: 'Hotel / Property Name', required: true },
    { key: 'revpar_index_change', label: 'RevPAR Index % Change (YOY)', required: true },
    { key: 'revpar_index',        label: 'RevPAR Index (current period)' },
    { key: 'revpar_index_prior',  label: 'RevPAR Index (prior year)' },
  ],
  'GSS Report': [
    { key: 'hotel_name',          label: 'Hotel / Property Name', required: true },
    { key: 'gss_actual',          label: 'GSS Score (Actual)', required: true },
    { key: 'gss_prior',           label: 'GSS Score (Prior Year)' },
  ],
  'Forecast Accuracy': [
    { key: 'hotel_name',                 label: 'Hotel / Property Name', required: true },
    { key: 'forecast_actual_revenue',    label: 'Actual Revenue ($)', required: true },
    { key: 'forecast_primary_forecast',  label: 'Primary Forecast Revenue ($)', required: true },
  ],
};

export default function ColumnMapper({ headers, mapping, setMapping, docType }) {
  const fields = KPI_FIELDS[docType] || KPI_FIELDS['GOP Report'];
  const NONE = '__none__';

  const update = (key, val) => setMapping(prev => ({ ...prev, [key]: val === NONE ? null : Number(val) }));

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        We detected <strong>{headers.length} columns</strong>. Map each KPI field to the matching column from your file.
      </p>
      <div className="grid gap-2">
        {fields.map(f => (
          <div key={f.key} className="flex items-center gap-3">
            <div className="w-48 shrink-0">
              <span className="text-xs font-medium text-foreground">{f.label}</span>
              {f.required && <span className="text-destructive ml-1 text-xs">*</span>}
            </div>
            <Select
              value={mapping[f.key] != null ? String(mapping[f.key]) : NONE}
              onValueChange={v => update(f.key, v)}
            >
              <SelectTrigger className="text-xs h-8 flex-1">
                <SelectValue placeholder="— not mapped —" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>— not mapped —</SelectItem>
                {headers.map((h, i) => (
                  <SelectItem key={i} value={String(i)}>{h} (col {i + 1})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}