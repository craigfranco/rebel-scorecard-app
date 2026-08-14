import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import PropertyFilters from '@/components/filters/PropertyFilters';
import LeadershipGroupCard from '@/components/scorecard/LeadershipGroupCard';
import LeadershipOverviewTable from '@/components/scorecard/LeadershipOverviewTable';
import SeedOnMount from '../components/SeedOnMount';
import { useUserProfile } from '@/lib/UserProfileContext';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { getLeadTypes } from '@/functions/getLeadTypes';
import { calculateScorecard, aggregateEntries, hasForecastData, getQuarterFromMonth } from '@/lib/scoring';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

const slug = (s) => 'group-' + s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function LeadershipScorecard() {
  const { filterPropertiesForUser } = useUserProfile();
  const { selectedMonth, selectedYear, periodType, getPeriodLabel } = useTimePeriod();

  const [filters, setFilters] = useState({ ...EMPTY_FILTERS, leadRole: 'corporate_operations' });
  const [fieldToPersonStrIds, setFieldToPersonStrIds] = useState({});
  const [expandedId, setExpandedId] = useState(null);

  const handleSelectOperator = (name) => {
    const el = document.getElementById(slug(name));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      el.classList.add('ring-2', 'ring-primary');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
    }
  };

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

  const quarter = getQuarterFromMonth(selectedMonth);

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
        entry,
        sc,
        rooms: p.rooms || 0,
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

  const reportingCount = filteredProperties.filter(p => rowsByProperty[p.id]?.hasData).length;

  const groups = useMemo(() => {
    const map = new Map();
    filteredProperties.forEach(p => {
      const row = rowsByProperty[p.id];
      if (!row?.hasData) return; // exclude hotels with no data for the period
      const leader = (p[groupField] || '').trim() || 'Unassigned';
      if (!map.has(leader)) map.set(leader, []);
      map.get(leader).push(row);
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
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold">Leadership Scorecard</h1>
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" className="text-white/70 hover:text-white transition-colors" aria-label="How the score is derived">
                <Info className="w-4 h-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80 text-sm leading-relaxed">
              <div className="font-semibold text-foreground mb-1.5">How the score is derived</div>
              <p className="text-muted-foreground mb-2">
                Each hotel's total score is out of <span className="font-semibold text-foreground">100</span>, combining four weighted KPIs:
              </p>
              <ul className="space-y-1 mb-2">
                <li className="flex justify-between"><span>GOP Achievement</span><span className="font-semibold">35 pts</span></li>
                <li className="flex justify-between"><span>GOP Margin Improvement</span><span className="font-semibold">35 pts</span></li>
                <li className="flex justify-between"><span>RGI (RevPAR Index)</span><span className="font-semibold">15 pts</span></li>
                <li className="flex justify-between"><span>GSS (Guest Satisfaction)</span><span className="font-semibold">15 pts</span></li>
              </ul>
              <p className="text-muted-foreground mb-2">
                Each group shows two combined scores:
              </p>
              <ul className="space-y-1 mb-2">
                <li className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Avg Score</span> — a simple mean; every reporting hotel counts equally regardless of size.
                </li>
                <li className="text-muted-foreground">
                  <span className="font-semibold text-foreground">Portfolio Score</span> — a rooms-weighted mean; larger properties pull the number more, reflecting actual room exposure.
                </li>
              </ul>
              <p className="text-muted-foreground">
                The two match when a group's hotels are similar in size, and diverge when large and small properties score differently. Hotels with no data for the selected period are excluded from the rollup.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <p className="text-white/70 text-sm mt-1">
          Hotels grouped by {groupLabel.toLowerCase()} — {getPeriodLabel()} · {reportingCount} reporting hotel{reportingCount !== 1 ? 's' : ''} in {groups.length} group(s){filteredProperties.length !== reportingCount ? ` · ${filteredProperties.length - reportingCount} without data` : ''}
        </p>
      </div>

      {/* Filters (includes Lead Type leader filter) */}
      <div className="bg-card rounded-2xl border border-border p-4 shadow-sm">
        <PropertyFilters properties={properties} filters={filters} onChange={setFilters} />
      </div>

      {/* Operator overview — all groups ranked together */}
      {groups.length > 0 && (
        <LeadershipOverviewTable groups={groups} roleLabel={groupLabel} onSelectOperator={handleSelectOperator} />
      )}

      {/* Group cards */}
      {groups.length === 0 ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm">
          <p className="text-muted-foreground text-sm">No hotels match the current filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map(([leaderName, entries]) => (
            <div key={leaderName} id={slug(leaderName)} className="scroll-mt-24 rounded-2xl transition-shadow">
              <LeadershipGroupCard
                groupName={leaderName}
                roleLabel={groupLabel}
                leadRole={groupField}
                year={selectedYear}
                quarter={quarter}
                periodLabel={getPeriodLabel()}
                entries={entries}
                expandedId={expandedId}
                onToggle={setExpandedId}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}