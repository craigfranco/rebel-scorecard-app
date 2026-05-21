import React, { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

const BRAND_COLORS = {
  Marriott: '#CC2031',
  Hilton: '#00205B',
  IHG: '#003087',
  Hyatt: '#4B3832',
  'Choice Hotels': '#F7941D',
  Independent: '#4B5563',
};

function getBrandColor(brand) {
  return BRAND_COLORS[brand] || '#4B5563';
}

function PassBadge({ pass, incomplete, label }) {
  if (incomplete) return <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">N/A</span>;
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-bold text-white"
      style={{ backgroundColor: pass ? '#4CAF50' : '#ef4444' }}
    >
      {pass ? '✓' : '✗'} {label || (pass ? 'PASS' : 'FAIL')}
    </span>
  );
}

function ScoreBar({ score, max = 100 }) {
  const pct = max > 0 ? Math.min((score / max) * 100, 100) : 0;
  const color = score >= 80 ? '#4CAF50' : score >= 60 ? '#F59E0B' : '#ef4444';
  return (
    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function EditableField({ value, onSave, placeholder, multiline }) {
  const [editing, setEditing] = useState(false);
  const [localVal, setLocalVal] = useState(value || '');
  const ref = useRef(null);

  const handleBlur = () => {
    setEditing(false);
    if (localVal !== (value || '')) onSave(localVal);
  };

  const handleClick = () => {
    setEditing(true);
    setLocalVal(value || '');
    setTimeout(() => ref.current?.focus(), 0);
  };

  if (editing) {
    const props = {
      ref,
      value: localVal,
      onChange: e => setLocalVal(e.target.value),
      onBlur: handleBlur,
      className: 'w-full text-sm border border-primary/40 rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white resize-none',
    };
    return multiline
      ? <textarea {...props} rows={3} />
      : <input {...props} />;
  }

  return (
    <div
      onClick={handleClick}
      className="text-sm text-foreground cursor-text min-h-[2rem] p-1 rounded hover:bg-muted/50 transition-colors"
    >
      {value
        ? <span>{value}</span>
        : <span className="text-muted-foreground italic">{placeholder}</span>
      }
    </div>
  );
}

export default function HotelScorecardRow({ property, entry, scorecard, trend, rank, totalCount }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const brandColor = getBrandColor(property.parent_brand);

  const hasData = !!entry && !!scorecard;
  const anyIncomplete = hasData && [scorecard.gop, scorecard.gopMargin, scorecard.rgi, scorecard.gss].some(k => k?.incomplete);
  const totalScore = hasData && !anyIncomplete ? scorecard.total.total : null;
  const isTopPerformer = rank <= 3 && totalScore != null;
  const isBottomPerformer = rank > totalCount - 3 && totalScore != null;

  const accentColor = isTopPerformer ? '#F59E0B' : isBottomPerformer ? '#ef4444' : brandColor;

  const forecastHit = entry?.forecast_result === 'Hit';
  const forecastMiss = entry?.forecast_result === 'Miss';
  const forecastVariance = (entry?.forecast_actual_revenue != null && entry?.forecast_primary_forecast != null)
    ? entry.forecast_actual_revenue - entry.forecast_primary_forecast
    : null;

  const saveField = async (field, value) => {
    if (!entry?.id) return;
    await base44.entities.ScoreEntry.update(entry.id, { [field]: value });
    queryClient.invalidateQueries({ queryKey: ['all-entries'] });
  };

  const scoreColor = totalScore == null ? '#94a3b8' : totalScore >= 80 ? '#4CAF50' : totalScore >= 60 ? '#F59E0B' : '#ef4444';

  return (
    <div
      className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      style={{ borderLeft: `4px solid ${accentColor}` }}
    >
      {/* Compact Row */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-gray-50/80 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        {/* Rank */}
        <div className="w-6 text-center text-xs font-bold text-muted-foreground shrink-0">{rank}</div>

        {/* Hotel Name + GM */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-base font-bold text-foreground truncate">{property.name}</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-semibold shrink-0"
              style={{ backgroundColor: `${brandColor}18`, color: brandColor }}
            >
              {property.parent_brand || '—'}
            </span>
            {/* Trend */}
            {trend === 'up' && <ArrowUp className="w-4 h-4 text-green-500 shrink-0" />}
            {trend === 'down' && <ArrowDown className="w-4 h-4 text-red-500 shrink-0" />}
            {trend === 'flat' && <Minus className="w-4 h-4 text-gray-400 shrink-0" />}
          </div>
          {property.gm_name && (
            <div className="text-xs text-muted-foreground mt-0.5">GM: {property.gm_name}</div>
          )}
        </div>

        {/* KPI Badges */}
        {hasData && (
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            <PassBadge pass={scorecard.gop.pass} incomplete={scorecard.gop.incomplete} label="GOP" />
            <PassBadge pass={scorecard.rgi.pass} incomplete={scorecard.rgi.incomplete} label="RPI" />
            <PassBadge pass={scorecard.gss.pass} incomplete={scorecard.gss.incomplete} label="GSS" />
          </div>
        )}

        {/* Forecast */}
        <div className="hidden md:block shrink-0 text-center w-28">
          {entry?.forecast_result ? (
            <div>
              <span className={`text-xs font-bold ${forecastHit ? 'text-green-600' : 'text-red-500'}`}>
                {forecastHit ? '✓ HIT' : '✗ MISS'}
              </span>
              {forecastVariance != null && (
                <div className="text-xs font-semibold mt-0.5" style={{ color: forecastVariance >= 0 ? '#4CAF50' : '#ef4444' }}>
                  {forecastVariance >= 0 ? '+' : ''}${(forecastVariance / 1000).toFixed(0)}K
                </div>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        {/* Score */}
        <div className="shrink-0 w-24 text-right">
          {totalScore != null ? (
            <div>
              <div className="text-xl font-black" style={{ color: scoreColor }}>{totalScore}<span className="text-xs font-normal text-muted-foreground">/100</span></div>
              <div className="mt-1">
                <ScoreBar score={totalScore} max={100} />
              </div>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">No data</span>
          )}
        </div>

        {/* Expand toggle */}
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {/* Expanded Panel */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-5 space-y-5">
          {!hasData ? (
            <p className="text-sm text-muted-foreground text-center py-4">No scorecard data for this period.</p>
          ) : (
            <>
              {/* Score breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Budgeted GOP', score: scorecard.gop.score, max: 35, pass: scorecard.gop.pass, incomplete: scorecard.gop.incomplete },
                  { label: 'GOP Margin', score: scorecard.gopMargin.score, max: 35, pass: scorecard.gopMargin.pass, incomplete: scorecard.gopMargin.incomplete },
                  { label: 'RevPAR Index', score: scorecard.rgi.score, max: 15, pass: scorecard.rgi.pass, incomplete: scorecard.rgi.incomplete },
                  { label: 'GSS', score: scorecard.gss.score, max: 15, pass: scorecard.gss.pass, incomplete: scorecard.gss.incomplete },
                ].map(k => (
                  <div key={k.label} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                    <div className="text-xs text-muted-foreground font-medium mb-1">{k.label}</div>
                    {k.incomplete ? (
                      <div className="text-sm text-muted-foreground font-semibold">No data</div>
                    ) : (
                      <>
                        <div className="text-lg font-black" style={{ color: k.pass ? '#4CAF50' : '#ef4444' }}>
                          {k.score}<span className="text-xs font-normal text-muted-foreground">/{k.max}</span>
                        </div>
                        <ScoreBar score={k.score} max={k.max} />
                      </>
                    )}
                  </div>
                ))}
              </div>

              {/* KPI detail table */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-muted-foreground uppercase tracking-wide border-b border-gray-100">
                      <th className="py-2 px-4 text-left font-semibold">KPI</th>
                      <th className="py-2 px-4 text-center font-semibold">Actual</th>
                      <th className="py-2 px-4 text-center font-semibold">Target / Prior</th>
                      <th className="py-2 px-4 text-center font-semibold">Score</th>
                      <th className="py-2 px-4 text-center font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <KpiDetailRow
                      label="Budgeted GOP"
                      actual={(entry.budgeted_gop_actual != null && entry.budgeted_gop_target != null && entry.budgeted_gop_target !== 0)
                        ? `${(entry.budgeted_gop_actual / entry.budgeted_gop_target * 100).toFixed(1)}% ($${(entry.budgeted_gop_actual/1000).toFixed(0)}K)`
                        : '—'}
                      target={entry.budgeted_gop_target != null ? `Budget: $${(entry.budgeted_gop_target/1000).toFixed(0)}K` : '—'}
                      score={scorecard.gop.score}
                      max={35}
                      pass={scorecard.gop.pass}
                      incomplete={scorecard.gop.incomplete}
                    />
                    <KpiDetailRow
                      label="GOP Margin"
                      actual={entry.gop_margin_actual != null ? `${entry.gop_margin_actual.toFixed(1)}%` : '—'}
                      target={entry.gop_margin_prior != null ? `PY: ${entry.gop_margin_prior.toFixed(1)}%` : '—'}
                      score={scorecard.gopMargin.score}
                      max={35}
                      pass={scorecard.gopMargin.pass}
                      incomplete={scorecard.gopMargin.incomplete}
                    />
                    <KpiDetailRow
                      label="RevPAR Index"
                      actual={entry.revpar_index != null ? `Index: ${entry.revpar_index.toFixed(1)}` : '—'}
                      target={entry.revpar_index_change != null
                        ? `${entry.revpar_index_change >= 0 ? '+' : ''}${entry.revpar_index_change.toFixed(2)}% YOY`
                        : '—'}
                      score={scorecard.rgi.score}
                      max={15}
                      pass={scorecard.rgi.pass}
                      incomplete={scorecard.rgi.incomplete}
                    />
                    <KpiDetailRow
                      label={`GSS (${scorecard.gssStd.label})`}
                      actual={entry.gss_actual != null ? `${entry.gss_actual} / ${scorecard.gssStd.scale}` : '—'}
                      target={entry.gss_prior != null ? `PY: ${entry.gss_prior} / ${scorecard.gssStd.scale}` : '—'}
                      score={scorecard.gss.score}
                      max={15}
                      pass={scorecard.gss.pass}
                      incomplete={scorecard.gss.incomplete}
                    />
                  </tbody>
                </table>
              </div>

              {/* Forecast Accuracy + Kickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Forecast Accuracy</div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Actual Revenue</span>
                      <span className="font-semibold">{entry.forecast_actual_revenue != null ? `$${(entry.forecast_actual_revenue/1000).toFixed(0)}K` : '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Primary Forecast</span>
                      <span className="font-semibold">{entry.forecast_primary_forecast != null ? `$${(entry.forecast_primary_forecast/1000).toFixed(0)}K` : '—'}</span>
                    </div>
                    {forecastVariance != null && (
                      <div className="flex justify-between border-t border-gray-100 pt-2">
                        <span className="text-muted-foreground">$ Variance</span>
                        <span className="font-bold" style={{ color: forecastVariance >= 0 ? '#4CAF50' : '#ef4444' }}>
                          {forecastVariance >= 0 ? '+' : ''}${(forecastVariance/1000).toFixed(0)}K
                          {entry.forecast_primary_forecast > 0 && (
                            <span className="text-xs ml-1">
                              ({forecastVariance >= 0 ? '+' : ''}{(forecastVariance / entry.forecast_primary_forecast * 100).toFixed(1)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    )}
                    {entry.forecast_result && (
                      <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                        <span className="text-muted-foreground">Result</span>
                        <span className={`font-bold text-sm ${entry.forecast_result === 'Hit' ? 'text-green-600' : 'text-red-500'}`}>
                          {entry.forecast_result === 'Hit' ? '✓ HIT' : '✗ MISS'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Kicker Status</div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Forecast Kicker</span>
                      <PassBadge pass={entry.forecast_kicker || false} incomplete={entry.forecast_kicker == null} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Red Zone Kicker</span>
                      {property.parent_brand === 'Independent'
                        ? <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 font-semibold">N/A</span>
                        : <PassBadge pass={entry.red_zone_kicker || false} incomplete={entry.red_zone_kicker == null} />
                      }
                    </div>
                  </div>
                </div>
              </div>

              {/* Narrative fields */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Notes & Narrative</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <NarrativeField label="Key Wins" value={entry.key_wins} onSave={v => saveField('key_wins', v)} placeholder="Click to add key wins..." multiline />
                  <NarrativeField label="Previous Results" value={entry.previous_results} onSave={v => saveField('previous_results', v)} placeholder="Click to add previous results..." multiline />
                  <NarrativeField label="Next Priorities" value={entry.next_priorities} onSave={v => saveField('next_priorities', v)} placeholder="Click to add next priorities..." multiline />
                  <div className="grid grid-cols-2 gap-3">
                    <NarrativeField label="Prepared By" value={entry.prepared_by} onSave={v => saveField('prepared_by', v)} placeholder="Name..." />
                    <NarrativeField label="Reviewed By" value={entry.reviewed_by} onSave={v => saveField('reviewed_by', v)} placeholder="Name..." />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function KpiDetailRow({ label, actual, target, score, max, pass, incomplete }) {
  return (
    <tr className="border-b border-gray-50">
      <td className="py-2.5 px-4 font-medium text-foreground">{label}</td>
      <td className="py-2.5 px-4 text-center font-semibold">{actual}</td>
      <td className="py-2.5 px-4 text-center text-muted-foreground">{target}</td>
      <td className="py-2.5 px-4 text-center font-bold">
        {incomplete ? '—' : `${score}/${max}`}
      </td>
      <td className="py-2.5 px-4 text-center">
        <PassBadge pass={pass} incomplete={incomplete} />
      </td>
    </tr>
  );
}

function NarrativeField({ label, value, onSave, placeholder, multiline }) {
  return (
    <div>
      <div className="text-xs font-semibold text-muted-foreground mb-1">{label}</div>
      <EditableField value={value} onSave={onSave} placeholder={placeholder} multiline={multiline} />
    </div>
  );
}