import React from 'react';

function normalizeGss(score, brand) {
  if (score == null) return null;
  if (brand === 'Choice Hotels' || brand === 'Choice') return score * 10;
  if (brand === 'Independent') return score * 20;
  return score;
}

export default function ExecutiveSummaryBar({ properties, allEntries, getPeriodMonths, selectedYear, periodType, selectedMonth }) {
  const periodMonths = getPeriodMonths();

  let onBudgetCount = 0, totalWithGop = 0;
  let rpiSum = 0, rpiCount = 0;
  let forecastHits = 0, forecastTotal = 0;
  let gssSum = 0, gssCount = 0;

  properties.forEach(prop => {
    const propEntries = allEntries.filter(e => e.property_id === prop.id && periodMonths.includes(e.month) && e.year === selectedYear);
    if (!propEntries.length) return;

    // Use latest month entry for boolean/single-value fields; sum for financials
    const latest = propEntries[propEntries.length - 1];

    // GOP budget
    const gopActual = propEntries.reduce((s, e) => s + (e.budgeted_gop_actual ?? 0), 0);
    const gopTarget = propEntries.reduce((s, e) => s + (e.budgeted_gop_target ?? 0), 0);
    if (gopTarget > 0) {
      totalWithGop++;
      if (gopActual >= gopTarget) onBudgetCount++;
    }

    // RPI
    if (latest.revpar_index != null) { rpiSum += latest.revpar_index; rpiCount++; }

    // Forecast kicker
    forecastTotal++;
    if (latest.forecast_kicker) forecastHits++;

    // GSS normalized
    const norm = normalizeGss(latest.gss_actual, prop.parent_brand);
    if (norm != null) { gssSum += norm; gssCount++; }
  });

  const avgRpi = rpiCount > 0 ? rpiSum / rpiCount : null;
  const avgGss = gssCount > 0 ? gssSum / gssCount : null;

  const pills = [
    {
      label: 'Hotels On Budget',
      value: totalWithGop > 0 ? `${onBudgetCount} / ${totalWithGop}` : '—',
      pass: totalWithGop > 0 ? onBudgetCount / totalWithGop >= 0.7 : null,
      sub: 'GOP ≥ Budget',
    },
    {
      label: 'Portfolio RPI',
      value: avgRpi != null ? avgRpi.toFixed(1) : '—',
      pass: avgRpi != null ? avgRpi >= 100 : null,
      sub: 'Avg RevPAR Index',
    },
    {
      label: 'Forecast Kickers',
      value: forecastTotal > 0 ? `${forecastHits} / ${forecastTotal}` : '—',
      pass: forecastTotal > 0 ? forecastHits / forecastTotal >= 0.75 : null,
      sub: 'Hit 3 of 4 quarters',
    },
    {
      label: 'Avg GSS',
      value: avgGss != null ? avgGss.toFixed(1) : '—',
      pass: avgGss != null ? avgGss >= 70 : null,
      sub: 'Normalized /100',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {pills.map(({ label, value, pass, sub }) => (
        <div
          key={label}
          className="bg-card rounded-2xl border shadow-sm px-5 py-4 flex items-center gap-4"
          style={{ borderColor: pass == null ? '#e2e8f0' : pass ? '#bbf7d0' : '#fecaca' }}
        >
          <div
            className="w-2.5 h-10 rounded-full shrink-0"
            style={{ backgroundColor: pass == null ? '#94a3b8' : pass ? '#22c55e' : '#ef4444' }}
          />
          <div>
            <div className="text-2xl font-black leading-none" style={{ color: pass == null ? '#64748b' : pass ? '#16a34a' : '#dc2626' }}>
              {value}
            </div>
            <div className="text-xs font-semibold text-foreground mt-0.5">{label}</div>
            <div className="text-[10px] text-muted-foreground">{sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}