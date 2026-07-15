import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, XCircle, FileWarning } from 'lucide-react';
import { MONTHS } from '@/lib/scoring';

const CURRENT_YEAR = 2026;

// A month is "expected" (due) after the 15th of the following month.
// e.g. June data is expected by July 15th.
function getExpectedMonths(now = new Date()) {
  const expected = [];
  for (let m = 1; m <= 12; m++) {
    let dueYear = CURRENT_YEAR;
    let dueMonth = m + 1;
    if (dueMonth > 12) { dueMonth = 1; dueYear = CURRENT_YEAR + 1; }
    const dueDate = new Date(dueYear, dueMonth - 1, 15);
    if (now >= dueDate) expected.push(m);
  }
  return expected;
}

const KPI_TYPES = [
  { key: 'gop',      label: 'GOP',      docType: 'GOP Report',          color: 'emerald', fields: ['budgeted_gop_actual', 'budgeted_gop_target'] },
  { key: 'rgi',      label: 'RGI/STR',  docType: 'RGI/STR Report',      color: 'blue',    fields: ['revpar_index_change', 'revpar_index'] },
  { key: 'gss',      label: 'GSS',      docType: 'GSS Report',          color: 'purple',  fields: ['gss_actual', 'gss_prior'] },
  { key: 'forecast', label: 'Forecast', docType: 'Forecast Accuracy',   color: 'amber',   fields: ['forecast_result', 'forecast_kicker'] },
];

function hasKpiData(entry, kpiKey) {
  if (!entry) return false;
  const kpi = KPI_TYPES.find(k => k.key === kpiKey);
  return kpi.fields.some(f => entry[f] != null && entry[f] !== '' && entry[f] !== 0);
}

