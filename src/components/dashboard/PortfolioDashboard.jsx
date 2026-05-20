import React, { useMemo } from 'react';
import KpiTile from './KpiTile';
import { TrendingUp, DollarSign, Target, Star } from 'lucide-react';
import { formatCurrency, formatPercentage } from '@/lib/portfolioHelpers';
import { aggregateEntries, getQuarterMonths, getQuarterStartMonth } from '@/lib/aggregation';

export default function PortfolioDashboard({ properties, entries, periodType, selectedMonth, selectedYear }) {
  // Aggregate data across all properties
  const stats = React.useMemo(() => {
    if (!properties.length || !entries.length) {
      return {
        totalGOPActual: null,
        totalGOPBudget: null,
        gopVariance: null,
        gopVariancePct: null,
        forecastHitRate: null,
        avgRevPARIndex: null,
        avgGSS: null,
      };
    }

    let totalGOPActual = 0;
    let totalGOPBudget = 0;
    let propertiesWithForecast = 0;
    let forecastsHit = 0;
    let revPARIndices = [];
    let gssScores = [];

    properties.forEach(property => {
      const propEntries = entries.filter(e => e.property_id === property.id);
      if (!propEntries.length) return;

      // Get entry for selected period using proper aggregation
      let entry;
      if (periodType === 'month') {
        entry = propEntries.find(e => e.month === selectedMonth && e.year === selectedYear);
      } else if (periodType === 'quarter') {
        // Quarter: all 3 months in the quarter
        const quarter = Math.ceil(selectedMonth / 3);
        const quarterMonths = getQuarterMonths(quarter);
        const periodEntries = propEntries.filter(e => 
          quarterMonths.includes(e.month) && 
          e.year === selectedYear
        );
        if (periodEntries.length > 0) {
          entry = aggregateEntries(periodEntries, periodType, selectedMonth, selectedYear);
        }
      } else if (periodType === 'qtd') {
        // QTD: from quarter start through selected month
        const quarter = Math.ceil(selectedMonth / 3);
        const quarterStart = getQuarterStartMonth(quarter);
        const periodEntries = propEntries.filter(e => 
          e.month >= quarterStart && 
          e.month <= selectedMonth && 
          e.year === selectedYear
        );
        if (periodEntries.length > 0) {
          entry = aggregateEntries(periodEntries, periodType, selectedMonth, selectedYear);
        }
      } else if (periodType === 'ytd') {
        // YTD: all months from Jan through selected month in selected year
        const periodEntries = propEntries.filter(e => 
          e.year === selectedYear && 
          e.month <= selectedMonth
        );
        if (periodEntries.length > 0) {
          entry = aggregateEntries(periodEntries, periodType, selectedMonth, selectedYear);
        }
      }

      if (!entry) return;

      if (entry.budgeted_gop_actual != null) totalGOPActual += entry.budgeted_gop_actual;
      if (entry.budgeted_gop_target != null) totalGOPBudget += entry.budgeted_gop_target;

      if (entry.forecast_result != null) {
        propertiesWithForecast++;
        if (entry.forecast_result === 'Hit') forecastsHit++;
      }

      if (entry.revpar_index != null) revPARIndices.push(entry.revpar_index);
      if (entry.gss_actual != null) gssScores.push(entry.gss_actual);
    });

    const gopVariance = totalGOPActual - totalGOPBudget;
    const gopVariancePct = totalGOPBudget !== 0 ? (gopVariance / totalGOPBudget) * 100 : null;

    return {
      totalGOPActual,
      totalGOPBudget,
      gopVariance,
      gopVariancePct,
      forecastHitRate: propertiesWithForecast > 0 ? (forecastsHit / propertiesWithForecast) * 100 : null,
      avgRevPARIndex: revPARIndices.length > 0 ? revPARIndices.reduce((a, b) => a + b, 0) / revPARIndices.length : null,
      avgGSS: gssScores.length > 0 ? gssScores.reduce((a, b) => a + b, 0) / gssScores.length : null,
    };
  }, [properties, entries, periodType, selectedMonth, selectedYear]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <KpiTile
        title="Total GOP Actual"
        value={formatCurrency(stats.totalGOPActual)}
        subtitle="Period actual"
        Icon={DollarSign}
      />
      <KpiTile
        title="GOP vs Budget"
        value={formatCurrency(stats.gopVariance)}
        subtitle={formatPercentage(stats.gopVariancePct)}
        delta={formatPercentage(stats.gopVariancePct)}
        deltaType={stats.gopVariance >= 0 ? 'positive' : 'negative'}
        Icon={Target}
      />
      <KpiTile
        title="Forecast Hit Rate"
        value={stats.forecastHitRate != null ? `${stats.forecastHitRate.toFixed(0)}%` : '—'}
        subtitle="Properties hitting forecast"
        deltaType={stats.forecastHitRate >= 75 ? 'positive' : stats.forecastHitRate >= 50 ? 'neutral' : 'negative'}
        Icon={TrendingUp}
      />
      <KpiTile
        title="Avg RevPAR Index"
        value={stats.avgRevPARIndex != null ? stats.avgRevPARIndex.toFixed(1) : '—'}
        subtitle="Portfolio average"
        deltaType={stats.avgRevPARIndex >= 100 ? 'positive' : 'negative'}
        Icon={Star}
      />
      <KpiTile
        title="Avg GSS Score"
        value={stats.avgGSS != null ? stats.avgGSS.toFixed(1) : '—'}
        subtitle="Guest satisfaction"
        deltaType={stats.avgGSS >= 4 ? 'positive' : stats.avgGSS >= 3 ? 'neutral' : 'negative'}
        Icon={Star}
      />
    </div>
  );
}