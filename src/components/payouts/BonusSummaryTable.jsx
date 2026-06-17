import React from 'react';
import { AlertCircle } from 'lucide-react';

export default function BonusSummaryTable({ jobClassifications = [] }) {
  // Filter and sort job classifications
  const sortedJobClasses = jobClassifications
    .filter(jc => !jc.title.toLowerCase().includes('supervisor'))
    .sort((a, b) => {
      if (a.title === 'General Manager') return -1;
      if (b.title === 'General Manager') return 1;
      return a.title.localeCompare(b.title);
    });

  return (
    <div className="space-y-6">
      {/* Summary Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="bg-navy text-white px-6 py-4">
          <h3 className="font-bold text-lg">2026 OPERATIONS BONUSES — Summary Chart</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-secondary/50 text-muted-foreground text-xs uppercase tracking-wide border-b border-border">
                <th className="py-3 px-4 text-left font-semibold">Standard Bonuses</th>
                <th className="py-3 px-4 text-center font-semibold">Full Year Max Bonus Potential</th>
                <th className="py-3 px-4 text-center font-semibold">Gross Operating Profit (GOP)</th>
                <th className="py-3 px-4 text-center font-semibold">GOP Margin Improvement</th>
                <th className="py-3 px-4 text-center font-semibold">GSS Improvement</th>
                <th className="py-3 px-4 text-center font-semibold">RGI Improvement</th>
              </tr>
            </thead>
            <tbody>
              {sortedJobClasses.map((jc, idx) => (
                <tr key={jc.id} className={`border-t border-border ${idx % 2 === 0 ? 'bg-white' : 'bg-muted/20'} hover:bg-muted/40`}>
                  <td className="py-3 px-4 font-semibold text-navy">{jc.title}</td>
                  <td className="py-3 px-4 text-center font-bold">{jc.max_bonus_percentage}%</td>
                  <td className="py-3 px-4 text-center">{jc.gop_bonus_percentage}%</td>
                  <td className="py-3 px-4 text-center">{jc.gop_margin_bonus_percentage}%</td>
                  <td className="py-3 px-4 text-center">{jc.gss_bonus_percentage}%</td>
                  <td className="py-3 px-4 text-center">
                    {jc.title === 'General Manager' ? (
                      <>
                        <span>{jc.rgi_bonus_percentage_low}% / {jc.rgi_bonus_percentage_high}%<span className="text-destructive">*</span></span>
                      </>
                    ) : (
                      `${jc.rgi_bonus_percentage_low}%`
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footnote */}
        <div className="px-6 py-3 border-t border-border text-xs text-muted-foreground bg-muted/20">
          <p>RGI partial (0.1–2.0%) earns 50% of that role's RGI full rate. Full (2.1%+) earns 100%. GOP Gate: both GOP $ and Margin $ bonus = $0 if Actual GOP &lt; Budget OR Margin Actual ≤ Margin Prior Year.</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Timing Card */}
        <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
          <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            TIMING
          </h4>
          <p className="text-xs text-blue-800 leading-relaxed">
            This Plan is paid out annually or in line with any pre-existing cadence. In the case of quarterly bonus payouts, 50% of Bonus is measured and paid Annually and 50% of the Bonus is measured and paid Quarterly.
          </p>
        </div>

        {/* GOP Gatekeeper Card */}
        <div className="bg-orange-50 rounded-2xl border border-orange-200 p-5">
          <h4 className="font-bold text-orange-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            GOP GATEKEEPER
          </h4>
          <p className="text-xs text-orange-800 leading-relaxed">
            Both <strong>Actual GOP ≥ Budget</strong> AND <strong>Margin Actual &gt; Margin Prior Year</strong> must be true to earn either the GOP $ component or the Margin $ component. If either fails → both GOP and Margin bonuses = $0. RGI and GSS always calculate independently.
          </p>
        </div>

        {/* Forecast Kicker Card */}
        <div className="bg-green-50 rounded-2xl border border-green-200 p-5">
          <h4 className="font-bold text-green-900 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            FORECAST ACCURACY ANNUAL KICKER
          </h4>
          <p className="text-xs text-green-800 leading-relaxed">
            Additional Potential of 3% of salary earned if the hotel(s)' operating revenues falls within +/-3% of the respective annual forecast to be considered 'accurate'. Payout based on hitting 3 out of 4 quarterly (90 day) forecasts.
          </p>
        </div>
      </div>
    </div>
  );
}