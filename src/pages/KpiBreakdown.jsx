import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { getLeadTypes } from '@/functions/getLeadTypes';
import { ArrowUp, ArrowDown, Minus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { calculateScorecard, MONTHS, getQuarterFromMonth } from '../lib/scoring';
import { aggregateEntries } from '../lib/aggregation';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import PropertyFilters from '@/components/filters/PropertyFilters';

const EMPTY_FILTERS = { brand: '', subBrand: '', city: '', state: '', leadRole: '', leadPerson: '' };

const KPI_TABS = [
  { key: 'gop', label: 'Budgeted GOP', max: 35 },
  { key: 'gopMargin', label: 'GOP Margin', max: 35 },
  { key: 'rgi', label: 'RevPAR Index (RGI)', max: 15 },
  { key: 'gss', label: 'GSS', max: 15 },
  { key: 'forecast', label: 'Forecast Kicker', max: null },
  { key: 'redzone', label: 'Red Zone Kicker', max: null },
];

// Using aggregateEntries from lib/scoring.js

function getRowColor(pass, score, max) {
  if (max === null) {
    return pass ? 'bg-green-50 hover:bg-green-100' : 'bg-red-50 hover:bg-red-100';
  }
  if (pass) return 'bg-green-50 hover:bg-green-100';
  const pct = max > 0 ? score / max : 0;
  if (pct >= 0.6) return 'bg-yellow-50 hover:bg-yellow-100';
  return 'bg-red-50 hover:bg-red-100';
}

export default function KpiBreakdown() {
  const navigate = useNavigate();
  const { selectedMonth, selectedYear, periodType, getPeriodLabel, getPeriodMonths } = useTimePeriod();
  const [activeKpi, setActiveKpi] = useState('gop');
  const [sortCol, setSortCol] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [fieldToPersonStrIds, setFieldToPersonStrIds] = useState({});

  useEffect(() => {
    getLeadTypes({}).then(res => {
      if (res?.data?.fieldToPersonStrIds) setFieldToPersonStrIds(res.data.fieldToPersonStrIds);
    }).catch(() => {});
  }, []);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('name', 100),
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear }),
  });

  const getEntry = (propertyId) => {
    const propEntries = allEntries.filter(e => e.property_id === propertyId);
    if (!propEntries.length) return null;
    const periodMonths = getPeriodMonths();
    const periodEntries = propEntries.filter(e => 
      periodMonths.includes(e.month) && 
      e.year === selectedYear
    );
    
    if (periodType === 'month') {
      return periodEntries[0] || null;
    }
    
    return aggregateEntries(periodEntries, periodType, selectedMonth, selectedYear);
  };

  const kpiTab = KPI_TABS.find(k => k.key === activeKpi);

  const rows = useMemo(() => {
    return properties
      .filter(p => {
        // For red zone kicker, exclude Independent properties
        if (activeKpi === 'redzone' && p.parent_brand === 'Independent') return false;
        // Apply user filters
        if (filters.brand && p.parent_brand !== filters.brand) return false;
        if (filters.subBrand && p.sub_brand !== filters.subBrand) return false;
        if (filters.city && p.city !== filters.city) return false;
        if (filters.state && p.state !== filters.state) return false;
        if (filters.leadRole && filters.leadPerson) {
          const strIds = (fieldToPersonStrIds[filters.leadRole] || {})[filters.leadPerson] || [];
          if (!strIds.includes(p.str_id)) return false;
        } else if (filters.leadRole) {
          const personMap = fieldToPersonStrIds[filters.leadRole] || {};
          const allStrIds = new Set(Object.values(personMap).flat());
          if (!allStrIds.has(p.str_id)) return false;
        }
        return true;
      })
      .map(p => {
        const entry = getEntry(p.id);
        if (!entry) return { property: p, entry: null, kpiData: null, score: null, pass: null };
        const sc = calculateScorecard(entry, p);
        let kpiData = null;
        let score = null;
        let pass = null;
        let actual = '—';
        let target = '—';

        if (activeKpi === 'gop') {
          kpiData = sc.gop;
          score = sc.gop.score;
          pass = sc.gop.pass;
          actual = entry.budgeted_gop_actual != null ? `$${(entry.budgeted_gop_actual / 1000).toFixed(1)}K` : '—';
          target = entry.budgeted_gop_target != null ? `$${(entry.budgeted_gop_target / 1000).toFixed(1)}K` : '—';
          entry._gop_variance = (entry.budgeted_gop_actual != null && entry.budgeted_gop_target != null)
            ? entry.budgeted_gop_actual - entry.budgeted_gop_target
            : null;
        } else if (activeKpi === 'gopMargin') {
          kpiData = sc.gopMargin;
          score = sc.gopMargin.score;
          pass = sc.gopMargin.pass;
          actual = entry.gop_margin_actual != null ? `${entry.gop_margin_actual.toFixed(1)}%` : '—';
          target = entry.gop_margin_actual != null && entry.gop_margin_prior != null
            ? entry.gop_margin_actual - entry.gop_margin_prior
            : null;
          // store LY% for display in extra column
          entry._ly_margin = entry.gop_margin_prior;
        } else if (activeKpi === 'rgi') {
          kpiData = sc.rgi;
          score = sc.rgi.score;
          pass = sc.rgi.pass;
          actual = entry.revpar_index != null ? entry.revpar_index.toFixed(1) : '—';
          target = '≥ +0.1% YOY';
        } else if (activeKpi === 'gss') {
          kpiData = sc.gss;
          score = sc.gss.score;
          pass = sc.gss.pass;
          actual = entry.gss_actual != null ? `${Number(entry.gss_actual).toFixed(1)} /${sc.gssStd.scale}` : '—';
          target = `+${sc.gssStd.target} YOY`;
          entry._gss_prior = entry.gss_prior;
          entry._gss_scale = sc.gssStd.scale;
          entry._gss_growth = (entry.gss_actual != null && entry.gss_prior != null) ? entry.gss_actual - entry.gss_prior : null;
        } else if (activeKpi === 'forecast') {
          pass = entry.forecast_kicker || false;
          score = pass ? 1 : 0;
          actual = entry.forecast_actual_revenue != null ? `$${(entry.forecast_actual_revenue / 1000).toFixed(0)}K` : '—';
          target = entry.forecast_primary_forecast != null ? `$${(entry.forecast_primary_forecast / 1000).toFixed(0)}K` : '—';
        } else if (activeKpi === 'redzone') {
          pass = entry.red_zone_kicker || false;
          score = pass ? 1 : 0;
          actual = pass ? 'HIT' : 'MISS';
          target = 'Exit & stay out';
        }

        return { property: p, entry, score, pass, actual, target };
      });
  }, [properties, allEntries, activeKpi, periodType, selectedMonth, selectedYear, filters, fieldToPersonStrIds]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av, bv;
      if (sortCol === 'score') { av = a.score ?? -1; bv = b.score ?? -1; }
      else if (sortCol === 'name') { av = a.property.name; bv = b.property.name; }
      else if (sortCol === 'gm') { av = a.property.gm_name || ''; bv = b.property.gm_name || ''; }
      else if (sortCol === 'pass') { av = a.pass === true ? 1 : a.pass === false ? 0 : -1; bv = b.pass === true ? 1 : b.pass === false ? 0 : -1; }
      else { av = a.score ?? -1; bv = b.score ?? -1; }

      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  const passing = rows.filter(r => r.pass === true).length;
  const total = rows.filter(r => r.pass !== null).length;

  const periodLabel = getPeriodLabel();

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 opacity-40" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Filters — top of page */}
      <PropertyFilters
        properties={properties}
        filters={filters}
        onChange={setFilters}
      />

      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <h1 className="text-2xl font-bold">KPI Breakdown</h1>
        <p className="text-white/70 text-sm mt-1">Performance across all {properties.length} hotels for each individual KPI — {periodLabel}</p>
      </div>

      {/* KPI Tabs */}
      <Tabs value={activeKpi} onValueChange={setActiveKpi}>
        <TabsList className="bg-card border border-border shadow-sm flex-wrap h-auto gap-1 p-1">
          {KPI_TABS.map(k => (
            <TabsTrigger key={k.key} value={k.key} className="text-xs">{k.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Time period selector removed - using global selector from TimePeriodContext */}

      {/* Summary bar */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold">{passing} of {total} hotels passing <strong>{kpiTab.label}</strong></span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: total > 0 ? `${(passing / total) * 100}%` : '0%', backgroundColor: '#4CAF50' }}
            />
          </div>
        </div>
        <div className="text-2xl font-black" style={{ color: '#2d4b5e' }}>
          {total > 0 ? Math.round((passing / total) * 100) : 0}%
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold w-8">#</th>
                <th className="py-3 px-4 text-left font-semibold cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">Hotel <SortIcon col="name" /></div>
                </th>
                <th className="py-3 px-4 text-center font-semibold cursor-pointer" onClick={() => handleSort('gm')}>
                  <div className="flex items-center justify-center gap-1">GM <SortIcon col="gm" /></div>
                </th>
                <th className="py-3 px-4 text-center font-semibold">
                  {activeKpi === 'rgi' ? 'RevPAR Index' : activeKpi === 'gopMargin' ? 'Actual %' : 'Actual'}
                </th>
                {activeKpi === 'rgi' && (
                  <th className="py-3 px-4 text-center font-semibold">RGI % Change YOY</th>
                )}
                {activeKpi === 'gop' && (
                  <th className="py-3 px-4 text-center font-semibold">Budget</th>
                )}
                {activeKpi === 'gop' && (
                  <th className="py-3 px-4 text-center font-semibold">vs. Budget</th>
                )}
                {activeKpi === 'gopMargin' && (
                  <th className="py-3 px-4 text-center font-semibold">Last Year %</th>
                )}
                {activeKpi === 'gopMargin' && (
                  <th className="py-3 px-4 text-center font-semibold">LY Growth</th>
                )}
                {activeKpi === 'forecast' && (
                  <th className="py-3 px-4 text-center font-semibold">Forecast</th>
                )}
                {activeKpi === 'forecast' && (
                  <th className="py-3 px-4 text-center font-semibold">Variance</th>
                )}
                {activeKpi === 'gss' && (
                  <th className="py-3 px-4 text-center font-semibold">Last Year</th>
                )}
                {activeKpi === 'gss' && (
                  <th className="py-3 px-4 text-center font-semibold">Growth</th>
                )}
                {activeKpi !== 'rgi' && activeKpi !== 'gopMargin' && activeKpi !== 'gop' && activeKpi !== 'forecast' && activeKpi !== 'gss' && (
                  <th className="py-3 px-4 text-center font-semibold">Target</th>
                )}

                <th className="py-3 px-4 text-center font-semibold cursor-pointer" onClick={() => handleSort('score')}>
                  <div className="flex items-center justify-center gap-1">Score <SortIcon col="score" /></div>
                </th>
                <th className="py-3 px-4 text-center font-semibold cursor-pointer" onClick={() => handleSort('pass')}>
                  <div className="flex items-center justify-center gap-1">Status <SortIcon col="pass" /></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(({ property, entry, score, pass, actual, target }, idx) => {
                const rowBg = entry ? getRowColor(pass, score, kpiTab.max) : '';
                return (
                  <tr
                    key={property.id}
                    className={`border-b border-border cursor-pointer transition-colors ${rowBg}`}
                    onClick={() => navigate(`/hotel/${property.id}`)}
                  >
                    <td className="py-3 px-4 text-muted-foreground text-xs font-medium">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground text-sm">{property.name}</div>
                      <div className="text-xs text-muted-foreground">{property.city}, {property.state}</div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">{property.gm_name || '—'}</td>
                    <td className="py-3 px-4 text-center font-medium text-sm">
                      {entry ? actual : '—'}
                    </td>
                    {activeKpi === 'rgi' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && entry.revpar_index_change != null ? (
                          <span style={{ color: entry.revpar_index_change >= 0 ? '#4CAF50' : '#ef4444' }}>
                            {entry.revpar_index_change >= 0 ? '+' : ''}{entry.revpar_index_change.toFixed(2)}%
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {activeKpi === 'gop' && (
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {entry ? target : '—'}
                      </td>
                    )}
                    {activeKpi === 'gop' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && entry._gop_variance != null ? (
                          <span style={{ color: entry._gop_variance >= 0 ? '#4CAF50' : '#ef4444' }}>
                            {entry._gop_variance >= 0 ? '+' : ''}${(entry._gop_variance / 1000).toFixed(1)}K
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {activeKpi === 'gopMargin' && (
                      <td className="py-3 px-4 text-center text-sm font-medium">
                        {entry && entry._ly_margin != null ? `${entry._ly_margin.toFixed(1)}%` : '—'}
                      </td>
                    )}
                    {activeKpi === 'gopMargin' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && target !== null ? (
                          <span style={{ color: target >= 0 ? '#4CAF50' : '#ef4444' }}>
                            {target >= 0 ? '+' : ''}{target.toFixed(1)}pp
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {activeKpi === 'forecast' && (
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {entry ? target : '—'}
                      </td>
                    )}
                    {activeKpi === 'forecast' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && entry.forecast_actual_revenue != null && entry.forecast_primary_forecast != null ? (
                          <span style={{ color: entry.forecast_actual_revenue >= entry.forecast_primary_forecast ? '#4CAF50' : '#ef4444' }}>
                            {entry.forecast_actual_revenue >= entry.forecast_primary_forecast ? '+' : ''}{((entry.forecast_actual_revenue - entry.forecast_primary_forecast) / 1000).toFixed(0)}K
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {activeKpi === 'gss' && (
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {entry && entry._gss_prior != null ? `${Number(entry._gss_prior).toFixed(1)} /${entry._gss_scale}` : '—'}
                      </td>
                    )}
                    {activeKpi === 'gss' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && entry._gss_growth != null ? (
                          <span style={{ color: entry._gss_growth >= 0 ? '#4CAF50' : '#ef4444' }}>
                            {entry._gss_growth >= 0 ? '+' : ''}{entry._gss_growth.toFixed(1)}
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {activeKpi !== 'rgi' && activeKpi !== 'gopMargin' && activeKpi !== 'gop' && activeKpi !== 'forecast' && activeKpi !== 'gss' && (
                      <td className="py-3 px-4 text-center text-xs text-muted-foreground">
                        {entry ? target : '—'}
                      </td>
                    )}
                    <td className="py-3 px-4 text-center">
                      {entry && score !== null ? (
                        <span className="font-bold text-sm">
                          {kpiTab.max ? `${score.toFixed(1)} / ${kpiTab.max}` : (pass ? '✓' : '✗')}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {entry !== null ? (
                        <span
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                          style={{ backgroundColor: pass ? '#4CAF50' : '#ef4444' }}
                        >
                          {activeKpi === 'forecast' ? (pass ? 'HIT' : 'MISS') : (pass ? 'PASS' : 'FAIL')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                          NO DATA
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}