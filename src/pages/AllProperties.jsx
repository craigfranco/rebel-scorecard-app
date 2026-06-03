import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, TrendingDown, Minus, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { calculateScorecard, aggregateEntries } from '../lib/scoring';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { getBrandColor, getStatusBadge, formatBrandLabel } from '@/lib/portfolioHelpers';
import PropertyFilters from '@/components/filters/PropertyFilters';
import { getLeadTypes } from '@/functions/getLeadTypes';
import PropertyScorecardDetail from '@/components/scorecard/PropertyScorecardDetail';



const EMPTY_FILTERS = { brand: '', subBrand: '', city: '', state: '', leadRole: '', leadPerson: '' };

export default function AllProperties() {
  const { selectedMonth, selectedYear, periodType, getPeriodLabel, getPeriodMonths } = useTimePeriod();
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState('score');
  const [sortDir, setSortDir] = useState('desc');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [fieldToPersonStrIds, setFieldToPersonStrIds] = useState({});
  const [drawerProperty, setDrawerProperty] = useState(null);

  React.useEffect(() => {
    getLeadTypes({}).then(res => {
      if (res?.data?.fieldToPersonStrIds) setFieldToPersonStrIds(res.data.fieldToPersonStrIds);
    }).catch(() => {});
  }, []);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear }),
  });

  const getEntryForProperty = (propertyId) => {
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
    
    // Use the proper aggregation from lib/aggregation.js for quarter, qtd, ytd
    return aggregateEntries(periodEntries, periodType, selectedMonth, selectedYear);
  };

  const rows = properties
    .filter(p => {
      if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
          !(p.city || '').toLowerCase().includes(search.toLowerCase()) &&
          !(p.parent_brand || '').toLowerCase().includes(search.toLowerCase())) return false;
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
      const entry = getEntryForProperty(p.id);
      const scorecard = entry ? calculateScorecard(entry, p) : null;
      return { property: p, entry, scorecard };
    })
    .sort((a, b) => {
      let av, bv;
      if (sortCol === 'score') { av = a.scorecard?.total.total ?? -1; bv = b.scorecard?.total.total ?? -1; }
      else if (sortCol === 'name') { av = a.property.name; bv = b.property.name; }
      else if (sortCol === 'brand') { av = a.property.parent_brand || ''; bv = b.property.parent_brand || ''; }
      else if (sortCol === 'gm') { av = a.property.gm_name || ''; bv = b.property.gm_name || ''; }
      else if (sortCol === 'status') { av = a.scorecard ? (a.scorecard.total.pass ? 1 : 0) : -1; bv = b.scorecard ? (b.scorecard.total.pass ? 1 : 0) : -1; }
      else { av = a.scorecard?.total.total ?? -1; bv = b.scorecard?.total.total ?? -1; }
      
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const passing = rows.filter(r => r.scorecard && !Object.values(r.scorecard).some(v => v?.incomplete) && r.scorecard.total.pass).length;
  const failing = rows.filter(r => r.scorecard && !Object.values(r.scorecard).some(v => v?.incomplete) && !r.scorecard.total.pass).length;
  const noData = rows.filter(r => !r.scorecard).length;

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
      {/* Drawer overlay */}
      {drawerProperty && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div className="flex-1 bg-black/40" onClick={() => setDrawerProperty(null)} />
          {/* Panel */}
          <div className="w-full max-w-5xl bg-background overflow-y-auto shadow-2xl">
            <div className="p-4 lg:p-8">
              <PropertyScorecardDetail
                property={drawerProperty}
                onClose={() => setDrawerProperty(null)}
              />
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <h1 className="text-2xl font-bold">All Properties</h1>
        <p className="text-white/70 text-sm mt-1">Portfolio-wide scorecard — {periodLabel}</p>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Passing', value: passing, color: '#4CAF50', icon: TrendingUp },
          { label: 'Failing', value: failing, color: '#ef4444', icon: TrendingDown },
          { label: 'No Data', value: noData, color: '#94a3b8', icon: Minus },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-card rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-black" style={{ color }}>{value}</div>
              <div className="text-xs text-muted-foreground font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters — above table */}
      <PropertyFilters
        properties={properties}
        filters={filters}
        onChange={setFilters}
      />

      {/* Search + Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by hotel name, city, or brand..."
            className="border-none shadow-none text-sm p-0 focus-visible:ring-0 h-auto"
          />
          <span className="text-xs text-muted-foreground shrink-0">{rows.length} properties</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold w-8">#</th>
                <th className="py-3 px-4 text-left font-semibold cursor-pointer" onClick={() => handleSort('name')}>
                  <div className="flex items-center gap-1">Property <SortIcon col="name" /></div>
                </th>
                <th className="py-3 px-4 text-center font-semibold cursor-pointer" onClick={() => handleSort('brand')}>
                  <div className="flex items-center justify-center gap-1">Brand <SortIcon col="brand" /></div>
                </th>
                <th className="py-3 px-4 text-center font-semibold cursor-pointer" onClick={() => handleSort('gm')}>
                  <div className="flex items-center justify-center gap-1">GM <SortIcon col="gm" /></div>
                </th>
                <th className="py-3 px-4 text-center font-semibold">GOP</th>
                <th className="py-3 px-4 text-center font-semibold">Margin</th>
                <th className="py-3 px-4 text-center font-semibold">RGI</th>
                <th className="py-3 px-4 text-center font-semibold">GSS</th>
                <th className="py-3 px-4 text-center font-semibold cursor-pointer" onClick={() => handleSort('score')}>
                  <div className="flex items-center justify-center gap-1">Score <SortIcon col="score" /></div>
                </th>
                <th className="py-3 px-4 text-center font-semibold cursor-pointer" onClick={() => handleSort('status')}>
                  <div className="flex items-center justify-center gap-1">Status <SortIcon col="status" /></div>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ property, scorecard }, idx) => {
                const anyIncomplete = scorecard && [scorecard.gop, scorecard.gopMargin, scorecard.rgi, scorecard.gss].some(k => k?.incomplete);
                const statusBadge = getStatusBadge(scorecard);
                const brandColor = getBrandColor(property.parent_brand);
                
                return (
                  <tr
                    key={property.id}
                    className="border-b border-border hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setDrawerProperty(property)}
                  >
                    <td className="py-3 px-4 text-muted-foreground text-xs font-medium">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-1 h-10 rounded-full" style={{ backgroundColor: brandColor }} />
                        <div>
                          <div className="font-semibold text-foreground text-sm">{property.name}</div>
                          <div className="text-xs text-muted-foreground">{property.city}, {property.state}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: `${brandColor}18`, color: brandColor }}>
                        {formatBrandLabel(property.parent_brand, property.sub_brand) || '—'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">{property.gm_name || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      {scorecard ? <ScoreCell score={scorecard.gop.score} max={35} pass={scorecard.gop.pass} incomplete={scorecard.gop.incomplete} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {scorecard ? <ScoreCell score={scorecard.gopMargin.score} max={35} pass={scorecard.gopMargin.pass} incomplete={scorecard.gopMargin.incomplete} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {scorecard ? <ScoreCell score={scorecard.rgi.score} max={15} pass={scorecard.rgi.pass} incomplete={scorecard.rgi.incomplete} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {scorecard ? <ScoreCell score={scorecard.gss.score} max={15} pass={scorecard.gss.pass} incomplete={scorecard.gss.incomplete} /> : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {scorecard ? (
                        <span className="text-lg font-black" style={{ color: anyIncomplete ? '#94a3b8' : (scorecard.total.pass ? '#4CAF50' : '#ef4444') }}>
                          {anyIncomplete ? '—' : scorecard.total.total}
                        </span>
                      ) : <span className="text-muted-foreground text-xs">—</span>}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold"
                        style={{ backgroundColor: statusBadge.bgColor, color: statusBadge.color }}
                      >
                        {statusBadge.label}
                      </span>
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

function ScoreCell({ score, max, pass, incomplete }) {
  if (incomplete) return <span className="text-xs font-bold text-muted-foreground">—</span>;
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold" style={{ color: pass ? '#4CAF50' : '#ef4444' }}>
        {score.toFixed(1)}/{max}
      </span>
    </div>
  );
}