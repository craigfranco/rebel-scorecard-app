import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useNavigate } from 'react-router-dom';
import { getLeadTypes } from '@/functions/getLeadTypes';
import { ArrowUp, ArrowDown, Minus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { calculateScorecard, MONTHS, getQuarterFromMonth, hasForecastData, normalizeGssTo100 } from '../lib/scoring';
import { aggregateEntries } from '../lib/aggregation';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { useUserProfile } from '@/lib/UserProfileContext';
import PropertyFilters from '@/components/filters/PropertyFilters';
import KpiBreakdownExport from '@/components/scorecard/KpiBreakdownExport';

const EMPTY_FILTERS = { brand: '', subBrand: '', city: '', state: '', leadRole: '', leadPerson: '' };

const KPI_TABS = [
  { key: 'gop', label: 'Budgeted GOP', max: 35 },
  { key: 'gopMargin', label: 'GOP Margin Improvement (vs LY)', max: 35 },
  { key: 'rgi', label: 'RevPAR Index (RGI)', max: 15 },
  { key: 'gss', label: 'GSS', max: 15 },
  { key: 'forecast', label: 'Forecast Kicker', max: null },
  { key: 'redzone', label: 'Red Zone Kicker', max: null },
];

// Using aggregateEntries from lib/scoring.js

function getRowColor(pass, score, max, kpi) {
  if (max === null) {
    if (kpi === 'redzone') return pass ? 'bg-green-50 hover:bg-green-100' : 'bg-slate-50 hover:bg-slate-100';
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

  const { filterPropertiesForUser } = useUserProfile();

  const { data: rawProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  const properties = filterPropertiesForUser(rawProperties);

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear, selectedMonth, periodType],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear }),
  });

  const { data: rgiQuarterlyReports = [] } = useQuery({
    queryKey: ['rgi-quarterly', selectedYear],
    queryFn: () => base44.entities.RgiQuarterlyReport.filter({ year: selectedYear }),
  });

  const { data: bonusExceptions = [] } = useQuery({
    queryKey: ['bonus-exceptions', selectedYear],
    queryFn: () => base44.entities.BonusException.filter({ year: selectedYear }),
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
    
    return aggregateEntries(periodEntries, periodType, selectedMonth, selectedYear, rgiQuarterlyReports, bonusExceptions);
  };

  const kpiTab = KPI_TABS.find(k => k.key === activeKpi);

  const rows = useMemo(() => {
    return properties
      .filter(p => {
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
          const gopA = entry.budgeted_gop_actual;
          const gopB = entry.budgeted_gop_target;
          // Show % only when budget is positive; otherwise show beat/missed label
          actual = (gopA != null && gopB != null && gopB > 0)
            ? `${((gopA / gopB) * 100).toFixed(1)}%`
            : (gopA != null && gopB != null)
              ? (gopA > gopB ? 'Beat' : 'Missed')
              : '—';
          target = gopB != null ? `$${Math.round(gopB).toLocaleString('en-US')}` : '—';
          entry._gop_actual_dollars = gopA;
          entry._gop_variance = (gopA != null && gopB != null) ? gopA - gopB : null;
        } else if (activeKpi === 'gopMargin') {
          kpiData = sc.gopMargin;
          score = sc.gopMargin.score;
          pass = sc.gopMargin.pass;
          actual = entry.gop_margin_actual != null ? `${entry.gop_margin_actual.toFixed(1)}%` : '—';
          entry._margin_yoy = entry.gop_margin_improvement != null
            ? entry.gop_margin_improvement
            : null;
          entry._ly_margin = entry.gop_margin_prior != null ? `${entry.gop_margin_prior.toFixed(1)}%` : null;
        } else if (activeKpi === 'rgi') {
          kpiData = sc.rgi;
          score = sc.rgi.score;
          pass = sc.rgi.pass;
          // Derive PY index: TY / (1 + change/100). Falls back to stored value if available.
          const rgiTy = entry.revpar_index;
          const rgiChg = entry.revpar_index_change;
          const rgiTarget = (rgiTy != null && rgiChg != null) ? (rgiTy / (1 + rgiChg / 100)) * 1.001 : null;
          actual = rgiTy != null ? rgiTy.toFixed(1) : '—';
          target = rgiTarget != null ? rgiTarget.toFixed(1) : '—';
          entry._rgi_change = rgiChg;
          entry._rgi_target = rgiTarget;
          entry._rgi_vs_target = (rgiTy != null && rgiTarget != null) ? rgiTy - rgiTarget : null;
        } else if (activeKpi === 'gss') {
          kpiData = sc.gss;
          score = sc.gss.score;
          pass = sc.gss.pass;
          const gssNorm = normalizeGssTo100(entry.gss_actual, p.parent_brand);
          const gssPriorNorm = normalizeGssTo100(entry.gss_prior, p.parent_brand);
          actual = gssNorm != null ? gssNorm.toFixed(1) : '—';
          target = gssPriorNorm != null ? gssPriorNorm.toFixed(1) : '—';
          entry._gss_variance = (gssNorm != null && gssPriorNorm != null) ? gssNorm - gssPriorNorm : null;
        } else if (activeKpi === 'forecast') {
          pass = hasForecastData(entry) ? (entry.forecast_kicker || false) : false;
          score = pass ? 1 : 0;
          actual = entry.forecast_actual_revenue != null ? `$${Math.round(entry.forecast_actual_revenue).toLocaleString('en-US')}` : '—';
          target = entry.forecast_primary_forecast != null ? `$${Math.round(entry.forecast_primary_forecast).toLocaleString('en-US')}` : '—';
          entry._forecast_variance = (entry.forecast_actual_revenue != null && entry.forecast_primary_forecast != null)
            ? entry.forecast_actual_revenue - entry.forecast_primary_forecast : null;

        } else if (activeKpi === 'redzone') {
          if (p.parent_brand === 'Independent') {
            pass = null;
            score = null;
            actual = 'N/A';
            target = 'N/A';
          } else {
            pass = entry.red_zone_kicker || false;
            score = pass ? 1 : 0;
            actual = pass ? 'HIT' : 'MISS';
            target = 'Exit & stay out';
          }
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
    if (sortCol !== col) return <ChevronsUpDown className="w-3 h-3 opacity-30 group-hover:opacity-60 transition-opacity" />;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3 text-primary" /> : <ChevronDown className="w-3 h-3 text-primary" />;
  };

  const SortTh = ({ col, children, className = '' }) => (
    <th
      className={`py-3 px-4 font-semibold cursor-pointer select-none group hover:bg-muted/70 transition-colors ${className}`}
      onClick={() => handleSort(col)}
    >
      <div className={`flex items-center gap-1 ${className.includes('text-center') ? 'justify-center' : ''}`}>
        {children}
        <SortIcon col={col} />
      </div>
    </th>
  );

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
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
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm flex items-center gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
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
        <KpiBreakdownExport rows={sortedRows} activeKpi={activeKpi} kpiTab={kpiTab} periodLabel={periodLabel} />
      </div>

      {/* Filters — above table */}
      <PropertyFilters
        properties={properties}
        filters={filters}
        onChange={setFilters}
      />

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold w-10">Rank</th>
                <SortTh col="name" className="text-left">Hotel</SortTh>
                <SortTh col="gm" className="text-center">GM</SortTh>
                <th className="py-3 px-4 text-center font-semibold">
                  {activeKpi === 'rgi' ? 'TY Index' : activeKpi === 'gopMargin' ? 'TY Margin' : activeKpi === 'gop' ? 'Achievement' : 'Actual'}
                </th>
                {activeKpi === 'rgi' && (
                  <th className="py-3 px-4 text-center font-semibold">Target</th>
                )}
                {activeKpi === 'rgi' && (
                  <th className="py-3 px-4 text-center font-semibold">Change %</th>
                )}
                {activeKpi === 'gop' && (
                  <th className="py-3 px-4 text-center font-semibold">Actual $</th>
                )}
                {activeKpi === 'gop' && (
                  <th className="py-3 px-4 text-center font-semibold">Budget $</th>
                )}
                {activeKpi === 'gop' && (
                  <th className="py-3 px-4 text-center font-semibold">$ vs Budget</th>
                )}
                {activeKpi === 'gopMargin' && (
                  <th className="py-3 px-4 text-center font-semibold">Prior Year %</th>
                )}
                {activeKpi === 'gopMargin' && (
                  <th className="py-3 px-4 text-center font-semibold">Improvement (pts vs LY)</th>
                )}
                {activeKpi === 'forecast' && (
                  <th className="py-3 px-4 text-center font-semibold">Forecast</th>
                )}
                {activeKpi === 'forecast' && (
                  <th className="py-3 px-4 text-center font-semibold">Variance ($)</th>
                )}

                {activeKpi === 'gss' && (
                  <th className="py-3 px-4 text-center font-semibold">Target (PY)</th>
                )}
                {activeKpi === 'gss' && (
                  <th className="py-3 px-4 text-center font-semibold">Variance</th>
                )}
                {activeKpi !== 'rgi' && activeKpi !== 'gopMargin' && activeKpi !== 'gop' && activeKpi !== 'forecast' && activeKpi !== 'gss' && (
                  <th className="py-3 px-4 text-center font-semibold">Target</th>
                )}


                <SortTh col="score" className="text-center">Score</SortTh>
                <SortTh col="pass" className="text-center">Status</SortTh>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map(({ property, entry, score, pass, actual, target }, idx) => {
                const rowBg = entry ? getRowColor(pass, score, kpiTab.max, activeKpi) : '';
                return (
                  <tr
                    key={property.id}
                    className={`border-b border-border cursor-pointer transition-colors ${rowBg}`}
                    onClick={() => navigate(`/hotel-scorecard?propertyId=${property.id}`)}
                  >
                    <td className="py-3 px-4">
                      <span className="text-xs font-bold text-muted-foreground w-7 h-7 rounded-full bg-white/70 border border-border flex items-center justify-center">
                        {idx + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-foreground text-sm">{property.name}</div>
                      <div className="text-xs text-muted-foreground">{property.city}, {property.state}</div>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">{property.gm_name || '—'}</td>
                    <td className="py-3 px-4 text-center font-bold text-sm">
                      {entry ? (
                        activeKpi === 'gop' && actual !== '—' ? (
                          <span style={{ color: pass ? '#4CAF50' : '#ef4444' }}>{actual}</span>
                        ) : actual
                      ) : '—'}
                    </td>

                    {activeKpi === 'rgi' && (
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {entry && entry._rgi_target != null ? entry._rgi_target.toFixed(1) : '—'}
                      </td>
                    )}
                    {activeKpi === 'rgi' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && entry._rgi_change != null ? (
                          <span style={{ color: entry._rgi_change >= 0.1 ? '#4CAF50' : '#ef4444' }}>
                            {entry._rgi_change >= 0 ? '+' : ''}{entry._rgi_change.toFixed(1)}%
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {activeKpi === 'gop' && (
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {entry && entry._gop_actual_dollars != null ? `$${Math.round(entry._gop_actual_dollars).toLocaleString('en-US')}` : '—'}
                      </td>
                    )}
                    {activeKpi === 'gop' && (
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {entry && entry.budgeted_gop_target != null ? `$${Math.round(entry.budgeted_gop_target).toLocaleString('en-US')}` : '—'}
                      </td>
                    )}
                    {activeKpi === 'gop' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && entry._gop_variance != null ? (
                          <span style={{ color: entry._gop_variance >= 0 ? '#4CAF50' : '#ef4444' }}>
                            {entry._gop_variance >= 0 ? '+' : '-'}${Math.abs(Math.round(entry._gop_variance)).toLocaleString('en-US')}
                          </span>
                        ) : '—'}
                      </td>
                    )}
                    {activeKpi === 'gopMargin' && (
                      <td className="py-3 px-4 text-center text-sm font-medium">
                        {entry && entry._ly_margin != null ? entry._ly_margin : '—'}
                      </td>
                    )}
                    {activeKpi === 'gopMargin' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && entry._margin_yoy != null ? (
                          <span style={{ color: entry._margin_yoy >= 0 ? '#4CAF50' : '#ef4444' }}>
                            {entry._margin_yoy >= 0 ? '+' : ''}{entry._margin_yoy.toFixed(1)} pts
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
                        {entry && entry._forecast_variance != null ? (
                          <span style={{ color: entry._forecast_variance >= 0 ? '#4CAF50' : '#ef4444' }}>
                            {entry._forecast_variance >= 0 ? '+' : '-'}${Math.abs(entry._forecast_variance).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </span>
                        ) : '—'}
                      </td>
                    )}

                    {activeKpi === 'gss' && (
                      <td className="py-3 px-4 text-center text-sm text-muted-foreground">
                        {entry ? target : '—'}
                      </td>
                    )}
                    {activeKpi === 'gss' && (
                      <td className="py-3 px-4 text-center text-sm font-bold">
                        {entry && entry._gss_variance != null ? (
                          <span style={{ color: entry._gss_variance >= 0 ? '#4CAF50' : '#ef4444' }}>
                            {entry._gss_variance >= 0 ? '+' : ''}{entry._gss_variance.toFixed(1)} pts
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
                        (() => {
                          const isRzNa = activeKpi === 'redzone' && property.parent_brand === 'Independent';
                          const isRzOut = activeKpi === 'redzone' && !pass && !isRzNa;
                          const label = isRzNa
                            ? 'N/A'
                            : activeKpi === 'forecast'
                              ? (pass ? 'HIT' : !hasForecastData(entry) ? '✗ No Data' : '✗ MISS')
                              : activeKpi === 'redzone'
                                ? (pass ? 'HIT' : 'OUT')
                                : (pass ? 'PASS' : 'FAIL');
                          return (
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                              style={isRzNa || isRzOut
                                ? { backgroundColor: '#f1f5f9', color: '#94a3b8' }
                                : { backgroundColor: pass ? '#4CAF50' : '#ef4444', color: '#ffffff' }}
                            >
                              {label}
                            </span>
                          );
                        })()
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