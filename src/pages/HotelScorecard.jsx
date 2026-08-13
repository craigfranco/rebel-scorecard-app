import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PropertyScorecardDetail from '@/components/scorecard/PropertyScorecardDetail';
import ScorecardLeaderboard from '@/components/scorecard/ScorecardLeaderboard';
import SeedOnMount from '../components/SeedOnMount';
import { useUserProfile } from '@/lib/UserProfileContext';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { calculateScorecard, aggregateEntries, hasForecastData } from '@/lib/scoring';

export default function HotelScorecard() {
  const { filterPropertiesForUser } = useUserProfile();
  const { selectedMonth, selectedYear, periodType, getPeriodLabel, getPeriodMonths } = useTimePeriod();

  const urlParams = new URLSearchParams(window.location.search);
  const paramPropertyId = urlParams.get('propertyId');

  const [selectedPropertyId, setSelectedPropertyId] = useState(paramPropertyId || '');
  const [sortCol, setSortCol] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

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

  const rows = useMemo(() => {
    return properties.map(p => {
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
  }, [properties, allEntries, periodType, selectedMonth, selectedYear, rgiQuarterlyReports, bonusExceptions]);

  // Keep the selected hotel within the set
  useEffect(() => {
    if (!properties.length) return;
    const exists = properties.find(p => p.id === selectedPropertyId);
    if (!exists) setSelectedPropertyId(properties[0].id);
  }, [properties, selectedPropertyId]);

  useEffect(() => {
    if (paramPropertyId && properties.length && selectedPropertyId !== paramPropertyId) {
      const exists = properties.find(p => p.id === paramPropertyId);
      if (exists) setSelectedPropertyId(paramPropertyId);
    }
  }, [paramPropertyId, properties]);

  const selectedProperty =
    properties.find(p => p.id === selectedPropertyId) || null;

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

      {/* Leaderboard */}
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
        showPropertySelector={properties.length > 1}
        properties={properties}
        selectedPropertyId={selectedPropertyId}
        onPropertyChange={setSelectedPropertyId}
      />
    </div>
  );
}