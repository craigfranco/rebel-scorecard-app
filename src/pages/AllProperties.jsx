import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Search, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { calculateScorecard } from '../lib/scoring';
import { Link } from 'react-router-dom';

const CURRENT_YEAR = 2026;
const CURRENT_MONTH = 3;

export default function AllProperties() {
  const [search, setSearch] = useState('');

  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('name', 100),
  });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['all-entries', CURRENT_YEAR],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: CURRENT_YEAR }),
  });

  const getLatestEntry = (propertyId) => {
    const propEntries = allEntries
      .filter(e => e.property_id === propertyId && e.month <= CURRENT_MONTH)
      .sort((a, b) => b.month - a.month);
    return propEntries[0] || null;
  };

  const rows = properties
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.city || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.parent_brand || '').toLowerCase().includes(search.toLowerCase()))
    .map(p => {
      const entry = getLatestEntry(p.id);
      const scorecard = entry ? calculateScorecard(entry, p) : null;
      return { property: p, entry, scorecard };
    })
    .sort((a, b) => {
      const sa = a.scorecard?.total.total ?? -1;
      const sb = b.scorecard?.total.total ?? -1;
      return sb - sa;
    });

  const passing = rows.filter(r => r.scorecard?.total.pass).length;
  const failing = rows.filter(r => r.scorecard && !r.scorecard.total.pass).length;
  const noData = rows.filter(r => !r.scorecard).length;

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <h1 className="text-2xl font-bold">All Properties</h1>
        <p className="text-white/70 text-sm mt-1">Portfolio-wide scorecard overview — ranked by performance score</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Passing', value: passing, color: '#4CAF50', icon: TrendingUp },
          { label: 'Failing', value: failing, color: '#ef4444', icon: TrendingDown },
          { label: 'No Data', value: noData, color: '#94a3b8', icon: Minus },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} className="bg-card rounded-2xl border border-border p-5 shadow-sm flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${color}18` }}>
              <Icon className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <div className="text-2xl font-black" style={{ color }}>{value}</div>
              <div className="text-xs text-muted-foreground font-medium">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Search + Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center gap-3">
          <Search className="w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by hotel name, city, or brand..."
            className="border-none shadow-none text-sm p-0 focus-visible:ring-0 h-auto"
          />
          <span className="text-xs text-muted-foreground shrink-0">{rows.length} properties</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold w-8">#</th>
                <th className="py-3 px-4 text-left font-semibold">Property</th>
                <th className="py-3 px-4 text-center font-semibold">Brand</th>
                <th className="py-3 px-4 text-center font-semibold">GM</th>
                <th className="py-3 px-4 text-center font-semibold">GOP</th>
                <th className="py-3 px-4 text-center font-semibold">Margin</th>
                <th className="py-3 px-4 text-center font-semibold">RGI</th>
                <th className="py-3 px-4 text-center font-semibold">GSS</th>
                <th className="py-3 px-4 text-center font-semibold">Score</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ property, scorecard }, idx) => (
                <tr key={property.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 text-muted-foreground text-xs font-medium">{idx + 1}</td>
                  <td className="py-3 px-4">
                    <div className="font-semibold text-foreground text-sm">{property.name}</div>
                    <div className="text-xs text-muted-foreground">{property.city}, {property.state}</div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="text-xs bg-muted px-2 py-1 rounded-full font-medium">{property.parent_brand || '—'}</span>
                  </td>
                  <td className="py-3 px-4 text-center text-xs text-muted-foreground">{property.gm_name || '—'}</td>
                  <td className="py-3 px-4 text-center">
                    {scorecard ? (
                      <ScoreCell score={scorecard.gop.score} max={35} pass={scorecard.gop.pass} />
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {scorecard ? (
                      <ScoreCell score={scorecard.gopMargin.score} max={35} pass={scorecard.gopMargin.pass} />
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {scorecard ? (
                      <ScoreCell score={scorecard.rgi.score} max={15} pass={scorecard.rgi.pass} />
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {scorecard ? (
                      <ScoreCell score={scorecard.gss.score} max={15} pass={scorecard.gss.pass} />
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {scorecard ? (
                      <span className="text-lg font-black" style={{ color: scorecard.total.pass ? '#4CAF50' : '#ef4444' }}>
                        {scorecard.total.total}
                      </span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {scorecard ? (
                      <span
                        className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold text-white"
                        style={{ backgroundColor: scorecard.total.pass ? '#4CAF50' : '#ef4444' }}
                      >
                        {scorecard.total.pass ? 'PASS' : 'FAIL'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                        NO DATA
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ScoreCell({ score, max, pass }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="text-xs font-bold" style={{ color: pass ? '#4CAF50' : '#ef4444' }}>
        {score.toFixed(1)}/{max}
      </span>
    </div>
  );
}