export default function DataHealthPanel() {
  const [expandedProp, setExpandedProp] = useState(null);

  const { data: properties = [], isLoading: loadingProps } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 200),
  });

  const { data: entries = [], isLoading: loadingEntries } = useQuery({
    queryKey: ['score-entries-health', CURRENT_YEAR],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: CURRENT_YEAR }, undefined, 500),
  });

  const { data: documents = [] } = useQuery({
    queryKey: ['documents-health', CURRENT_YEAR],
    queryFn: () => base44.entities.Document.list('-created_date', 500),
  });

  const expectedMonths = getExpectedMonths();

  const propertyHealth = useMemo(() => {
    return properties.map(prop => {
      const propEntries = entries.filter(e => e.property_id === prop.id);
      const kpiStatus = {};
      for (const kpi of KPI_TYPES) {
        const monthsWithData = expectedMonths.filter(m => {
          const entry = propEntries.find(e => e.month === m);
          return hasKpiData(entry, kpi.key);
        });
        const monthsMissing = expectedMonths.filter(m => !monthsWithData.includes(m));
        kpiStatus[kpi.key] = {
          covered: monthsWithData.length,
          missing: monthsMissing,
          total: expectedMonths.length,
        };
      }
      // uploaded docs for this property this year
      const propDocs = documents.filter(d =>
        d.property_id === prop.id &&
        d.period_year === CURRENT_YEAR
      );
      return { property: prop, kpiStatus, propDocs };
    });
  }, [properties, entries, documents, expectedMonths]);

  // Portfolio-level summary
  const summary = useMemo(() => {
    const totalCells = propertyHealth.length * KPI_TYPES.length * expectedMonths.length;
    if (totalCells === 0) return { total: 0, filled: 0, pct: 0 };
    let filled = 0;
    for (const ph of propertyHealth) {
      for (const kpi of KPI_TYPES) {
        filled += ph.kpiStatus[kpi.key].covered;
      }
    }
    return { total: totalCells, filled, pct: Math.round((filled / totalCells) * 100) };
  }, [propertyHealth]);

  const sortedHealth = [...propertyHealth].sort((a, b) => {
    const aMissing = KPI_TYPES.reduce((s, k) => s + a.kpiStatus[k.key].missing.length, 0);
    const bMissing = KPI_TYPES.reduce((s, k) => s + b.kpiStatus[k.key].missing.length, 0);
    return bMissing - aMissing; // most missing first
  });

  if (loadingProps || loadingEntries) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
          Checking data health...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border flex items-center gap-2" style={{ background: '#2d4b5e' }}>
        <FileWarning className="w-5 h-5 text-white" />
        <h2 className="font-bold text-lg text-white">Data Health</h2>
        <span className="text-white/60 text-xs ml-1">Jan–{expectedMonths.length ? MONTHS[expectedMonths[expectedMonths.length - 1] - 1] : '—'} {CURRENT_YEAR}</span>
      </div>

      {/* Summary bar */}
      <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-2xl font-bold text-foreground">{summary.pct}%</div>
          <div className="text-xs text-muted-foreground">Portfolio Complete</div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <div className="text-2xl font-bold text-foreground">{summary.filled}<span className="text-muted-foreground text-base">/{summary.total}</span></div>
          <div className="text-xs text-muted-foreground">KPI Data Points Filled</div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <div className="text-2xl font-bold text-foreground">{properties.length}</div>
          <div className="text-xs text-muted-foreground">Active Properties</div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${summary.pct}%`, backgroundColor: '#2d4b5e' }} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              <th className="py-3 px-4 text-left font-semibold">Property</th>
              {KPI_TYPES.map(kpi => (
                <th key={kpi.key} className="py-3 px-4 text-center font-semibold">{kpi.label}</th>
              ))}
              <th className="py-3 px-4 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedHealth.map(({ property, kpiStatus, propDocs }) => {
              const isExpanded = expandedProp === property.id;
              const totalMissing = KPI_TYPES.reduce((s, k) => s + kpiStatus[k.key].missing.length, 0);
              const isComplete = totalMissing === 0;

              return (
                <React.Fragment key={property.id}>
                  <tr
                    className={`border-b border-border cursor-pointer hover:bg-muted/20 ${isExpanded ? 'bg-slate-50' : ''}`}
                    onClick={() => setExpandedProp(isExpanded ? null : property.id)}
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {isExpanded
                          ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                        }
                        <div>
                          <div className="font-medium text-sm">{property.name}</div>
                          <div className="text-xs text-muted-foreground">{property.city}, {property.state}</div>
                        </div>
                      </div>
                    </td>
                    {KPI_TYPES.map(kpi => {
                      const st = kpiStatus[kpi.key];
                      const pct = st.total > 0 ? Math.round((st.covered / st.total) * 100) : 0;
                      const isMissing = st.covered === 0;
                      const isPartial = st.covered > 0 && st.covered < st.total;
                      return (
                        <td key={kpi.key} className="py-3 px-4 text-center">
                          <div className="inline-flex flex-col items-center gap-1">
                            <span className={`text-sm font-bold ${
                              isMissing ? 'text-red-600' : isPartial ? 'text-amber-600' : 'text-green-600'
                            }`}>
                              {st.covered}/{st.total}
                            </span>
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  isMissing ? 'bg-red-500' : isPartial ? 'bg-amber-500' : 'bg-green-500'
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 text-center">
                      {isComplete ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 px-2 py-1 rounded-full">
                          <AlertTriangle className="w-3.5 h-3.5" /> {totalMissing} missing
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail: per-month breakdown */}
                  {isExpanded && (
                    <tr className="bg-slate-50">
                      <td colSpan={6} className="p-4">
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground border-b border-border">
                                <th className="py-2 px-3 text-left font-semibold">Month</th>
                                {KPI_TYPES.map(kpi => (
                                  <th key={kpi.key} className="py-2 px-3 text-center font-semibold">{kpi.label}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {expectedMonths.map(m => {
                                const entry = entries.find(e => e.property_id === property.id && e.month === m);
                                return (
                                  <tr key={m} className="border-b border-border/50">
                                    <td className="py-2 px-3 font-medium text-foreground whitespace-nowrap">
                                      {MONTHS[m - 1]}
                                    </td>
                                    {KPI_TYPES.map(kpi => {
                                      const has = hasKpiData(entry, kpi.key);
                                      const doc = propDocs.find(d => d.doc_type === kpi.docType && d.period_month === m);
                                      return (
                                        <td key={kpi.key} className="py-2 px-3 text-center">
                                          <div className="inline-flex items-center gap-1">
                                            {has ? (
                                              <span className="inline-flex items-center gap-1 text-green-600 font-semibold">
                                                <CheckCircle2 className="w-3.5 h-3.5" /> Data
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center gap-1 text-red-500 font-semibold">
                                                <XCircle className="w-3.5 h-3.5" /> Missing
                                              </span>
                                            )}
                                            {doc && (
                                              <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                                📎 file
                                              </span>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-3">
                          💡 "Data" = KPI values exist in the scorecard for this month. "📎 file" = an uploaded document of this type was found for this property/month. Missing data means the report hasn't been imported yet.
                        </p>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
            {sortedHealth.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-muted-foreground text-sm">
                  No active properties found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}