import React from 'react';

function fmt$(v) { return v == null ? '—' : '$' + Math.round(v).toLocaleString('en-US'); }

function scoreColor(total, max) {
  if (total == null || !max) return undefined;
  const pct = total / max;
  if (pct >= 0.7) return '#4CAF50';
  if (pct >= 0.5) return '#f59e0b';
  return '#ef4444';
}

const KPI_DEFS = [
  { key: 'gop', label: 'GOP', max: 35, color: '#10b981' },
  { key: 'gopMargin', label: 'GOP Margin', max: 35, color: '#3b82f6' },
  { key: 'rgi', label: 'RGI', max: 15, color: '#a855f7' },
  { key: 'gss', label: 'GSS', max: 15, color: '#f59e0b' },
];

function simpleAvg(items, fn) {
  const vals = items.map(fn).filter(v => v != null);
  return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

function weightedAvg(items, valFn, weightFn) {
  let acc = 0, wsum = 0;
  for (const it of items) {
    const v = valFn(it);
    const w = weightFn(it);
    if (v == null || !w) continue;
    acc += v * w; wsum += w;
  }
  return wsum ? acc / wsum : null;
}

function KpiScoreTile({ label, value, max, color }) {
  const pct = value != null && max ? (value / max) * 100 : 0;
  return (
    <div className="flex flex-col min-w-[88px]">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="flex items-baseline gap-1 mt-0.5">
        <span className="text-base font-bold text-foreground">{value != null ? value.toFixed(1) : '—'}</span>
        <span className="text-xs text-muted-foreground">/ {max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted mt-1 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
    </div>
  );
}

function ActualTile({ label, value, sub, foot, footColor }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</div>
      <div className="text-sm font-bold text-foreground mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      {foot && <div className="text-[11px] font-semibold mt-0.5" style={{ color: footColor }}>{foot}</div>}
    </div>
  );
}

export default function LeadershipGroupSummary({ rows }) {
  const withData = rows.filter(r => r.hasData);
  if (!withData.length) {
    return (
      <div className="px-6 py-4 border-b border-border bg-muted/20 text-sm text-muted-foreground italic">
        No data for this period.
      </div>
    );
  }

  const rooms = r => r.rooms || 0;

  // KPI score averages (simple mean across hotels with data)
  const kpiAvgs = {
    gop: simpleAvg(withData, r => r.sc?.gop?.score),
    gopMargin: simpleAvg(withData, r => r.sc?.gopMargin?.score),
    rgi: simpleAvg(withData, r => r.sc?.rgi?.score),
    gss: simpleAvg(withData, r => r.sc?.gss?.score),
  };
  const avgTotal = simpleAvg(withData, r => r.sc?.total?.total);
  const weightedTotal = weightedAvg(withData, r => r.sc?.total?.total, rooms) ?? avgTotal;

  // Actual KPI rollups
  const gopActual = withData.reduce((s, r) => s + (r.entry?.budgeted_gop_actual || 0), 0);
  const gopBudget = withData.reduce((s, r) => s + (r.entry?.budgeted_gop_target || 0), 0);
  const gopVar = gopActual - gopBudget;
  const gopVarPct = gopBudget > 0 ? (gopVar / gopBudget) * 100 : null;

  const marginActual = weightedAvg(withData, r => r.entry?.gop_margin_actual, rooms);
  const marginPrior = weightedAvg(withData, r => r.entry?.gop_margin_prior, rooms);
  const marginDelta = (marginActual != null && marginPrior != null) ? marginActual - marginPrior : null;

  const rgiIndex = weightedAvg(withData, r => r.entry?.revpar_index, rooms);
  const rgiChange = simpleAvg(withData, r => r.entry?.revpar_index_change);
  // LY RGI index: use stored prior value, else derive from current index and YOY change
  const rgiPrior = weightedAvg(withData, r => {
    const e = r.entry;
    if (e?.revpar_index_prior != null) return e.revpar_index_prior;
    if (e?.revpar_index != null && e?.revpar_index_change != null) {
      return e.revpar_index / (1 + e.revpar_index_change / 100);
    }
    return null;
  }, rooms);

  const gssActual = weightedAvg(withData, r => r.sc?.gss?.normActual, rooms);
  const gssPrior = weightedAvg(withData, r => r.sc?.gss?.normPrior, rooms);
  const gssDelta = (gssActual != null && gssPrior != null) ? gssActual - gssPrior : null;

  const withForecast = withData.filter(r => r.forecast != null);
  const forecastHits = withForecast.filter(r => r.forecast === true).length;
  const forecastRate = withForecast.length ? forecastHits / withForecast.length : null;

  const redZoneCompliant = withData.filter(r => r.redzone === true).length;
  const redZoneRate = withData.length ? redZoneCompliant / withData.length : null;

  return (
    <div className="px-6 py-4 border-b border-border bg-muted/10 space-y-4">
      {/* Score strip */}
      <div className="flex flex-wrap items-end gap-6">
        {KPI_DEFS.map(def => (
          <KpiScoreTile key={def.key} label={def.label} value={kpiAvgs[def.key]} max={def.max} color={def.color} />
        ))}
        <div className="ml-auto flex items-end gap-5">
          <div className="flex flex-col">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Avg Score</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-base font-bold" style={{ color: scoreColor(avgTotal, 100) }}>{avgTotal != null ? avgTotal.toFixed(1) : '—'}</span>
              <span className="text-xs text-muted-foreground">/ 100</span>
            </div>
          </div>
          <div className="flex flex-col px-4 py-2 rounded-xl bg-primary text-white shadow-sm">
            <div className="text-[10px] uppercase tracking-wide text-white/70 font-semibold">Portfolio Score (weighted)</div>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-2xl font-black">{weightedTotal != null ? weightedTotal.toFixed(1) : '—'}</span>
              <span className="text-xs text-white/70">/ 100</span>
            </div>
          </div>
        </div>
      </div>

      {/* Actual KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <ActualTile
          label="GOP Actual"
          value={fmt$(gopActual)}
          sub={`Budget ${fmt$(gopBudget)}`}
          foot={`${gopVar >= 0 ? '+' : '-'}${fmt$(Math.abs(gopVar))}${gopVarPct != null ? ` · ${gopVarPct >= 0 ? '+' : ''}${gopVarPct.toFixed(1)}%` : ''}`}
          footColor={gopVar >= 0 ? '#4CAF50' : '#ef4444'}
        />
        <ActualTile
          label="GOP Margin"
          value={marginActual != null ? `${marginActual.toFixed(1)}%` : '—'}
          sub={`LY ${marginPrior != null ? marginPrior.toFixed(1) + '%' : '—'}`}
          foot={marginDelta != null ? `${marginDelta >= 0 ? '+' : ''}${marginDelta.toFixed(1)} pts` : '—'}
          footColor={marginDelta != null && marginDelta > 0.1 ? '#4CAF50' : marginDelta != null && marginDelta < 0 ? '#ef4444' : '#f59e0b'}
        />
        <ActualTile
          label="RGI Index"
          value={rgiIndex != null ? rgiIndex.toFixed(1) : '—'}
          sub={`LY ${rgiPrior != null ? rgiPrior.toFixed(1) : '—'}`}
          foot={rgiChange != null ? `${rgiChange >= 0 ? '+' : ''}${rgiChange.toFixed(1)}%` : '—'}
          footColor={rgiChange != null && rgiChange >= 0.1 ? '#4CAF50' : '#ef4444'}
        />
        <ActualTile
          label="GSS (normalized)"
          value={gssActual != null ? gssActual.toFixed(1) : '—'}
          sub={`LY ${gssPrior != null ? gssPrior.toFixed(1) : '—'}`}
          foot={gssDelta != null ? `${gssDelta >= 0 ? '+' : ''}${gssDelta.toFixed(1)}` : '—'}
          footColor={gssDelta != null && gssDelta > 0 ? '#4CAF50' : '#ef4444'}
        />
        <ActualTile
          label="Forecast"
          value={`${forecastHits}/${withForecast.length}`}
          sub="hit rate"
          footColor={forecastRate != null && forecastRate >= 0.7 ? '#4CAF50' : '#f59e0b'}
        />
        <ActualTile
          label="Red Zone"
          value={`${redZoneCompliant}/${withData.length}`}
          sub="compliant"
          footColor={redZoneRate != null && redZoneRate >= 0.7 ? '#4CAF50' : '#f59e0b'}
        />
      </div>
    </div>
  );
}