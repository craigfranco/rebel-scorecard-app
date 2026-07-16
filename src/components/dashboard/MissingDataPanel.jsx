import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AlertTriangle, CheckCircle2, FileWarning } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Reports are due by the 20th of the month following the report period.
// e.g. June data is due by July 20th. A month is "due" once we pass that 20th.
function getDueMonths(now = new Date()) {
  const year = now.getFullYear();
  const due = [];
  for (let m = 1; m <= 12; m++) {
    let dueYear = year;
    let dueMonth = m + 1;
    if (dueMonth > 12) { dueMonth = 1; dueYear = year + 1; }
    const dueDate = new Date(dueYear, dueMonth - 1, 20);
    if (now >= dueDate) due.push({ month: m, year, dueLabel: `${MONTHS[dueMonth - 1]} 20` });
  }
  return due;
}

export default function MissingDataPanel() {
  const now = useMemo(() => new Date(), []);
  const dueMonths = useMemo(() => getDueMonths(now), [now]);
  const currentYear = now.getFullYear();

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 200),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries-missing', currentYear],
    queryFn: () => base44.entities.ScoreEntry.filter({ year: currentYear }, undefined, 500),
  });

  // Only properties linked to the deployment app have an str_id
  const deploymentProps = useMemo(() => properties.filter(p => p.str_id), [properties]);
  const latest = dueMonths[dueMonths.length - 1];

  const { missingGop, missingStr, loadedCount } = useMemo(() => {
    if (!latest) return { missingGop: [], missingStr: [], loadedCount: 0 };
    const monthEntries = entries.filter(e => e.month === latest.month && e.year === latest.year);
    const mg = [];
    const ms = [];
    let loaded = 0;
    for (const prop of deploymentProps) {
      const entry = monthEntries.find(e => e.property_id === prop.id);
      const hasGop = entry && entry.budgeted_gop_actual != null && entry.budgeted_gop_actual !== 0;
      const hasStr = entry && entry.revpar_index != null && entry.revpar_index !== 0;
      if (hasGop && hasStr) {
        loaded++;
      } else {
        if (!hasGop) mg.push(prop);
        if (!hasStr) ms.push(prop);
      }
    }
    return { missingGop: mg, missingStr: ms, loadedCount: loaded };
  }, [deploymentProps, entries, latest]);

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6 flex items-center gap-2 text-muted-foreground text-sm">
        <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />
        Checking data status...
      </div>
    );
  }

  if (!latest) {
    return null;
  }

  const total = deploymentProps.length;
  const missingCount = total - loadedCount;
  const allLoaded = missingCount === 0;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between" style={{ background: '#2d4b5e' }}>
        <div className="flex items-center gap-2">
          <FileWarning className="w-5 h-5 text-white" />
          <h2 className="font-bold text-lg text-white">Missing Data — {MONTHS[latest.month - 1]} {latest.year}</h2>
        </div>
        <span className="text-white/70 text-xs">Due by {latest.dueLabel}</span>
      </div>

      <div className="px-6 py-4 border-b border-border bg-muted/30 flex flex-wrap items-center gap-6">
        <div>
          <div className="text-2xl font-bold text-foreground">{loadedCount}<span className="text-muted-foreground text-base">/{total}</span></div>
          <div className="text-xs text-muted-foreground">Hotels Fully Loaded</div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <div className="text-2xl font-bold text-amber-600">{missingGop.length}</div>
          <div className="text-xs text-muted-foreground">Missing GOP</div>
        </div>
        <div className="h-10 w-px bg-border" />
        <div>
          <div className="text-2xl font-bold text-amber-600">{missingStr.length}</div>
          <div className="text-xs text-muted-foreground">Missing STR</div>
        </div>
        <div className="flex-1 min-w-[120px]">
          <div className="w-full h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${total ? Math.round((loadedCount / total) * 100) : 0}%`, backgroundColor: '#2d4b5e' }}
            />
          </div>
        </div>
      </div>

      <div className="px-6 py-4">
        {allLoaded ? (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <CheckCircle2 className="w-5 h-5" />
            All {total} hotels have GOP and STR data loaded for {MONTHS[latest.month - 1]}.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MissingList title="Missing GOP Data" dueLabel={`Due by ${latest.dueLabel}`} hotels={missingGop} icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} />
            <MissingList title="Missing STR Data" dueLabel={`Due by ${latest.dueLabel}`} hotels={missingStr} icon={<AlertTriangle className="w-4 h-4 text-amber-500" />} />
          </div>
        )}
      </div>
    </div>
  );
}

function MissingList({ title, dueLabel, hotels, icon }) {
  if (!hotels.length) {
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <span className="text-xs text-green-600">All loaded</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-green-700">
          <CheckCircle2 className="w-4 h-4" /> None missing
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        <span className="text-xs text-muted-foreground">{hotels.length} hotels · {dueLabel}</span>
      </div>
      <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
        {hotels.map(h => (
          <span key={h.id} className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
            {h.name}
          </span>
        ))}
      </div>
    </div>
  );
}