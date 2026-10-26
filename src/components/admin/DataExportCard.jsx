import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Download, Database } from 'lucide-react';

// Entities included in a full export. Label shows in the summary;
// ScoreEntry carries the manual Key Wins & Risks narratives (key_wins,
// next_priorities, prepared_by, reviewed_by), BonusPayout the payout records.
const EXPORT_ENTITIES = [
  { key: 'Property', label: 'Properties' },
  { key: 'ScoreEntry', label: 'Score Entries (incl. Key Wins & Risks)' },
  { key: 'Staff', label: 'Staff & Salaries' },
  { key: 'JobClassification', label: 'Job Classifications' },
  { key: 'BonusPayout', label: 'Bonus Payouts' },
  { key: 'BonusException', label: 'Bonus Exceptions' },
  { key: 'PortfolioSummary', label: 'Portfolio Summaries' },
  { key: 'RgiQuarterlyReport', label: 'RGI Quarterly Reports' },
  { key: 'GopQuarterlyReport', label: 'GOP Quarterly Reports' },
  { key: 'Document', label: 'Documents' },
  { key: 'UserProfile', label: 'User Profiles' },
];

// Pages through every record of an entity (server caps page size).
async function fetchAll(entityName) {
  const entity = base44.entities[entityName];
  let items = [];
  let cursor = null;
  let hasMore = true;
  while (hasMore) {
    const page = await entity.filter({}, { sort: '-created_date', limit: 500, cursor });
    items = items.concat(page.items || []);
    hasMore = !!page.has_more;
    cursor = page.next_cursor;
  }
  return items;
}

export default function DataExportCard() {
  const [exporting, setExporting] = useState(false);
  const [counts, setCounts] = useState(null);
  const [error, setError] = useState(null);

  const handleExport = async () => {
    setExporting(true);
    setError(null);
    try {
      const data = { exported_at: new Date().toISOString(), entities: {} };
      const nextCounts = {};
      for (const { key, label } of EXPORT_ENTITIES) {
        const records = await fetchAll(key);
        data.entities[key] = records;
        nextCounts[label] = records.length;
      }
      setCounts(nextCounts);

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rebel-scorecard-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed');
    }
    setExporting(false);
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-primary" />
          <div>
            <h2 className="font-bold text-lg">Data Export</h2>
            <p className="text-xs text-muted-foreground">
              Download every record — manual entries, payouts, Key Wins &amp; Risks narratives, staff, and more — as one JSON file.
            </p>
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 shrink-0"
          style={{ backgroundColor: '#2d4b5e' }}
        >
          {exporting
            ? <span className="w-4 h-4 inline-block border-2 border-white/40 border-t-white rounded-full animate-spin" />
            : <Download className="w-4 h-4" />
          }
          {exporting ? 'Exporting...' : 'Download Full Export'}
        </button>
      </div>

      <div className="px-6 py-4">
        {error && (
          <p className="text-sm text-red-600 font-medium mb-3">Error: {error}</p>
        )}
        {counts ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2">
            {Object.entries(counts).map(([label, count]) => (
              <div key={label} className="flex items-center justify-between border border-border rounded-lg px-3 py-2 text-xs">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-bold">{count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Includes: {EXPORT_ENTITIES.map(e => e.label).join(', ')}.
          </p>
        )}
      </div>
    </div>
  );
}