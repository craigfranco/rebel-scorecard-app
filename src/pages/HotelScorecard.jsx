import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { calculateScorecard, aggregateEntries } from '../lib/scoring';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import PropertyFilters from '@/components/filters/PropertyFilters';
import HotelScorecardRow from '@/components/scorecard/HotelScorecardRow';

const EMPTY_FILTERS = { brand: '', subBrand: '', city: '', state: '', leadRole: '', leadPerson: '' };

const SORT_OPTIONS = [
  { value: 'score_desc', label: 'Total Score ↓' },
  { value: 'score_asc', label: 'Total Score ↑' },
  { value: 'name_asc', label: 'Hotel Name' },
  { value: 'brand_asc', label: 'Brand' },
  { value: 'rgi_desc', label: 'RPI Score ↓' },
  { value: 'gop_desc', label: 'GOP Score ↓' },
];

export default function HotelScorecard() {
  const { selectedMonth, selectedYear, periodType, getPeriodLabel, getPeriodMonths } = useTimePeriod();
  const [sortBy, setSortBy] = useState('score_desc');
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear }),
  });

  // Also fetch prior year entries for trend
  const { data: priorEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear - 1],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear - 1 }),
  });

  const getEntry = (propertyId, entries = allEntries) => {
    const propEntries = entries.filter(e => e.property_id === propertyId);
    if (!propEntries.length) return null;
    const periodMonths = getPeriodMonths();
    const periodEntries = propEntries.filter(e =>
      periodMonths.includes(e.month) && e.year === selectedYear
    );
    if (!periodEntries.length) return null;
    if (periodType === 'month') return periodEntries[0] || null;
    return aggregateEntries(periodEntries, periodType, selectedMonth, selectedYear);
  };

  // For trend: compare current period score to previous month's score
  const getTrend = (propertyId, currentScore) => {
    if (currentScore == null) return 'flat';
    const prevMonth = selectedMonth === 1 ? 12 : selectedMonth - 1;
    const prevYear = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
    const prevEntries = selectedMonth === 1 ? priorEntries : allEntries;
    const prevPropEntries = prevEntries.filter(e => e.property_id === propertyId && e.month === prevMonth && e.year === prevYear);
    if (!prevPropEntries.length) return 'flat';
    const prop = properties.find(p => p.id === propertyId);
    if (!prop) return 'flat';
    const prevSc = calculateScorecard(prevPropEntries[0], prop);
    if (prevSc.total.total == null) return 'flat';
    if (currentScore > prevSc.total.total + 0.5) return 'up';
    if (currentScore < prevSc.total.total - 0.5) return 'down';
    return 'flat';
  };

  const rows = useMemo(() => {
    return properties
      .filter(p => {
        if (filters.brand && p.parent_brand !== filters.brand) return false;
        if (filters.subBrand && p.sub_brand !== filters.subBrand) return false;
        if (filters.city && p.city !== filters.city) return false;
        if (filters.state && p.state !== filters.state) return false;
        return true;
      })
      .map(p => {
        const entry = getEntry(p.id);
        const scorecard = entry ? calculateScorecard(entry, p) : null;
        const anyIncomplete = scorecard && [scorecard.gop, scorecard.gopMargin, scorecard.rgi, scorecard.gss].some(k => k?.incomplete);
        const totalScore = scorecard && !anyIncomplete ? scorecard.total.total : null;
        return { property: p, entry, scorecard, totalScore };
      });
  }, [properties, allEntries, periodType, selectedMonth, selectedYear, filters]);

  const sorted = useMemo(() => {
    const copy = [...rows];
    switch (sortBy) {
      case 'score_desc': copy.sort((a, b) => (b.totalScore ?? -1) - (a.totalScore ?? -1)); break;
      case 'score_asc': copy.sort((a, b) => (a.totalScore ?? -1) - (b.totalScore ?? -1)); break;
      case 'name_asc': copy.sort((a, b) => a.property.name.localeCompare(b.property.name)); break;
      case 'brand_asc': copy.sort((a, b) => (a.property.parent_brand || '').localeCompare(b.property.parent_brand || '')); break;
      case 'rgi_desc': copy.sort((a, b) => (b.scorecard?.rgi?.score ?? -1) - (a.scorecard?.rgi?.score ?? -1)); break;
      case 'gop_desc': copy.sort((a, b) => (b.scorecard?.gop?.score ?? -1) - (a.scorecard?.gop?.score ?? -1)); break;
    }
    return copy;
  }, [rows, sortBy]);

  const periodLabel = getPeriodLabel();

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <span>Balanced Scorecard</span>
          <ChevronRight className="w-3 h-3" />
          <span>Hotel Performance Scorecard</span>
        </div>
        <h1 className="text-2xl font-bold">Hotel Performance Scorecard</h1>
        <p className="text-white/60 text-xs mt-0.5">All properties — {periodLabel}</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">Sort by:</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-48 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <PropertyFilters properties={properties} filters={filters} onChange={setFilters} />
      </div>

      {/* Column header hint */}
      <div className="hidden md:grid grid-cols-[2rem_1fr_auto_auto_auto_auto] gap-4 px-4 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
        <div>#</div>
        <div>Hotel</div>
        <div className="w-40 text-center">KPI Status</div>
        <div className="w-28 text-center">Forecast</div>
        <div className="w-24 text-right">Score</div>
        <div className="w-5" />
      </div>

      {/* Hotel rows */}
      <div className="space-y-2">
        {sorted.map(({ property, entry, scorecard, totalScore }, idx) => (
          <HotelScorecardRow
            key={property.id}
            property={property}
            entry={entry}
            scorecard={scorecard}
            trend={getTrend(property.id, totalScore)}
            rank={idx + 1}
            totalCount={sorted.length}
          />
        ))}
        {sorted.length === 0 && (
          <div className="bg-card rounded-2xl border border-border p-12 text-center text-muted-foreground">
            No properties match the current filters.
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-2">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-yellow-400 inline-block" /> Top 3 performers</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-400 inline-block" /> Bottom 3 performers</span>
        <span className="flex items-center gap-1.5">↑ <span>Score improved vs prior month</span></span>
        <span className="flex items-center gap-1.5">↓ <span>Score declined vs prior month</span></span>
      </div>
    </div>
  );
}