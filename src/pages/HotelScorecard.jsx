import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, ChevronRight } from 'lucide-react';
import { formatBrandLabel } from '@/lib/portfolioHelpers';
import ScoreGauge from '@/components/scorecard/ScoreGauge';
import KpiRow from '@/components/scorecard/KpiRow';
import KickerBadge from '@/components/scorecard/KickerBadge';
import SeedOnMount from '../components/SeedOnMount';

import { calculateScorecard, MONTHS, getQuarterFromMonth, aggregateEntries } from '../lib/scoring';
import { useTimePeriod } from '@/lib/TimePeriodContext';

function YoyMetric({ label, value, decimals = 1 }) {
  if (value == null) return <div className="text-muted-foreground text-xs">—</div>;
  const pos = value >= 0;
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">{label}</span>
      <span className="text-sm font-bold" style={{ color: pos ? '#4CAF50' : '#ef4444' }}>
        {pos ? '+' : ''}{value.toFixed(decimals)}
      </span>
    </div>
  );
}

export default function HotelScorecard() {
  const { selectedMonth, selectedYear, periodType } = useTimePeriod();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

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
  
  // YOY calculations
  const yoyGopDollars = (activeEntry.budgeted_gop_actual != null && activeEntry.budgeted_gop_prior != null)
    ? activeEntry.budgeted_gop_actual - activeEntry.budgeted_gop_prior
    : null;
  const yoyGopPct = (activeEntry.budgeted_gop_actual != null && activeEntry.budgeted_gop_prior != null && activeEntry.budgeted_gop_prior !== 0)
    ? ((activeEntry.budgeted_gop_actual - activeEntry.budgeted_gop_prior) / Math.abs(activeEntry.budgeted_gop_prior)) * 100
    : null;
  const yoyMargin = (activeEntry.gop_margin_actual != null && activeEntry.gop_margin_prior != null)
    ? activeEntry.gop_margin_actual - activeEntry.gop_margin_prior
    : null;
  const yoyRpi = activeEntry.revpar_index_change;
  const yoyGss = (activeEntry.gss_actual != null && activeEntry.gss_prior != null)
    ? activeEntry.gss_actual - activeEntry.gss_prior
    : null;

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
          return `${variance >= 0 ? '+' : ''}$${(variance / 1000).toFixed(0)}K vs Budget`;
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
      ytdActual: activeEntry.revpar_index_change != null
        ? `${activeEntry.revpar_index_change >= 0 ? '+' : ''}${activeEntry.revpar_index_change.toFixed(2)}%`
        : '—',
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
              <span>Hotel Performance Scorecard</span>
            </div>
            <h1 className="text-2xl font-bold">Hotel Performance Scorecard</h1>
            <p className="text-white/60 text-xs mt-0.5">Detailed per-hotel KPI scorecard — GOP, margin, RGI, and GSS</p>
            {selectedProperty && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-white/70 text-sm">{selectedProperty.name}</span>
                <span className="text-white/40">·</span>
                <span className="text-white/70 text-sm">{selectedProperty.city}, {selectedProperty.state}</span>
                {selectedProperty.parent_brand && (
                  <>
                    <span className="text-white/40">·</span>
                    <span className="text-white/60 text-sm">
                      {formatBrandLabel(selectedProperty.parent_brand, selectedProperty.sub_brand)}
                    </span>
                  </>
                )}
                {selectedProperty.gm_name && (
                  <>
                    <span className="text-white/40">·</span>
                    <User className="w-3.5 h-3.5 text-white/60" />
                    <span className="text-white/70 text-sm">GM: {selectedProperty.gm_name}</span>
                  </>
                )}
              </div>
            )}
          </div>

          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-72 bg-white/10 border-white/20 text-white">
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

      {!selectedProperty ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-1">Select a Property</h3>
          <p className="text-muted-foreground text-sm">Choose a hotel from the dropdown to view its scorecard.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* YOY Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GOP Performance YOY</div>
              <div>
                <div className="text-2xl font-black" style={{ color: yoyGopDollars == null ? undefined : yoyGopDollars >= 0 ? '#4CAF50' : '#ef4444' }}>
                  {yoyGopDollars != null ? `${yoyGopDollars >= 0 ? '+' : ''}$${(yoyGopDollars / 1000).toFixed(0)}K` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Dollar Change</div>
              </div>
              <div className="flex gap-4 pt-1 border-t border-border">
                <YoyMetric label="% Change" value={yoyGopPct} decimals={1} />
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GOP Margin YOY</div>
              <div>
                <div className="text-2xl font-black" style={{ color: yoyMargin == null ? undefined : yoyMargin >= 0 ? '#4CAF50' : '#ef4444' }}>
                  {yoyMargin != null ? `${yoyMargin >= 0 ? '+' : ''}${yoyMargin.toFixed(1)} pts` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Point Change</div>
              </div>
              <div className="flex gap-4 pt-1 border-t border-border">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">TY vs PY</span>
                  <span className="text-sm font-bold text-foreground">{activeEntry.gop_margin_actual != null ? activeEntry.gop_margin_actual.toFixed(1) + '%' : '—'} vs {activeEntry.gop_margin_prior != null ? activeEntry.gop_margin_prior.toFixed(1) + '%' : '—'}</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">RevPAR Index YOY</div>
              <div>
                <div className="text-2xl font-black" style={{ color: yoyRpi == null ? undefined : yoyRpi >= 0 ? '#4CAF50' : '#ef4444' }}>
                  {yoyRpi != null ? `${yoyRpi >= 0 ? '+' : ''}${yoyRpi.toFixed(2)}%` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">% Change</div>
              </div>
              <div className="flex gap-4 pt-1 border-t border-border">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">TY Index</span>
                  <span className="text-sm font-bold text-foreground">{activeEntry.revpar_index != null ? activeEntry.revpar_index.toFixed(1) : '—'}</span>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GSS Score YOY</div>
              <div>
                <div className="text-2xl font-black" style={{ color: yoyGss == null ? undefined : yoyGss >= 0 ? '#4CAF50' : '#ef4444' }}>
                  {yoyGss != null ? `${yoyGss >= 0 ? '+' : ''}${yoyGss.toFixed(1)}` : '—'}
                </div>
                <div className="text-xs text-muted-foreground">Point Change</div>
              </div>
              <div className="flex gap-4 pt-1 border-t border-border">
                <div className="flex flex-col">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wide">TY vs PY</span>
                  <span className="text-sm font-bold text-foreground">{activeEntry.gss_actual != null ? activeEntry.gss_actual.toFixed(1) : '—'} vs {activeEntry.gss_prior != null ? activeEntry.gss_prior.toFixed(1) : '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Scorecard Grid */}
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
              <p className="text-xs text-muted-foreground mt-0.5">{selectedProperty.name} · {formatBrandLabel(selectedProperty.parent_brand, selectedProperty.sub_brand)}</p>
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
        </div>
      )}
    </div>
  );
}