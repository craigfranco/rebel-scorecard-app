import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight } from 'lucide-react';
import SeedOnMount from '../components/SeedOnMount';

import { useTimePeriod } from '@/lib/TimePeriodContext';

import ExecutiveSummaryBar from '@/components/dashboard/ExecutiveSummaryBar';
import AttentionNeeded from '@/components/dashboard/AttentionNeeded';
import PerformanceHeatMap from '@/components/dashboard/PerformanceHeatMap';
import DataCompletenessIndicator from '@/components/dashboard/DataCompletenessIndicator';
import ForecastKickerTracker from '@/components/dashboard/ForecastKickerTracker';
import PortfolioKpiRollup from '@/components/dashboard/PortfolioKpiRollup';

export default function Dashboard() {
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

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AttentionNeeded {...portfolioProps} />
        <ForecastKickerTracker {...portfolioProps} />
      </div>

      <PerformanceHeatMap {...portfolioProps} />

      <DataCompletenessIndicator {...portfolioProps} />
    </div>
  );
}