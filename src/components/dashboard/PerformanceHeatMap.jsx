import React from 'react';
import { Link } from 'react-router-dom';
import { getBrandColor } from '@/lib/portfolioHelpers';

function normalizeGss(score, brand) {
  if (score == null) return null;
  if (brand === 'Choice Hotels' || brand === 'Choice') return score * 10;
  if (brand === 'Independent') return score * 20;
  return score;
}

function cellStyle(value, type) {
  if (value == null) return { bg: '#f1f5f9', text: '#94a3b8', label: '—' };

  if (type === 'gop') {
    // value is achievement %
    if (value >= 100) return { bg: '#dcfce7', text: '#16a34a', label: `${value.toFixed(1)}%` };
    if (value >= 90) return { bg: '#fef3c7', text: '#92400e', label: `${value.toFixed(1)}%` };
    return { bg: '#fee2e2', text: '#dc2626', label: `${value.toFixed(1)}%` };
  }
  if (type === 'rpi') {
    if (value >= 100) return { bg: '#dcfce7', text: '#16a34a', label: value.toFixed(1) };
    if (value >= 90) return { bg: '#fef3c7', text: '#92400e', label: value.toFixed(1) };
    return { bg: '#fee2e2', text: '#dc2626', label: value.toFixed(1) };
  }
  if (type === 'gss') {
    // value is normalized /100
    if (value >= 70) return { bg: '#dcfce7', text: '#16a34a', label: value.toFixed(1) };
    if (value >= 60) return { bg: '#fef3c7', text: '#92400e', label: value.toFixed(1) };
    return { bg: '#fee2e2', text: '#dc2626', label: value.toFixed(1) };
  }
  return { bg: '#f1f5f9', text: '#94a3b8', label: '—' };
}

export default function PerformanceHeatMap({ properties, allEntries, getPeriodMonths, selectedYear }) {
  const periodMonths = getPeriodMonths();

  const rows = properties.map(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return { prop, gopPct: null, rpi: null, gss: null, issueCount: 0 };

    const latest = propEntries[propEntries.length - 1];
    const gopActual = propEntries.reduce((s, e) => s + (e.budgeted_gop_actual ?? 0), 0);
    const gopTarget = propEntries.reduce((s, e) => s + (e.budgeted_gop_target ?? 0), 0);

    const gopPct = gopTarget > 0 ? (gopActual / gopTarget) * 100 : null;
    const rpi = latest.revpar_index ?? null;
    const gss = normalizeGss(latest.gss_actual, prop.parent_brand);

    let issueCount = 0;
    if (gopPct != null && gopPct < 100) issueCount++;
    if (rpi != null && rpi < 100) issueCount++;
    if (gss != null && gss < 70) issueCount++;

    return { prop, gopPct, rpi, gss, issueCount };
  });

  // Sort: most issues first, then by name
  rows.sort((a, b) => b.issueCount - a.issueCount || a.prop.name.localeCompare(b.prop.name));

  const hasAnyData = rows.some(r => r.gopPct != null || r.rpi != null || r.gss != null);

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="font-bold text-foreground">Performance Heat Map</h2>
        <p className="text-xs text-muted-foreground mt-0.5">All hotels · color-coded by threshold — most issues shown first</p>
      </div>

      {!hasAnyData ? (
        <div className="px-6 py-8 text-center text-sm text-muted-foreground">No data for selected period.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-2.5 px-4 text-left font-semibold">Hotel</th>
                <th className="py-2.5 px-4 text-center font-semibold w-28">GOP vs Budget</th>
                <th className="py-2.5 px-4 text-center font-semibold w-24">RPI</th>
                <th className="py-2.5 px-4 text-center font-semibold w-24">GSS /100</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ prop, gopPct, rpi, gss }) => {
                const brandColor = getBrandColor(prop.parent_brand);
                const g = cellStyle(gopPct, 'gop');
                const r = cellStyle(rpi, 'rpi');
                const s = cellStyle(gss, 'gss');
                return (
                  <tr key={prop.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-7 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
                        <div>
                          <Link to={`/hotel/${prop.id}`} className="font-medium text-foreground hover:underline text-xs leading-tight block">
                            {prop.name}
                          </Link>
                          <span className="text-[10px] text-muted-foreground">{prop.parent_brand}</span>
                        </div>
                      </div>
                    </td>
                    {[g, r, s].map((cell, i) => (
                      <td key={i} className="py-2.5 px-4 text-center">
                        <span
                          className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold"
                          style={{ backgroundColor: cell.bg, color: cell.text }}
                        >
                          {cell.label}
                        </span>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="px-6 py-3 border-t border-border flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="font-semibold uppercase tracking-wide">Legend:</span>
        {[
          { bg: '#dcfce7', color: '#16a34a', label: 'On Track' },
          { bg: '#fef3c7', color: '#92400e', label: 'Watch (within 10%)' },
          { bg: '#fee2e2', color: '#dc2626', label: 'At Risk (>10% off)' },
        ].map(({ bg, color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded" style={{ backgroundColor: bg, border: `1px solid ${color}` }} />
            <span style={{ color }}>{label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}