import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, ChevronRight } from 'lucide-react';
import ScoreGauge from '@/components/scorecard/ScoreGauge';
import KpiRow from '@/components/scorecard/KpiRow';
import KickerBadge from '@/components/scorecard/KickerBadge';

import { calculateScorecard, MONTHS, getQuarterFromMonth, aggregateEntries } from '../lib/scoring';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import SeedOnMount from '../components/SeedOnMount';

import ExecutiveSummaryBar from '@/components/dashboard/ExecutiveSummaryBar';
import AttentionNeeded from '@/components/dashboard/AttentionNeeded';
import PerformanceHeatMap from '@/components/dashboard/PerformanceHeatMap';
import DataCompletenessIndicator from '@/components/dashboard/DataCompletenessIndicator';
import ForecastKickerTracker from '@/components/dashboard/ForecastKickerTracker';

export default function Dashboard() {
  const { selectedMonth, selectedYear, periodType, getPeriodMonths } = useTimePeriod();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [kpiInputs, setKpiInputs] = useState({
    budgeted_gop_actual: '', budgeted_gop_target: '', budgeted_gop_prior: '',
    gop_margin_actual: '', gop_margin_prior: '',
    revpar_index_change: '', revpar_index: '', revpar_index_prior: '',
    gss_actual: '', gss_prior: '',
  });

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  // All entries for the current year (for portfolio panels)
  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', selectedYear],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: selectedYear }),
  });

  // Entries for the selected property
  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries', selectedPropertyId, selectedYear],
    queryFn: () =>
      selectedPropertyId
        ? base44.entities.ScoreEntry.filter({ property_id: selectedPropertyId, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!selectedPropertyId,
  });

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  const activeEntry = aggregateEntries(entries, periodType, selectedMonth, selectedYear) || {};
  const scorecard = selectedProperty ? calculateScorecard(activeEntry, selectedProperty) : null;

  useEffect(() => {
    if (activeEntry) {
      setKpiInputs({
        budgeted_gop_actual: activeEntry.budgeted_gop_actual != null ? String(activeEntry.budgeted_gop_actual) : '',
        budgeted_gop_target: activeEntry.budgeted_gop_target != null ? String(activeEntry.budgeted_gop_target) : '',
        budgeted_gop_prior:  activeEntry.budgeted_gop_prior  != null ? String(activeEntry.budgeted_gop_prior)  : '',
        gop_margin_actual:   activeEntry.gop_margin_actual   != null ? String(activeEntry.gop_margin_actual)   : '',
        gop_margin_prior:    activeEntry.gop_margin_prior    != null ? String(activeEntry.gop_margin_prior)    : '',
        revpar_index_change: activeEntry.revpar_index_change != null ? String(activeEntry.revpar_index_change) : '',
        revpar_index:        activeEntry.revpar_index        != null ? String(activeEntry.revpar_index)        : '',
        revpar_index_prior:  activeEntry.revpar_index_prior  != null ? String(activeEntry.revpar_index_prior)  : '',
        gss_actual:          activeEntry.gss_actual          != null ? String(activeEntry.gss_actual)          : '',
        gss_prior:           activeEntry.gss_prior           != null ? String(activeEntry.gss_prior)           : '',
      });
    }
  }, [selectedPropertyId, selectedMonth, selectedYear, entries.length]);

  useEffect(() => {
    if (properties.length && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties]);

  const kpiRows = scorecard ? [
    {
      measure: 'Budgeted GOP',
      weight: '35%',
      target: activeEntry.budgeted_gop_target != null ? `Budget: $${(activeEntry.budgeted_gop_target / 1000).toFixed(0)}K` : 'Budget',
      actual: (() => {
        const a = activeEntry.budgeted_gop_actual;
        const b = activeEntry.budgeted_gop_target;
        return (a != null && b != null && b !== 0) ? `${(a / b * 100).toFixed(1)}% of Budget` : '—';
      })(),
      ytdActual: (() => {
        const a = activeEntry.budgeted_gop_actual;
        const b = activeEntry.budgeted_gop_target;
        if (a != null && b != null && b !== 0) {
          const variance = a - b;
          const sign = variance >= 0 ? '+' : '';
          return `${sign}$${(variance / 1000).toFixed(0)}K vs Budget`;
        }
        return '—';
      })(),
      score: scorecard.gop.score,
      maxScore: 35,
      pass: scorecard.gop.pass,
      incomplete: scorecard.gop.incomplete,
    },
    {
      measure: 'GOP Margin Improvement',
      weight: '35%',
      target: activeEntry.gop_margin_budget != null ? `Budget: ${activeEntry.gop_margin_budget}%` : '+0.1% vs Budget',
      actual: activeEntry.gop_margin_actual != null ? `${activeEntry.gop_margin_actual}%` : '—',
      ytdActual: (() => {
        const a = activeEntry.gop_margin_actual;
        const b = activeEntry.gop_margin_budget;
        if (a != null && b != null) {
          const v = (a - b).toFixed(1);
          return `${v >= 0 ? '+' : ''}${v}% vs Budget`;
        }
        if (activeEntry.gop_margin_prior != null) return `PY: ${activeEntry.gop_margin_prior}%`;
        return '—';
      })(),
      score: scorecard.gopMargin.score,
      maxScore: 35,
      pass: scorecard.gopMargin.pass,
      incomplete: scorecard.gopMargin.incomplete,
    },
    {
      measure: 'RevPAR Index % Change (STR RGI)',
      weight: '15%',
      target: '0.1%-2.0% partial / 2.1%+ full',
      actual: activeEntry.revpar_index != null ? `Index: ${activeEntry.revpar_index.toFixed(1)}` : '—',
      ytdActual: activeEntry.revpar_index_change != null ? `${activeEntry.revpar_index_change >= 0 ? '+' : ''}${activeEntry.revpar_index_change.toFixed(2)}%` : '—',
      score: scorecard.rgi.score,
      maxScore: 15,
      pass: scorecard.rgi.pass,
      incomplete: scorecard.rgi.incomplete,
    },
    {
      measure: `GSS — ${scorecard.gssStd.label}`,
      weight: '15%',
      target: `+${scorecard.gssStd.target} YOY`,
      actual: activeEntry.gss_actual != null ? `${activeEntry.gss_actual} /${scorecard.gssStd.scale}` : '—',
      ytdActual: activeEntry.gss_prior != null ? `PY: ${activeEntry.gss_prior} /${scorecard.gssStd.scale}` : '—',
      score: scorecard.gss.score,
      maxScore: 15,
      pass: scorecard.gss.pass,
      incomplete: scorecard.gss.incomplete,
    },
  ] : [];

  const portfolioProps = { properties, allEntries, getPeriodMonths, selectedYear, periodType, selectedMonth };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <SeedOnMount />

      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <span>Balanced Scorecard</span>
              <ChevronRight className="w-3 h-3" />
              <span>Dashboard</span>
            </div>
            <h1 className="text-2xl font-bold">Hotel Performance Scorecard</h1>
            <p className="text-white/60 text-xs mt-0.5">Track GOP, margin, RGI, and GSS performance across your portfolio</p>
          </div>
        </div>
      </div>

      {/* ── PORTFOLIO PANELS ── */}
      <ExecutiveSummaryBar {...portfolioProps} />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <AttentionNeeded {...portfolioProps} />
        <ForecastKickerTracker {...portfolioProps} />
      </div>

      <PerformanceHeatMap {...portfolioProps} />

      <DataCompletenessIndicator {...portfolioProps} />

      {/* ── DIVIDER ── */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Property Drilldown</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      {/* Property selector */}
      <div className="bg-card rounded-2xl border border-border p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            {selectedProperty ? (
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <div className="font-semibold text-foreground">{selectedProperty.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {selectedProperty.city}, {selectedProperty.state}
                    {selectedProperty.parent_brand && ` · ${selectedProperty.parent_brand}${selectedProperty.sub_brand ? ` — ${selectedProperty.sub_brand}` : ''}`}
                    {selectedProperty.gm_name && ` · GM: ${selectedProperty.gm_name}`}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Select a property to view its individual scorecard</p>
            )}
          </div>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue placeholder="Select property..." />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.city}, {p.state}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProperty && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Gauge */}
          <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col items-center justify-center gap-4">
            <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Overall Score</h2>
            {scorecard && <ScoreGauge score={scorecard.total.total} pass={scorecard.total.pass} />}
            <div className="w-full space-y-2">
              <KickerBadge type="forecast" hit={activeEntry.forecast_kicker || false} forecastValue={activeEntry.forecast_primary_forecast} />
              <KickerBadge type="redzone" hit={activeEntry.red_zone_kicker || false} />
            </div>
          </div>

          {/* KPI Table */}
          <div className="lg:col-span-3 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground">
                KPI Scorecard — {periodType === 'quarter' ? `Q${getQuarterFromMonth(selectedMonth)}` : MONTHS[selectedMonth - 1]} {selectedYear}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedProperty.name} · {selectedProperty.parent_brand}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="py-3 px-4 text-left font-semibold">Measure</th>
                    <th className="py-3 px-4 text-center font-semibold">Weight</th>
                    <th className="py-3 px-4 text-center font-semibold">Target</th>
                    <th className="py-3 px-4 text-center font-semibold">Actual</th>
                    <th className="py-3 px-4 text-center font-semibold">Variance</th>
                    <th className="py-3 px-4 text-center font-semibold">Score</th>
                    <th className="py-3 px-4 text-center font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiRows.map((row, i) => (
                    <KpiRow key={i} {...row} />
                  ))}
                </tbody>
                {scorecard && (() => {
                  const anyIncomplete = kpiRows.some(r => r.incomplete);
                  return (
                    <tfoot>
                      <tr style={{ backgroundColor: '#2d4b5e' }}>
                        <td colSpan={5} className="py-3 px-4 font-bold text-white text-sm">Total Score</td>
                        <td className="py-3 px-4 text-center font-black text-white text-lg">
                          {anyIncomplete ? '—' : scorecard.total.total}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {anyIncomplete ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-white/20 text-white">
                              INCOMPLETE
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold text-white"
                              style={{ backgroundColor: scorecard.total.pass ? '#4CAF50' : '#ef4444' }}
                            >
                              {scorecard.total.pass ? '✓ PASS' : '✗ FAIL'}
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  );
                })()}
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}