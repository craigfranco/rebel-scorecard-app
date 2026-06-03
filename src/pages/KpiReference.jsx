import React from 'react';
import { Info, Zap, Shield, Target } from 'lucide-react';

const KPI_ROWS = [
  {
    measure: 'Budgeted GOP',
    weight: '35%',
    pts: '35',
    target: '100% or >',
    scoring: 'Binary: 35 pts if Actual ≥ Budget (≥ 100% achievement). 0 pts if Actual < Budget. No prorating.',
    pass: 'GOP Actual / GOP Budget ≥ 100%',
  },
  {
    measure: 'GOP Margin Improvement*',
    weight: '35%',
    pts: '35',
    target: '0.1% or >',
    scoring: 'Binary: 35 pts if TY margin – LY margin ≥ 0.1%. 0 pts if improvement < 0.1%. No partial credit.',
    pass: 'Margin TY – Margin LY ≥ 0.1%',
  },
  {
    measure: 'RGI Improvement**',
    weight: '15%',
    pts: '0 / 7.5 / 15',
    target: '0.1%–2.0% vs LY = 7.5 pts / 2.1%+ vs LY = 15 pts',
    scoring: 'Two-tier: < 0.1% = 0 pts (FAIL). 0.1%–2.0% YOY = 7.5 pts (half). 2.1%+ YOY = 15 pts (full). Pass at 0.1%+.',
    pass: 'RGI YOY Change ≥ 0.1%',
  },
  {
    measure: 'GSS Improvement',
    weight: '15%',
    pts: '15',
    target: 'YOY > Pays 100%',
    scoring: 'Binary: 15 pts if TY score > LY score (any positive improvement). 0 pts if TY ≤ LY. Full points or none.',
    pass: 'GSS TY > GSS LY',
  },
];

const GSS_BRANDS = [
  { brand: 'Marriott', abbr: 'MA', metric: 'Intent to Return (ITR)', target: '+1.0', color: '#CC2031' },
  { brand: 'Hilton', abbr: 'HI', metric: 'Stay Score', target: '+1.0', color: '#00205B' },
  { brand: 'IHG', abbr: 'IH', metric: 'Overall Experience', target: '+1.0', color: '#003087' },
  { brand: 'Hyatt', abbr: 'HY', metric: 'Performance Tier', target: '+1.0', color: '#4B3832' },
  { brand: 'Choice Hotels', abbr: 'CH', metric: 'Choice Likelihood', target: '+0.3', color: '#F7941D' },
  { brand: 'Independent', abbr: 'IN', metric: 'Revinate Score', target: '+0.03', color: '#4B5563' },
];

export default function KpiReference() {
  return (
    <div className="p-4 lg:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <Info className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold">KPI Reference Guide</h1>
        </div>
        <p className="text-white/70 text-sm">2026 Incentive Plan — Scoring methodology, weights, and brand standards</p>
      </div>

      {/* Score Formula */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
        <h2 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          Score Formula
        </h2>
        <div className="bg-muted/50 rounded-xl p-4 font-mono text-sm mb-4">
          <div className="text-center space-y-1">
            <div><span className="font-bold">Total Score (0–100)</span> = GOP Score + GOP Margin Score + RGI Score + GSS Score</div>
            <div className="text-muted-foreground text-xs mt-2">= (0–35) + (0–35) + (0–15) + (0–15)</div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-green-600">≥ 70</div>
            <div className="text-sm font-semibold text-green-700 mt-1">PASS</div>
            <div className="text-xs text-green-600/70 mt-0.5">Eligible for full incentive payout</div>
          </div>
          <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-black text-red-500">&lt; 70</div>
            <div className="text-sm font-semibold text-red-600 mt-1">FAIL</div>
            <div className="text-xs text-red-500/70 mt-0.5">Below threshold — no incentive payout</div>
          </div>
        </div>
      </div>

      {/* KPI Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg">KPI Breakdown</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Weights, targets, and pass/fail criteria for each measure</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold">Measure</th>
                <th className="py-3 px-4 text-center font-semibold">Weight</th>
                <th className="py-3 px-4 text-center font-semibold">Points</th>
                <th className="py-3 px-4 text-left font-semibold">Target / Scoring Tiers</th>
                <th className="py-3 px-4 text-left font-semibold">Pass Criteria</th>
              </tr>
            </thead>
            <tbody>
              {KPI_ROWS.map((row, i) => (
                <tr key={i} className="border-b border-border hover:bg-muted/20">
                  <td className="py-4 px-4 font-semibold text-foreground">{row.measure}</td>
                  <td className="py-4 px-4 text-center">
                    <span className="px-2 py-1 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#2d4b5e' }}>
                      {row.weight}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center font-bold text-foreground">{row.pts}</td>
                  <td className="py-4 px-4 text-muted-foreground text-xs max-w-[180px]">{row.target}</td>
                  <td className="py-4 px-4">
                    <code className="text-xs bg-muted px-2 py-1 rounded font-mono">{row.pass}</code>
                    <p className="text-xs text-muted-foreground mt-1">{row.scoring}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Kickers */}
      <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
        <h2 className="font-bold text-lg flex items-center gap-2">
          <Zap className="w-5 h-5 text-yellow-500" />
          Kicker Bonuses
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              <h3 className="font-semibold text-sm">Forecast Accuracy Kicker</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>+3% of salary bonus</strong> if 3 out of 4 quarterly revenue forecasts land within <strong>±3% of actual revenue</strong>.
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 text-xs text-yellow-800">
              Hit / Miss — tracked quarterly. Additive to base score.
            </div>
          </div>
          <div className="border border-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-500" />
              <h3 className="font-semibold text-sm">Red Zone Kicker</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong>+25% of GSS payout</strong> if the property exits <strong>and stays out</strong> of the brand's Red Zone designation for the full period.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 text-xs text-blue-800">
              Hit / Miss — applies to brand-flagged properties only.
            </div>
          </div>
        </div>
      </div>

      {/* GSS Brand Standards */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-bold text-lg">Brand-Specific GSS Standards</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Minimum improvement required to pass the GSS (Guest Satisfaction) measure</p>
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {GSS_BRANDS.map(({ brand, abbr, metric, target, color }) => (
            <div key={brand} className="border border-border rounded-xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ backgroundColor: color }}>
                {abbr}
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{brand}</div>
                <div className="text-xs text-muted-foreground">{metric}</div>
                <div className="text-xs font-bold mt-0.5" style={{ color }}>Target: {target} YOY</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}