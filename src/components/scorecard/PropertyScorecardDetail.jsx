import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { User, Download, X, ShieldAlert, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ScoreGauge from '@/components/scorecard/ScoreGauge';
import KpiRow from '@/components/scorecard/KpiRow';
import KickerBadge from '@/components/scorecard/KickerBadge';
import KeyWinsSection from '@/components/scorecard/KeyWinsSection';
import { generateScorecardPDF } from '@/components/scorecard/ScorecardPdfExport';
import { formatBrandLabel } from '@/lib/portfolioHelpers';
import {
  calculateScorecard,
  MONTHS,
  getQuarterFromMonth,
  aggregateEntries,
  hasForecastData,
  normalizeGssTo100,
  MARGIN_TARGET_IMPROVEMENT,
} from '@/lib/scoring';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { useUserProfile } from '@/lib/UserProfileContext';
import BonusExceptionModal from '@/components/scorecard/BonusExceptionModal';

/**
 * PropertyScorecardDetail
 * Shared detail view used by both HotelScorecard and AllProperties.
 *
 * Props:
 *  - property: Property object (required)
 *  - onClose: optional callback — if provided, a close (×) button is rendered (drawer mode)
 *  - showPropertySelector: if true, renders the property dropdown (HotelScorecard mode)
 *  - properties: array of properties for the selector
 *  - selectedPropertyId / onPropertyChange: controlled selector state
 */
export default function PropertyScorecardDetail({
  property,
  onClose,
  showPropertySelector = false,
  properties = [],
  selectedPropertyId,
  onPropertyChange,
}) {
  const { selectedMonth, selectedYear, periodType } = useTimePeriod();
  const { isAdmin } = useUserProfile();
  const [showExceptionModal, setShowExceptionModal] = useState(false);

  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries', property?.id, selectedYear],
    queryFn: () =>
      property?.id
        ? base44.entities.ScoreEntry.filter({ property_id: property.id, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!property?.id,
  });

  const { data: bonusExceptions = [] } = useQuery({
    queryKey: ['bonus-exceptions', property?.id, selectedYear],
    queryFn: () =>
      property?.id
        ? base44.entities.BonusException.filter({ property_id: property.id, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!property?.id,
  });

  const { data: rgiQuarterlyReports = [] } = useQuery({
    queryKey: ['rgi-quarterly', selectedYear],
    queryFn: () => base44.entities.RgiQuarterlyReport.filter({ year: selectedYear }),
  });

  const activeEntry = aggregateEntries(entries, periodType, selectedMonth, selectedYear, rgiQuarterlyReports, bonusExceptions) || {};
  const scorecard = property ? calculateScorecard(activeEntry, property) : null;

  const yoyMargin = activeEntry.gop_margin_improvement != null
    ? activeEntry.gop_margin_improvement
    : (activeEntry.gop_margin_actual != null && activeEntry.gop_margin_prior != null
        ? activeEntry.gop_margin_actual - activeEntry.gop_margin_prior
        : null);

  const marginTy = activeEntry.gop_margin_actual;
  const marginPy = activeEntry.gop_margin_prior;

  const rgiChg = activeEntry.revpar_index_change;
  const rgiTy = activeEntry.revpar_index;
  const rgiLy = rgiTy != null && rgiChg != null ? rgiTy / (1 + rgiChg / 100) : null;

  const gssNorm = normalizeGssTo100(activeEntry.gss_actual, property?.parent_brand);
  const gssPriorNorm = normalizeGssTo100(activeEntry.gss_prior, property?.parent_brand);
  const gssVar = gssNorm != null && gssPriorNorm != null ? gssNorm - gssPriorNorm : null;

  const gopA = activeEntry.budgeted_gop_actual ?? null;
  const gopB = activeEntry.budgeted_gop_target ?? null;
  const gopVariance = gopA != null && gopB != null ? gopA - gopB : null;
  const gopPct =
    gopA != null && gopB != null && gopB !== 0
      ? gopB > 0
        ? (gopA / gopB) * 100
        : ((gopA - gopB) / Math.abs(gopB)) * 100
      : null;

  const kpiRows = scorecard
    ? [
        {
          measure: 'Budgeted GOP',
          weight: '35%',
          target: gopB != null ? `$${Math.round(gopB).toLocaleString('en-US')}` : '—',
          actual: null,
          ytdActual: null,
          gopActual: gopA,
          gopBudget: gopB,
          score: scorecard.gop.score,
          maxScore: 35,
          pass: scorecard.gop.pass,
          incomplete: scorecard.gop.incomplete,
        },
        {
          measure: 'GOP Margin Improvement',
          weight: '35%',
          target: marginPy != null ? (marginPy + MARGIN_TARGET_IMPROVEMENT).toFixed(1) + '%' : '—',
          targetLy: activeEntry.budgeted_gop_prior != null
            ? `$${Math.round(activeEntry.budgeted_gop_prior).toLocaleString('en-US')}`
            : (marginPy != null ? marginPy.toFixed(1) + '%' : '—'),
          actual: marginTy != null ? marginTy.toFixed(1) + '%' : '—',
          actualSub:
            activeEntry.budgeted_gop_actual != null
              ? `TY $${Math.round(activeEntry.budgeted_gop_actual).toLocaleString('en-US')}`
              : null,
          ytdActual: (() => {
            const diff = activeEntry.gop_margin_improvement != null
              ? activeEntry.gop_margin_improvement
              : (activeEntry.gop_margin_actual != null && activeEntry.gop_margin_prior != null
                  ? activeEntry.gop_margin_actual - activeEntry.gop_margin_prior
                  : null);
            if (diff != null) {
              const color = diff > MARGIN_TARGET_IMPROVEMENT ? '#4CAF50' : '#ef4444';
              return (
                <span style={{ color, fontWeight: 'bold' }}>
                  {diff >= 0 ? '+' : ''}
                  {diff.toFixed(1)} pts
                </span>
              );
            }
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
          target: rgiLy != null ? (rgiLy * 1.001).toFixed(1) : '—',
          targetLy: rgiLy != null ? rgiLy.toFixed(1) : '—',
          actual: rgiTy != null ? rgiTy.toFixed(1) : '—',
          ytdActual: (() => {
            if (rgiChg == null) return '—';
            const color = rgiChg >= 0.1 ? '#4CAF50' : '#ef4444';
            return (
              <span style={{ color, fontWeight: 'bold' }}>
                {rgiChg >= 0 ? '+' : ''}
                {rgiChg.toFixed(1)}%
              </span>
            );
          })(),
          score: scorecard.rgi.score,
          maxScore: 15,
          pass: scorecard.rgi.pass,
          incomplete: scorecard.rgi.incomplete,
        },
        (() => {
          const varColor = gssVar != null ? (gssVar > 0 ? '#4CAF50' : '#ef4444') : undefined;
          return {
            measure: `GSS — ${scorecard.gssStd.label}`,
            weight: '15%',
            target: gssPriorNorm != null ? '>' + gssPriorNorm.toFixed(1) : '—',
            targetLy: gssPriorNorm != null ? gssPriorNorm.toFixed(1) : '—',
            actual: gssNorm != null ? gssNorm.toFixed(1) : '—',
            ytdActual:
              gssVar != null ? (
                <span style={{ color: varColor, fontWeight: 'bold' }}>
                  {gssVar >= 0 ? '+' : ''}
                  {gssVar.toFixed(1)} pts
                </span>
              ) : (
                '—'
              ),
            score: scorecard.gss.score,
            maxScore: 15,
            pass: scorecard.gss.pass,
            incomplete: scorecard.gss.incomplete,
          };
        })(),
      ]
    : [];

  if (!property) {
    return (
      <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>
        <h3 className="font-semibold text-lg mb-1">Select a Property</h3>
        <p className="text-muted-foreground text-sm">Choose a hotel from the dropdown to view its scorecard.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <span>Balanced Scorecard</span>
              <span>›</span>
              <span>Hotel Performance Scorecard</span>
            </div>
            <h1 className="text-2xl font-bold">Hotel Performance Scorecard</h1>
            <p className="text-white/60 text-xs mt-0.5">Detailed per-hotel KPI scorecard — GOP, margin, RGI, and GSS</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-white/70 text-sm">{property.name}</span>
              <span className="text-white/40">·</span>
              <span className="text-white/70 text-sm">{property.city}, {property.state}</span>
              {property.parent_brand && (
                <>
                  <span className="text-white/40">·</span>
                  <span className="text-white/60 text-sm">{formatBrandLabel(property.parent_brand, property.sub_brand)}</span>
                </>
              )}
              {property.gm_name && (
                <>
                  <span className="text-white/40">·</span>
                  <User className="w-3.5 h-3.5 text-white/60" />
                  <span className="text-white/70 text-sm">GM: {property.gm_name}</span>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => generateScorecardPDF(property, activeEntry, periodType, selectedMonth, selectedYear)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold border border-white/20 transition-colors"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>

            {isAdmin && (
              <button
                onClick={() => setShowExceptionModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-semibold border border-white/20 transition-colors"
              >
                <ShieldAlert className="w-4 h-4" />
                Bonus Exceptions
                {bonusExceptions.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                    {bonusExceptions.length}
                  </span>
                )}
              </button>
            )}

            {showPropertySelector && (
              <Select value={selectedPropertyId} onValueChange={onPropertyChange}>
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
            )}

            {onClose && (
              <button
                onClick={onClose}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Bonus Exception Banner */}
      {bonusExceptions.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-900">
              Bonus Exception Active — {activeEntry.bonus_exceptions?.length || 0} approved add-back(s)
              {bonusExceptions.filter(e => e.status === 'Pending').length > 0 && (
                <span className="ml-2 text-amber-600 font-normal">+ {bonusExceptions.filter(e => e.status === 'Pending').length} pending</span>
              )}
            </p>
            {activeEntry.bonus_exceptions?.map((exc, i) => (
              <p key={i} className="text-xs text-amber-700 mt-1">
                <span className="font-semibold">${Math.round(exc.amount).toLocaleString('en-US')}</span> — {exc.category}: {exc.description}
              </p>
            ))}
            {activeEntry.bonus_exception_total != null && (
              <div className="flex gap-4 mt-2 pt-2 border-t border-amber-200 flex-wrap">
                <span className="text-xs text-amber-800 font-medium">
                  Adjusted GOP: ${Math.round(activeEntry.budgeted_gop_actual).toLocaleString('en-US')}
                </span>
                {activeEntry.budgeted_gop_actual_raw != null && (
                  <span className="text-xs text-amber-500">
                    (Raw: ${Math.round(activeEntry.budgeted_gop_actual_raw).toLocaleString('en-US')})
                  </span>
                )}
                {activeEntry.gop_margin_actual_raw != null && activeEntry.gop_margin_actual != null && (
                  <span className="text-xs text-amber-800 font-medium">
                    Adjusted Margin: {activeEntry.gop_margin_actual.toFixed(1)}%
                    <span className="text-amber-500 font-normal"> (Raw: {activeEntry.gop_margin_actual_raw.toFixed(1)}%)</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* YOY Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* GOP vs Budget */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GOP vs Budget</div>
          <div>
            {(() => {
              const pass = gopVariance != null ? gopA >= gopB : null;
              const color = pass == null ? undefined : pass ? '#4CAF50' : '#ef4444';
              return (
                <>
                  <div className="text-2xl font-black" style={{ color }}>
                    {gopVariance != null
                      ? `${gopVariance >= 0 ? '+' : '-'}$${Math.abs(Math.round(gopVariance)).toLocaleString('en-US')}`
                      : '—'}
                  </div>
                  <div className="text-xs text-muted-foreground">vs Budget</div>
                  <div className="flex gap-4 pt-1 border-t border-border mt-2">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Budget</span>
                      <span className="text-sm font-bold text-foreground">
                        {gopB != null ? `$${Math.round(gopB).toLocaleString('en-US')}` : '—'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Actual</span>
                      <span className="text-sm font-bold text-foreground">
                        {gopA != null ? `$${Math.round(gopA).toLocaleString('en-US')}` : '—'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Achievement</span>
                      <span className="text-sm font-bold" style={{ color }}>
                        {gopPct != null ? `${pass && gopPct > 0 ? '+' : ''}${gopPct.toFixed(1)}%` : '—'}
                      </span>
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* GOP Margin */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GOP Margin Improvement (vs LY)</div>
          <div>
            <div className="text-2xl font-black" style={{ color: yoyMargin == null ? undefined : yoyMargin > MARGIN_TARGET_IMPROVEMENT ? '#4CAF50' : '#ef4444' }}>
              {yoyMargin != null ? `${yoyMargin >= 0 ? '+' : ''}${yoyMargin.toFixed(1)} pts vs LY` : '—'}
            </div>
            <div className="text-xs text-muted-foreground">TY vs prior year margin</div>
          </div>
          <div className="flex gap-4 pt-1 border-t border-border">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">TY vs LY</span>
              <span className="text-sm font-bold text-foreground">
                {activeEntry.gop_margin_actual != null ? activeEntry.gop_margin_actual.toFixed(1) + '%' : '—'} TY vs{' '}
                {activeEntry.gop_margin_prior != null ? activeEntry.gop_margin_prior.toFixed(1) + '%' : '—'} LY
              </span>
            </div>
          </div>
        </div>

        {/* RGI */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">RevPAR Index YOY</div>
          <div>
            <div className="text-2xl font-black" style={{ color: rgiChg == null ? undefined : rgiChg >= 0.1 ? '#4CAF50' : '#ef4444' }}>
              {rgiChg != null ? `${rgiChg >= 0 ? '+' : ''}${rgiChg.toFixed(1)}%` : '—'}
            </div>
            <div className="text-xs text-muted-foreground">YOY Change</div>
          </div>
          <div className="flex gap-4 pt-1 border-t border-border flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">TY Index</span>
              <span className="text-sm font-bold text-foreground">{rgiTy != null ? rgiTy.toFixed(1) : '—'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">LY Index</span>
              <span className="text-sm font-bold text-foreground">{rgiLy != null ? rgiLy.toFixed(1) : '—'}</span>
            </div>
          </div>
        </div>

        {/* GSS */}
        <div className="bg-card rounded-2xl border border-border shadow-sm p-5 flex flex-col gap-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">GSS Score YOY</div>
          <div>
            <div className="text-2xl font-black" style={{ color: gssVar == null ? undefined : gssVar >= 0 ? '#4CAF50' : '#ef4444' }}>
              {gssVar != null ? `${gssVar >= 0 ? '+' : ''}${gssVar.toFixed(1)} pts` : '—'}
            </div>
            <div className="text-xs text-muted-foreground">Point Change (100-pt scale)</div>
          </div>
          <div className="flex gap-4 pt-1 border-t border-border">
            <div className="flex flex-col">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">TY vs LY</span>
              <span className="text-sm font-bold text-foreground">
                {gssNorm != null ? gssNorm.toFixed(1) : '—'} vs {gssPriorNorm != null ? gssPriorNorm.toFixed(1) : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Scorecard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Gauge */}
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm flex flex-col items-center justify-center gap-4">
          <h2 className="font-bold text-sm text-muted-foreground uppercase tracking-wide">Overall Score</h2>
          {scorecard && (
            <ScoreGauge
              score={scorecard.total.total}
              maxPossible={scorecard.total.maxPossible}
              gssIncomplete={scorecard.total.gssIncomplete}
            />
          )}
          <div className="w-full space-y-2">
            <KickerBadge
              type="forecast"
              hit={hasForecastData(activeEntry) ? (activeEntry.forecast_kicker || false) : false}
              missingData={!hasForecastData(activeEntry)}
            />
            <KickerBadge type="redzone" hit={activeEntry.red_zone_kicker || false} />
          </div>
        </div>

        {/* KPI Table */}
        <div className="lg:col-span-3 bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-bold text-foreground">
              KPI Scorecard — {periodType === 'quarter' ? `Q${getQuarterFromMonth(selectedMonth)}` : MONTHS[selectedMonth - 1]} {selectedYear}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {property.name} · {formatBrandLabel(property.parent_brand, property.sub_brand)}
            </p>
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
                const nonGssIncomplete = kpiRows
                  .filter(r => r.measure !== `GSS — ${scorecard.gssStd.label}`)
                  .some(r => r.incomplete);
                const { total, maxPossible, gssIncomplete } = scorecard.total;
                return (
                  <tfoot>
                    <tr style={{ backgroundColor: '#2d4b5e' }}>
                      <td colSpan={6} className="py-3 px-4 font-bold text-white text-sm">
                        Total Score
                        {gssIncomplete && (
                          <span className="ml-2 text-white/60 text-xs font-normal">(GSS N/A — max {maxPossible} pts)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center font-black text-white text-lg">
                        {nonGssIncomplete ? '—' : `${total}/${maxPossible}`}
                      </td>
                    </tr>
                  </tfoot>
                );
              })()}
            </table>
          </div>
        </div>
      </div>

      {/* Key Wins & Risks Section */}
      <KeyWinsSection
        property={property}
        entry={activeEntry}
        periodType={periodType}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {isAdmin && (
        <BonusExceptionModal
          open={showExceptionModal}
          onClose={() => setShowExceptionModal(false)}
          property={property}
          year={selectedYear}
        />
      )}
    </div>
  );
}