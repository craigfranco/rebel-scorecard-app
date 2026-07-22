import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Target, TrendingUp, BarChart3, Smile, Zap, AlertTriangle } from 'lucide-react';
import SeedOnMount from '../components/SeedOnMount';

import { useTimePeriod } from '@/lib/TimePeriodContext';
import { calculateScorecard, normalizeGssTo100 } from '@/lib/scoring';
import { aggregateEntries, MONTHS, getQuarterFromMonth } from '@/lib/aggregation';

import KpiTracker from '@/components/dashboard/KpiTracker';
import DataAnnouncementPopup from '@/components/dashboard/DataAnnouncementPopup';

export default function Dashboard() {
  const { selectedMonth, selectedYear, periodType, getQuarterState, getQuarterLoadedMonths, getPeriodLabel } = useTimePeriod();

  // Determine if the selected period is incomplete
  const activeQuarter = selectedMonth ? getQuarterFromMonth(selectedMonth) : 0;
  const quarterState = periodType === 'quarter' && activeQuarter ? getQuarterState(activeQuarter) : 'complete';
  const isQuarterIncomplete = quarterState === 'inprogress';
  const loadedQuarterMonths = periodType === 'quarter' ? getQuarterLoadedMonths(activeQuarter) : [];
  const missingQuarterMonths = isQuarterIncomplete
    ? [activeQuarter * 3 - 2, activeQuarter * 3 - 1, activeQuarter * 3].filter(m => !loadedQuarterMonths.includes(m))
    : [];

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear }),
  });

  const { data: rgiQuarterlyReports = [] } = useQuery({
    queryKey: ['rgi-quarterly', selectedYear],
    queryFn: () => base44.entities.RgiQuarterlyReport.filter({ year: selectedYear }),
  });

  // For each property, get the properly aggregated entry for the current period.
  // This ensures quarterly/YTD GSS (and all other KPIs) use averaged values, not just the latest month.
  const getAggregatedEntry = (prop) => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id);
    if (!propEntries.length) return null;
    return aggregateEntries(propEntries, periodType, selectedMonth, selectedYear, rgiQuarterlyReports);
  };

  // BUDGETED GOP TRACKER
  const gopHotels = properties.map(prop => {
    const entry = getAggregatedEntry(prop);
    if (!entry) return { prop, hasData: false };
    const gopActual = entry.budgeted_gop_actual;
    const gopTarget = entry.budgeted_gop_target;
    if (gopActual == null || gopTarget == null || (gopActual === 0 && gopTarget > 0)) {
      return { prop, hasData: false };
    }
    const pass = gopActual > gopTarget;
    const details = `$${Math.round(gopActual / 1000)}K vs $${Math.round(gopTarget / 1000)}K`;
    return { prop, hasData: true, status: pass ? 'pass' : 'fail', details };
  });

  // GOP MARGIN IMPROVEMENT TRACKER
  // Uses gop_margin_improvement (avg of monthly actual−prior) from aggregation, consistent with scoring.js
  const marginHotels = properties.map(prop => {
    const entry = getAggregatedEntry(prop);
    if (!entry) return { prop, hasData: false };
    const improvement = entry.gop_margin_improvement ?? (
      entry.gop_margin_actual != null && entry.gop_margin_prior != null
        ? entry.gop_margin_actual - entry.gop_margin_prior
        : null
    );
    if (improvement == null) return { prop, hasData: false };
    const pass = improvement >= 0.1;
    const ty = entry.gop_margin_actual;
    const ly = entry.gop_margin_prior;
    const details = ty != null && ly != null ? `${ty.toFixed(1)}% vs ${ly.toFixed(1)}%` : '';
    return { prop, hasData: true, status: pass ? 'pass' : 'fail', details };
  });

  // RGI IMPROVEMENT TRACKER (three tiers)
  const rgiHotels = properties.map(prop => {
    const entry = getAggregatedEntry(prop);
    if (!entry) return { prop, hasData: false };
    const change = entry.revpar_index_change;
    let status = 'fail';
    if (change != null) {
      if (change >= 2.1) status = 'pass';
      else if (change >= 0.1) status = 'partial';
    }
    const details = change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '';
    return { prop, hasData: true, status, details };
  });

  // GSS IMPROVEMENT TRACKER
  // Uses aggregated (averaged) gss_actual/gss_prior, then normalizes by brand — consistent everywhere.
  const gssHotels = properties.map(prop => {
    const entry = getAggregatedEntry(prop);
    if (!entry) return { prop, hasData: false };
    const tyNorm = normalizeGssTo100(entry.gss_actual, prop.parent_brand);
    const lyNorm = normalizeGssTo100(entry.gss_prior, prop.parent_brand);
    if (tyNorm == null || lyNorm == null) {
      return { prop, hasData: true, status: 'na', details: '' };
    }
    const pass = tyNorm > lyNorm;
    const details = `${tyNorm.toFixed(1)} vs ${lyNorm.toFixed(1)}`;
    return { prop, hasData: true, status: pass ? 'pass' : 'fail', details };
  });

  // FORECAST KICKER TRACKER
  const forecastHotels = properties.map(prop => {
    const entry = getAggregatedEntry(prop);
    if (!entry) return { prop, hasData: false };
    return {
      prop,
      hasData: true,
      status: entry.forecast_kicker ? 'pass' : 'fail',
      details: '',
    };
  });

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <SeedOnMount />

      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
          <span>Balanced Scorecard</span>
          <ChevronRight className="w-3 h-3" />
          <span>Dashboard</span>
        </div>
        <h1 className="text-2xl font-bold">Portfolio Dashboard</h1>
        <p className="text-white/60 text-xs mt-0.5">Company-level overview — GOP, RPI, GSS, and forecast performance</p>
      </div>

      {/* Incomplete Quarter Banner */}
      {isQuarterIncomplete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {getPeriodLabel()} — Incomplete Quarter
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Only {loadedQuarterMonths.length} of 3 months have data loaded.
              Missing: {missingQuarterMonths.map(m => MONTHS[m - 1]).join(', ')}.
              KPIs shown reflect partial-quarter averages and may change as remaining data is uploaded.
            </p>
          </div>
        </div>
      )}

      {/* KPI Trackers Grid - 5 trackers using identical component design */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <KpiTracker
          title="Budgeted GOP Tracker"
          icon={<Target className="w-4 h-4 text-blue-500" />}
          iconColor="text-blue-500"
          subtitle="Pass: actual ≥ budget (35 pts)"
          hotels={gopHotels}
        />

        <KpiTracker
          title="GOP Margin Improvement Tracker"
          icon={<TrendingUp className="w-4 h-4 text-green-500" />}
          iconColor="text-green-500"
          subtitle="Pass: improvement ≥ 0.1% vs LY (35 pts)"
          hotels={marginHotels}
        />

        <KpiTracker
          title="RGI Improvement Tracker"
          icon={<BarChart3 className="w-4 h-4 text-purple-500" />}
          iconColor="text-purple-500"
          subtitle="Full: >2.0% (15 pts) / Partial: 0.1-2.0% (7.5 pts)"
          hotels={rgiHotels}
        />

        <KpiTracker
          title="GSS Improvement Tracker"
          icon={<Smile className="w-4 h-4 text-orange-500" />}
          iconColor="text-orange-500"
          subtitle="Pass: TY > LY (15 pts)"
          hotels={gssHotels}
        />

        <KpiTracker
          title="Forecast Kicker Tracker"
          icon={<Zap className="w-4 h-4 text-yellow-500" />}
          iconColor="text-yellow-500"
          subtitle="+3% salary bonus if 3/4 quarterly forecasts within ±3%"
          hotels={forecastHotels}
        />
      </div>

      <DataAnnouncementPopup />
    </div>
  );
}