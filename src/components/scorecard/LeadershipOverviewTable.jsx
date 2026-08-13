import React, { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const scoreColor = (total, max = 100) => {
  if (total == null) return undefined;
  const pct = total / max;
  if (pct >= 0.7) return '#4CAF50';
  if (pct >= 0.5) return '#f59e0b';
  return '#ef4444';
};

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

function fmt$(v) {
  if (v == null) return '—';
  const abs = Math.abs(v);
  if (abs >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return '$' + Math.round(v / 1e3) + 'K';
  return '$' + Math.round(v);
}
function fmtFull$(v) {
  if (v == null) return '—';
  return (v < 0 ? '-' : '') + '$' + Math.abs(Math.round(v)).toLocaleString('en-US');
}

// Cell that shows a primary value plus a small sub-line (target/variance)
function KpiCell({ value, sub, subColor, valueColor }) {
  return (
    <td className="py-3 px-3 text-center align-top">
      <div className="font-bold text-sm text-foreground" style={{ color: valueColor }}>{value}</div>
      {sub != null && <div className="text-[10px] leading-tight mt-0.5" style={{ color: subColor || undefined }}>{sub}</div>}
    </td>
  );
}

const COLS = [
  { key: 'name', label: 'Operator', align: 'left' },
  { key: 'hotels', label: 'Hotels', align: 'center' },
  { key: 'rooms', label: 'Rooms', align: 'center' },
  // KPI actual + score pairs
  { key: 'gopActual', label: 'GOP Actual', align: 'center' },
  { key: 'gop', label: 'GOP /35', align: 'center' },
  { key: 'marginActual', label: 'GOP Margin', align: 'center' },
  { key: 'gopMargin', label: 'Margin /35', align: 'center' },
  { key: 'rgiIndex', label: 'RGI Index', align: 'center' },
  { key: 'rgi', label: 'RGI /15', align: 'center' },
  { key: 'gssActual', label: 'GSS Score', align: 'center' },
  { key: 'gss', label: 'GSS /15', align: 'center' },
  // Kickers
  { key: 'forecastHits', label: 'Forecast', align: 'center' },
  { key: 'redZoneCompliant', label: 'Red Zone', align: 'center' },
  // Combined scores
  { key: 'avg', label: 'Avg Score', align: 'center' },
  { key: 'portfolio', label: 'Portfolio Score', align: 'center' },
];

export default function LeadershipOverviewTable({ groups, roleLabel }) {
  const [sortKey, setSortKey] = useState('portfolio');
  const [sortDir, setSortDir] = useState('desc');

  const summaryRows = useMemo(() => {
    return groups.map(([name, rows]) => {
      const withData = rows.filter(r => r.hasData);
      const rooms = r => r.rooms || 0;
      const totalRooms = withData.reduce((s, r) => s + rooms(r), 0);

      // Score averages
      const gop = simpleAvg(withData, r => r.sc?.gop?.score);
      const gopMargin = simpleAvg(withData, r => r.sc?.gopMargin?.score);
      const rgi = simpleAvg(withData, r => r.sc?.rgi?.score);
      const gss = simpleAvg(withData, r => r.sc?.gss?.score);
      const avg = simpleAvg(withData, r => r.sc?.total?.total);
      const portfolio = weightedAvg(withData, r => r.sc?.total?.total, rooms) ?? avg;

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

      const gssActual = weightedAvg(withData, r => r.sc?.gss?.normActual, rooms);
      const gssPrior = weightedAvg(withData, r => r.sc?.gss?.normPrior, rooms);
      const gssDelta = (gssActual != null && gssPrior != null) ? gssActual - gssPrior : null;

      const withForecast = withData.filter(r => r.forecast != null);
      const forecastHits = withForecast.filter(r => r.forecast === true).length;

      const redZoneCompliant = withData.filter(r => r.redzone === true).length;

      return {
        name,
        hotels: withData.length,
        rooms: totalRooms,
        gop, gopMargin, rgi, gss, avg, portfolio,
        gopActual, gopBudget, gopVar, gopVarPct,
        marginActual, marginPrior, marginDelta,
        rgiIndex, rgiChange,
        gssActual, gssPrior, gssDelta,
        forecastHits, forecastTotal: withForecast.length,
        redZoneCompliant, redZoneTotal: withData.length,
      };
    });
  }, [groups]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'desc' ? -1 : 1;
    return [...summaryRows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (sortKey === 'name') return av.localeCompare(bv) * dir;
      if (av == null) return 1;
      if (bv == null) return -1;
      return (av - bv) * dir;
    });
  }, [summaryRows, sortKey, sortDir]);

  const toggleSort = (key) => {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir(['name', 'hotels', 'rooms'].includes(key) ? 'asc' : 'desc');
    }
  };

  const fmt = (v, dec = 1) => v == null ? '—' : v.toFixed(dec);

  const renderCell = (r) => {
    switch (r._col) {
      case 'name':
        return (
          <td key={r._col} className="py-3 px-4">
            <span className="inline-flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">{r._idx + 1}</span>
              <span className="font-semibold text-foreground">{r.name}</span>
            </span>
          </td>
        );
      case 'hotels':
        return <td key={r._col} className="py-3 px-4 text-center text-foreground">{r.hotels}</td>;
      case 'rooms':
        return <td key={r._col} className="py-3 px-4 text-center text-muted-foreground">{r.rooms.toLocaleString('en-US')}</td>;
      case 'gop':
      case 'gopMargin':
      case 'rgi':
      case 'gss':
        return <td key={r._col} className="py-3 px-4 text-center text-foreground">{fmt(r[r._col])}</td>;
      case 'gopActual':
        return (
          <KpiCell key={r._col}
            value={fmtFull$(r.gopActual)}
            sub={`Budget ${fmt$(r.gopBudget)}`}
            subColor={r.gopVar >= 0 ? '#4CAF50' : '#ef4444'}
            valueColor={r.gopVar >= 0 ? '#4CAF50' : '#ef4444'}
          />
        );
      case 'marginActual':
        return (
          <KpiCell key={r._col}
            value={r.marginActual != null ? `${r.marginActual.toFixed(1)}%` : '—'}
            sub={r.marginDelta != null ? `${r.marginDelta >= 0 ? '+' : ''}${r.marginDelta.toFixed(1)} pts vs LY` : `LY ${r.marginPrior != null ? r.marginPrior.toFixed(1) + '%' : '—'}`}
            subColor={r.marginDelta != null && r.marginDelta > 0.1 ? '#4CAF50' : r.marginDelta != null && r.marginDelta < 0 ? '#ef4444' : '#94a3b8'}
          />
        );
      case 'rgiIndex':
        return (
          <KpiCell key={r._col}
            value={fmt(r.rgiIndex)}
            sub={r.rgiChange != null ? `${r.rgiChange >= 0 ? '+' : ''}${r.rgiChange.toFixed(1)}% YOY` : '—'}
            subColor={r.rgiChange != null && r.rgiChange >= 0.1 ? '#4CAF50' : '#ef4444'}
          />
        );
      case 'gssActual':
        return (
          <KpiCell key={r._col}
            value={fmt(r.gssActual)}
            sub={r.gssDelta != null ? `${r.gssDelta >= 0 ? '+' : ''}${r.gssDelta.toFixed(1)} vs LY` : `LY ${r.gssPrior != null ? r.gssPrior.toFixed(1) : '—'}`}
            subColor={r.gssDelta != null && r.gssDelta > 0 ? '#4CAF50' : '#ef4444'}
          />
        );
      case 'forecastHits':
        return <td key={r._col} className="py-3 px-4 text-center align-top"><div className="font-bold text-sm text-foreground">{r.forecastHits}/{r.forecastTotal}</div><div className="text-[10px] text-muted-foreground mt-0.5">hitting</div></td>;
      case 'redZoneCompliant':
        return <td key={r._col} className="py-3 px-4 text-center align-top"><div className="font-bold text-sm text-foreground">{r.redZoneCompliant}/{r.redZoneTotal}</div><div className="text-[10px] text-muted-foreground mt-0.5">out of zone</div></td>;
      case 'avg':
        return <td key={r._col} className="py-3 px-4 text-center"><span className="font-bold" style={{ color: scoreColor(r.avg) }}>{fmt(r.avg)}</span></td>;
      case 'portfolio':
        return <td key={r._col} className="py-3 px-4 text-center"><span className="font-black text-base" style={{ color: scoreColor(r.portfolio) }}>{fmt(r.portfolio)}</span></td>;
      default:
        return null;
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground">Operator Overview</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            All {roleLabel.toLowerCase()} groups ranked together · click a column to sort
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
              {COLS.map(c => {
                const active = sortKey === c.key;
                const align = c.align === 'center' ? 'text-center' : 'text-left';
                return (
                  <th
                    key={c.key}
                    onClick={() => toggleSort(c.key)}
                    className={`py-3 px-3 ${align} font-semibold cursor-pointer select-none hover:text-foreground transition-colors whitespace-nowrap ${active ? 'text-primary' : ''}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${c.align === 'center' ? 'justify-center' : ''}`}>
                      {c.label}
                      {active && (sortDir === 'desc'
                        ? <ChevronDown className="w-3 h-3" />
                        : <ChevronUp className="w-3 h-3" />)}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, idx) => (
              <tr key={r.name} className="border-t border-border hover:bg-muted/40 transition-colors">
                {COLS.map(c => renderCell({ ...r, _col: c.key, _idx: idx }))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}