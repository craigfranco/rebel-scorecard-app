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

const COLS = [
  { key: 'name', label: 'Operator', align: 'left' },
  { key: 'hotels', label: 'Hotels', align: 'center' },
  { key: 'rooms', label: 'Rooms', align: 'center' },
  { key: 'gop', label: 'GOP', align: 'center' },
  { key: 'gopMargin', label: 'Margin', align: 'center' },
  { key: 'rgi', label: 'RGI', align: 'center' },
  { key: 'gss', label: 'GSS', align: 'center' },
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
      return {
        name,
        hotels: withData.length,
        rooms: totalRooms,
        gop: simpleAvg(withData, r => r.sc?.gop?.score),
        gopMargin: simpleAvg(withData, r => r.sc?.gopMargin?.score),
        rgi: simpleAvg(withData, r => r.sc?.rgi?.score),
        gss: simpleAvg(withData, r => r.sc?.gss?.score),
        avg: simpleAvg(withData, r => r.sc?.total?.total),
        portfolio: weightedAvg(withData, r => r.sc?.total?.total, rooms) ?? simpleAvg(withData, r => r.sc?.total?.total),
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
      setSortDir(['name'].includes(key) ? 'asc' : 'desc');
    }
  };

  const fmt = (v, dec = 1) => v == null ? '—' : v.toFixed(dec);

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
                    className={`py-3 px-4 ${align} font-semibold cursor-pointer select-none hover:text-foreground transition-colors ${active ? 'text-primary' : ''}`}
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
                <td className="py-3 px-4">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">{idx + 1}</span>
                    <span className="font-semibold text-foreground">{r.name}</span>
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-foreground">{r.hotels}</td>
                <td className="py-3 px-4 text-center text-muted-foreground">{r.rooms.toLocaleString('en-US')}</td>
                <td className="py-3 px-4 text-center text-foreground">{fmt(r.gop)}</td>
                <td className="py-3 px-4 text-center text-foreground">{fmt(r.gopMargin)}</td>
                <td className="py-3 px-4 text-center text-foreground">{fmt(r.rgi)}</td>
                <td className="py-3 px-4 text-center text-foreground">{fmt(r.gss)}</td>
                <td className="py-3 px-4 text-center">
                  <span className="font-bold" style={{ color: scoreColor(r.avg) }}>{fmt(r.avg)}</span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className="font-black text-base" style={{ color: scoreColor(r.portfolio) }}>{fmt(r.portfolio)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}