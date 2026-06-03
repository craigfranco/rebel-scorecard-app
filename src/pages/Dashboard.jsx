import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Target, TrendingUp, BarChart3, Smile, Zap } from 'lucide-react';
import SeedOnMount from '../components/SeedOnMount';
import { useNavigate } from 'react-router-dom';

import { useTimePeriod } from '@/lib/TimePeriodContext';
import { calculateScorecard, normalizeGssTo100, hasForecastData } from '@/lib/scoring';
import { getBrandColor } from '@/lib/portfolioHelpers';

import KpiTracker from '@/components/dashboard/KpiTracker';

export default function Dashboard() {
  const navigate = useNavigate();
  const { selectedMonth, selectedYear, periodType, getPeriodMonths } = useTimePeriod();
  
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear }),
  });

  const portfolioProps = { properties, allEntries, getPeriodMonths, selectedYear, periodType, selectedMonth };

  const handleHotelClick = (propId) => {
    navigate(`/hotel-scorecard?propertyId=${propId}&month=${selectedMonth}&year=${selectedYear}`);
  };

  // Build tracker data for each KPI
  const periodMonths = getPeriodMonths();

  // BUDGETED GOP TRACKER - uses exact same logic as calculateScorecard
  const gopHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const scorecard = calculateScorecard(latest, prop);
    const gopActual = latest.budgeted_gop_actual;
    const gopTarget = latest.budgeted_gop_target;
    const gopPrior = latest.budgeted_gop_prior;
    
    // Same exclusion as scorecard: null values = incomplete
    if (gopActual == null || gopTarget == null) {
      return { prop, hasData: false };
    }
    
    return {
      prop,
      hasData: true,
      status: scorecard.gop.pass ? 'pass' : 'fail',
      details: '',
      actual: gopActual,
      target: gopTarget,
      ly: gopPrior,
      metricType: 'gop',
      onClick: () => handleHotelClick(prop.id),
    };
  });

  // GOP MARGIN IMPROVEMENT TRACKER - uses exact same logic as calculateScorecard
  const marginHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const scorecard = calculateScorecard(latest, prop);
    const ty = latest.gop_margin_actual;
    const ly = latest.gop_margin_prior;
    const budget = latest.gop_margin_budget;
    
    // Same exclusion as scorecard: null values = incomplete
    if (ty == null || ly == null) {
      return { prop, hasData: false };
    }
    
    return {
      prop,
      hasData: true,
      status: scorecard.gopMargin.pass ? 'pass' : 'fail',
      details: '',
      actual: ty,
      target: budget,
      ly,
      metricType: 'margin',
      onClick: () => handleHotelClick(prop.id),
    };
  });

  // RGI IMPROVEMENT TRACKER - uses exact same logic as calculateScorecard
  const rgiHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const scorecard = calculateScorecard(latest, prop);
    const change = latest.revpar_index_change;
    const rgiTy = latest.revpar_index;
    const rgiLy = rgiTy != null && change != null ? rgiTy / (1 + change / 100) : null;
    
    // Same exclusion as scorecard: null = incomplete
    if (change == null) {
      return { prop, hasData: false };
    }
    
    return {
      prop,
      hasData: true,
      status: scorecard.rgi.pass ? 'pass' : scorecard.rgi.tier === 'partial' ? 'partial' : 'fail',
      details: '',
      actual: rgiTy,
      target: rgiLy,
      ly: rgiLy,
      metricType: 'rgi',
      onClick: () => handleHotelClick(prop.id),
    };
  });

  // GSS IMPROVEMENT TRACKER - uses exact same logic as calculateScorecard
  const gssHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const scorecard = calculateScorecard(latest, prop);
    const tyNorm = normalizeGssTo100(latest.gss_actual, prop.parent_brand);
    const lyNorm = normalizeGssTo100(latest.gss_prior, prop.parent_brand);
    
    // Same exclusion as scorecard: null values = N/A
    if (tyNorm == null || lyNorm == null) {
      return { prop, hasData: true, status: 'na', details: '' };
    }
    
    return {
      prop,
      hasData: true,
      status: scorecard.gss.pass ? 'pass' : 'fail',
      details: '',
      actual: tyNorm,
      target: lyNorm,
      ly: lyNorm,
      metricType: 'gss',
      onClick: () => handleHotelClick(prop.id),
    };
  });

  // FORECAST KICKER TRACKER - uses exact same logic as calculateScorecard
  const forecastHotels = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, hasData: false };
    
    const latest = propEntries[propEntries.length - 1];
    const scorecard = calculateScorecard(latest, prop);
    
    // Same check as hasForecastData in scoring.js
    const hasValidData = hasForecastData(latest);
    
    return {
      prop,
      hasData: hasValidData,
      status: scorecard.forecastKicker ? 'pass' : 'fail',
      details: '',
      actual: latest?.forecast_actual_revenue,
      target: latest?.forecast_primary_forecast,
      ly: null,
      metricType: 'forecast',
      onClick: () => handleHotelClick(prop.id),
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