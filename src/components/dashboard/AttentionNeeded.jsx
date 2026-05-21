import React from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getBrandColor } from '@/lib/portfolioHelpers';

function normalizeGss(score, brand) {
  if (score == null) return null;
  if (brand === 'Choice Hotels' || brand === 'Choice') return score * 10;
  if (brand === 'Independent') return score * 20;
  return score;
}

export default function AttentionNeeded({ properties, allEntries, getPeriodMonths, selectedYear }) {
  const periodMonths = getPeriodMonths();

  const flagged = [];

  properties.forEach(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return;

    const latest = propEntries[propEntries.length - 1];
    const gopActual = propEntries.reduce((s, e) => s + (e.budgeted_gop_actual ?? 0), 0);
    const gopTarget = propEntries.reduce((s, e) => s + (e.budgeted_gop_target ?? 0), 0);

    const issues = [];

    // GOP < 90% of budget
    if (gopTarget > 0 && gopActual / gopTarget < 0.90) {
      const pct = (gopActual / gopTarget * 100).toFixed(1);
      issues.push({ label: `GOP ${pct}% of budget`, severity: gopActual / gopTarget < 0.80 ? 'high' : 'med' });
    }

    // RPI below 85
    if (latest.revpar_index != null && latest.revpar_index < 85) {
      issues.push({ label: `RPI ${latest.revpar_index.toFixed(1)} (under-indexing)`, severity: 'high' });
    }

    // GSS declining
    const normAct = normalizeGss(latest.gss_actual, prop.parent_brand);
    const normPri = normalizeGss(latest.gss_prior, prop.parent_brand);
    if (normAct != null && normPri != null && normAct < normPri) {
      issues.push({ label: `GSS declining (${normAct.toFixed(1)} vs ${normPri.toFixed(1)} PY)`, severity: 'med' });
    }

    // Forecast kicker missed
    if (latest.forecast_kicker === false) {
      issues.push({ label: 'Forecast kicker missed', severity: 'med' });
    }

    if (issues.length > 0) flagged.push({ prop, issues });
  });

  // Sort: most issues first
  flagged.sort((a, b) => b.issues.length - a.issues.length);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-500" />
        <h2 className="font-bold text-foreground">Needs Attention</h2>
        {flagged.length > 0 && (
          <span className="ml-auto text-xs font-bold px-2.5 py-0.5 rounded-full bg-red-100 text-red-700">
            {flagged.length} {flagged.length === 1 ? 'hotel' : 'hotels'}
          </span>
        )}
      </div>

      {flagged.length === 0 ? (
        <div className="px-6 py-8 flex items-center gap-3 text-green-700">
          <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
          <span className="font-semibold text-sm">All properties on track for the selected period.</span>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {flagged.map(({ prop, issues }) => {
            const brandColor = getBrandColor(prop.parent_brand);
            return (
              <div key={prop.id} className="px-6 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
                  <Link to={`/hotel/${prop.id}`} className="font-semibold text-sm text-foreground hover:underline truncate">
                    {prop.name}
                  </Link>
                  <span className="text-xs text-muted-foreground shrink-0">{prop.city}, {prop.state}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {issues.map((issue, i) => (
                    <span
                      key={i}
                      className="text-xs font-medium px-2.5 py-0.5 rounded-full"
                      style={{
                        backgroundColor: issue.severity === 'high' ? '#fee2e2' : '#fef3c7',
                        color: issue.severity === 'high' ? '#dc2626' : '#92400e',
                      }}
                    >
                      {issue.label}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}