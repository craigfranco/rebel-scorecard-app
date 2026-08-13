import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PropertyFilters from '@/components/filters/PropertyFilters';
import LeadershipGroupCard from '@/components/scorecard/LeadershipGroupCard';
import SeedOnMount from '../components/SeedOnMount';
import { useUserProfile } from '@/lib/UserProfileContext';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { getLeadTypes } from '@/functions/getLeadTypes';
import { calculateScorecard, aggregateEntries, hasForecastData } from '@/lib/scoring';

const EMPTY_FILTERS = { brand: '', subBrand: '', city: '', state: '', leadRole: '', leadPerson: '' };

const ROLE_LABELS = {
  corporate_operations: 'Corporate Operations',
  corporate_finance: 'Corporate Finance',
  corporate_hr: 'Corporate HR',
  corporate_revenue: 'Corporate Revenue',
  corporate_sales: 'Corporate Sales',
  corporate_ecommerce: 'Corporate E-Commerce',
  property_gm: 'General Manager',
  property_dof: 'Director of Finance',
  property_hrd: 'Director of HR',
  property_dorm: 'Director of Revenue',
  property_dosm: 'Director of Sales & Marketing',
  property_doe: 'Director of Engineering',
};

export default function LeadershipScorecard() {
  const { filterPropertiesForUser } = useUserProfile();
  const { selectedMonth, selectedYear, periodType, getPeriodLabel } = useTimePeriod();

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [fieldToPersonStrIds, setFieldToPersonStrIds] = useState({});
  const [expandedId, setExpandedId] = useState(null);

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

  // Per-hotel score rows
  const rowsByProperty = useMemo(() => {
    const map = {};
    filteredProperties.forEach(p => {
      const propEntries = allEntries.filter(e => e.property_id === p.id);
      if (!propEntries.length) {
        map[p.id] = { property: p, hasData: false, gopActual: null, gopBudget: null };
        return;
      }
      const entry = aggregateEntries(propEntries, periodType, selectedMonth, selectedYear, rgiQuarterlyReports, bonusExceptions) || {};
      const sc = calculateScorecard(entry, p);
      map[p.id] = {
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
        gopActual: entry.budgeted_gop_actual ?? null,
        gopBudget: entry.budgeted_gop_target ?? null,
      };
    });
    return map;
  }, [filteredProperties, allEntries, periodType, selectedMonth, selectedYear, rgiQuarterlyReports, bonusExceptions]);

  // Group by the selected lead-type leader (default: General Manager)
  const groupField = filters.leadRole || 'property_gm';
  const groupLabel = ROLE_LABELS[groupField] || 'Leader';

  const groups = useMemo(() => {
    const map = new Map();
    filteredProperties.forEach(p => {
      const leader = (p[groupField] || '').trim() || 'Unassigned';
      if (!map.has(leader)) map.set(leader, []);
      map.get(leader).push(rowsByProperty[p.id]);
    });
    return [...map.entries()].sort((a, b) => {
      if (a[0] === 'Unassigned') return 1;
      if (b[0] === 'Unassigned') return -1;
      return a[0].localeCompare(b[0]);
    });
  }, [filteredProperties, rowsByProperty, groupField]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <SeedOnMount />

      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <h1 className="text-2xl font-bold">Leadership Scorecard</h1>
        <p className="text-white/70 text-sm mt-1">
          Hotels grouped by {groupLabel.toLowerCase()} — {getPeriodLabel()} · {filteredProperties.length} hotels in {groups.length} group(s)
        </p>
      </div>

      {/* Filters (includes Lead Type leader filter) */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <PropertyFilters properties={properties} filters={filters} onChange={setFilters} />
      </div>

      {/* Group cards */}
      {groups.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No hotels match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([leaderName, entries]) => (
            <LeadershipGroupCard
              key={leaderName}
              groupName={leaderName}
              roleLabel={groupLabel}
              entries={entries}
              expandedId={expandedId}
              onToggle={setExpandedId}
            />
          ))}
        </div>
      )}
    </div>
  );
}