import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Target, TrendingUp, BarChart3, Smile, Zap } from 'lucide-react';
import SeedOnMount from '../components/SeedOnMount';

import { useTimePeriod } from '@/lib/TimePeriodContext';
import { normalizeGssTo100 } from '@/lib/scoring';
import { getBrandColor } from '@/lib/portfolioHelpers';

import ExecutiveSummaryBar from '@/components/dashboard/ExecutiveSummaryBar';
import PortfolioKpiRollup from '@/components/dashboard/PortfolioKpiRollup';
import KpiTracker from '@/components/dashboard/KpiTracker';

export default function Dashboard() {
  const { selectedMonth, selectedYear, periodType, getPeriodMonths } = useTimePeriod();
  
  // Helper to map status labels
  const getStatusLabel = (status) => {
    if (status === 'pass') return 'PASS';
    if (status === 'partial') return 'PARTIAL';
    if (status === 'na') return 'N/A';
    return 'FAIL';
  };

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear }),
  });

  const portfolioProps = { properties, allEntries, getPeriodMonths, selectedYear, periodType, selectedMonth };

  // Build tracker data for each KPI
  const periodMonths = getPeriodMonths();

  // BUDGETED GOP TRACKER
  const gopHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const gopActual = latest.budgeted_gop_actual;
    const gopTarget = latest.budgeted_gop_target;
    const gopPrior = latest.budgeted_gop_prior;
    
    // Exclude if either value is null, or if actual=0 and target>0
    if (gopActual == null || gopTarget == null || (gopActual === 0 && gopTarget > 0)) {
      return { prop, hasData: false };
    }
    
    const pass = gopActual > gopTarget;
    const details = `$${Math.round(gopActual / 1000)}K vs $${Math.round(gopTarget / 1000)}K`;
    
    return {
      prop,
      hasData: true,
      status: pass ? 'pass' : 'fail',
      details,
      actual: gopActual,
      target: gopTarget,
      ly: gopPrior,
      metricType: 'gop',
    };
  });

  // GOP MARGIN IMPROVEMENT TRACKER
  const marginHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const ty = latest.gop_margin_actual;
    const ly = latest.gop_margin_prior;
    const budget = latest.gop_margin_budget;
    const improvement = (ty != null && ly != null) ? ty - ly : null;
    const pass = improvement != null && improvement >= 0.1;
    const details = (ty != null && ly != null) ? `${ty.toFixed(1)}% vs ${ly.toFixed(1)}%` : '';
    
    return {
      prop,
      hasData: true,
      status: pass ? 'pass' : 'fail',
      details,
      actual: ty,
      target: budget,
      ly,
      metricType: 'margin',
    };
  });

  // RGI IMPROVEMENT TRACKER (three tiers)
  const rgiHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const change = latest.revpar_index_change;
    const rgiTy = latest.revpar_index;
    const rgiLy = rgiTy != null && change != null ? rgiTy / (1 + change / 100) : null;
    
    let status = 'fail';
    if (change != null) {
      if (change > 2.0) status = 'pass';
      else if (change >= 0.1) status = 'partial';
    }
    const details = change != null ? `${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : '';
    
    return {
      prop,
      hasData: true,
      status,
      details,
      actual: rgiTy,
      target: change,
      ly: rgiLy,
      metricType: 'rgi',
    };
  });

  // GSS IMPROVEMENT TRACKER
  const gssHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const tyNorm = normalizeGssTo100(latest.gss_actual, prop.parent_brand);
    const lyNorm = normalizeGssTo100(latest.gss_prior, prop.parent_brand);
    
    if (tyNorm == null || lyNorm == null) {
      return { prop, hasData: true, status: 'na', details: '' };
    }
    
    const pass = tyNorm > lyNorm;
    const details = `${tyNorm.toFixed(1)} vs ${lyNorm.toFixed(1)}`;
    
    return {
      prop,
      hasData: true,
      status: pass ? 'pass' : 'fail',
      details,
      actual: tyNorm,
      target: lyNorm,
      ly: lyNorm,
      metricType: 'gss',
    };
  });

  // FORECAST KICKER TRACKER
  const forecastHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    const latest = propEntries[propEntries.length - 1];
    const hit = latest && latest.forecast_kicker === true;
    const hasData = !!latest;
    
    return {
      prop,
      hasData: true,
      status: hit ? 'pass' : 'fail',
      details: '',
      actual: latest?.forecast_actual_revenue,
      target: latest?.forecast_primary_forecast,
      ly: null,
      metricType: 'forecast',
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

      <ExecutiveSummaryBar {...portfolioProps} />

      <PortfolioKpiRollup {...portfolioProps} />

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
    </div>
  );
}