import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PropertyScorecardDetail from '@/components/scorecard/PropertyScorecardDetail';
import PropertyFilters from '@/components/filters/PropertyFilters';
import PortfolioKpiRollup from '@/components/dashboard/PortfolioKpiRollup';
import ScorecardLeaderboard from '@/components/scorecard/ScorecardLeaderboard';
import SeedOnMount from '../components/SeedOnMount';
import { useUserProfile } from '@/lib/UserProfileContext';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { getLeadTypes } from '@/functions/getLeadTypes';
import { calculateScorecard, aggregateEntries, hasForecastData } from '@/lib/scoring';

const EMPTY_FILTERS = { brand: '', subBrand: '', city: '', state: '', leadRole: '', leadPerson: '' };

export default function HotelScorecard() {
  const { filterPropertiesForUser } = useUserProfile();
  const { selectedMonth, selectedYear, periodType, getPeriodLabel, getPeriodMonths } = useTimePeriod();

  const urlParams = new URLSearchParams(window.location.search);
  const paramPropertyId = urlParams.get('propertyId');

  const [selectedPropertyId, setSelectedPropertyId] = useState(paramPropertyId || '');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [fieldToPersonStrIds, setFieldToPersonStrIds] = useState({});
  const [sortCol, setSortCol] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    getLeadTypes({}).then(res => {
      if (res?.data?.fieldToPersonStrIds) setFieldToPersonStrIds(res.data.fieldToPersonStrIds);
    }).catch(() => {});
  }, []);

  const { data: rawProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });
  const properties = filterPropertiesForUser(rawProperties);

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear],
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

  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
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
    });
  }, [properties, filters, fieldToPersonStrIds]);

  const rows = useMemo(() => {
    return filteredProperties.map(p => {
      const propEntries = allEntries.filter(e => e.property_id === p.id);
      if (!propEntries.length) return { property: p, hasData: false };
      const entry = aggregateEntries(propEntries, periodType, selectedMonth, selectedYear, rgiQuarterlyReports, bonusExceptions) || {};
      const sc = calculateScorecard(entry, p);
      return {
        property: p,
        hasData: true,
        gop: sc.gop?.score ?? null,
        gopMargin: sc.gopMargin?.score ?? null,
        rgi: sc.rgi?.score ?? null,
        gss: sc.gss?.score ?? null,
        total: sc.total?.total ?? null,
        maxPossible: sc.total?.maxPossible ?? null,
        forecast: hasForecastData(entry) ? (entry.forecast_kicker || false) : null,
        redzone: entry.red_zone_kicker ?? null,
      };
    });
  }, [filteredProperties, allEntries, periodType, selectedMonth, selectedYear, rgiQuarterlyReports, bonusExceptions]);

  // Keep the selected hotel within the filtered set
  useEffect(() => {
    if (!filteredProperties.length) return;
    const exists = filteredProperties.find(p => p.id === selectedPropertyId);
    if (!exists) setSelectedPropertyId(filteredProperties[0].id);
  }, [filteredProperties, selectedPropertyId]);

  useEffect(() => {
    if (paramPropertyId && properties.length && selectedPropertyId !== paramPropertyId) {
      const exists = properties.find(p => p.id === paramPropertyId);
      if (exists) setSelectedPropertyId(paramPropertyId);
    }
  }, [paramPropertyId, properties]);

  const selectedProperty =
    filteredProperties.find(p => p.id === selectedPropertyId) ||
    properties.find(p => p.id === selectedPropertyId) ||
    null;

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      let av, bv;
      if (sortCol === 'name') { av = a.property.name; bv = b.property.name; }
      else if (sortCol === 'gm') { av = a.property.gm_name || ''; bv = b.property.gm_name || ''; }
      else { av = a.hasData ? (a[sortCol] ?? -1) : -1; bv = b.hasData ? (b[sortCol] ?? -1) : -1; }
      if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }, [rows, sortCol, sortDir]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <SeedOnMount />

      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <h1 className="text-2xl font-bold">Hotel Performance Scorecard</h1>
        <p className="text-white/70 text-sm mt-1">Portfolio summary & per-hotel scorecard — {getPeriodLabel()}</p>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <PropertyFilters properties={properties} filters={filters} onChange={setFilters} />
      </div>

      {/* KPI rollup cards (filtered) */}
      <PortfolioKpiRollup
        properties={filteredProperties}
        allEntries={allEntries}
        periodType={periodType}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
        getPeriodMonths={getPeriodMonths}
      />

      {/* Leaderboard (filtered) */}
      <ScorecardLeaderboard
        rows={sortedRows}
        sortCol={sortCol}
        sortDir={sortDir}
        onSort={handleSort}
        selectedPropertyId={selectedPropertyId}
        onSelect={setSelectedPropertyId}
      />

      {/* Selected hotel full scorecard */}
      <PropertyScorecardDetail
        property={selectedProperty}
        showPropertySelector={filteredProperties.length > 1}
        properties={filteredProperties}
        selectedPropertyId={selectedPropertyId}
        onPropertyChange={setSelectedPropertyId}
      />
    </div>
  );
}