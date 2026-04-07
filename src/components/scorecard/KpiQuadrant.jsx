import React from 'react';

const KPI_CONFIG = [
  { key: 'gop',       label: 'Budgeted GOP',        weight: '35pts', color: '#2d4b5e' },
  { key: 'gopMargin', label: 'GOP Margin',           weight: '35pts', color: '#2d4b5e' },
  { key: 'rgi',       label: 'RevPAR Index (RGI)',   weight: '15pts', color: '#2d4b5e' },
  { key: 'gss',       label: 'GSS',                  weight: '15pts', color: '#2d4b5e' },
];

export default function KpiQuadrant({ scorecard }) {
  if (!scorecard) return null;

  const kpis = KPI_CONFIG.map(cfg => ({
    ...cfg,
    score: scorecard[cfg.key]?.score,
    pass: scorecard[cfg.key]?.pass,
    incomplete: scorecard[cfg.key]?.incomplete,
  }));

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map(kpi => {
        const isIncomplete = kpi.incomplete || kpi.pass === null || kpi.pass === undefined;
        const bgColor = isIncomplete ? '#f8fafc' : kpi.pass ? '#f0fdf4' : '#fef2f2';
        const borderColor = isIncomplete ? '#e2e8f0' : kpi.pass ? '#bbf7d0' : '#fecaca';
        const statusColor = isIncomplete ? '#94a3b8' : kpi.pass ? '#16a34a' : '#dc2626';
        const statusLabel = isIncomplete ? 'NO DATA' : kpi.pass ? 'PASS' : 'FAIL';

        return (
          <div
            key={kpi.key}
            className="rounded-2xl border p-5 flex flex-col gap-3 shadow-sm"
            style={{ backgroundColor: bgColor, borderColor }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{kpi.weight}</p>
                <p className="font-bold text-sm text-foreground mt-0.5">{kpi.label}</p>
              </div>
              <span
                className="shrink-0 inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: statusColor }}
              >
                {statusLabel}
              </span>
            </div>
            <div className="text-2xl font-black" style={{ color: statusColor }}>
              {isIncomplete ? '—' : `${kpi.score?.toFixed(1)} / ${kpi.key === 'gop' || kpi.key === 'gopMargin' ? 35 : 15}`}
            </div>
          </div>
        );
      })}
    </div>
  );
}