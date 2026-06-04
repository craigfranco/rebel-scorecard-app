import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { calculateScorecard } from '@/lib/scoring';
import {
  calculateQuarterlyPayouts,
  calcAnnualSummary,
  calcEstimatedAnnualSalary,
  kpiScoreBg,
  fmt$,
} from '@/lib/payoutsCalculation';
import StaffEditModal from './StaffEditModal';

const QUARTERS = [1, 2, 3, 4];
const QUARTER_LABELS = { 1: 'Q1', 2: 'Q2', 3: 'Q3', 4: 'Q4' };

function getEntriesByQuarter(entries, year) {
  const map = {};
  const quarterMonths = { 1: [1, 2, 3], 2: [4, 5, 6], 3: [7, 8, 9], 4: [10, 11, 12] };
  for (const q of QUARTERS) {
    const months = quarterMonths[q];
    const relevant = entries.filter(e => e.year === year && months.includes(e.month));
    map[q] = relevant.length ? relevant[relevant.length - 1] : null;
  }
  return map;
}

function KpiChip({ score }) {
  if (score === null || score === undefined) {
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">No Data</span>;
  }
  const cls = kpiScoreBg(score);
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${cls}`}>{score.toFixed(1)}</span>;
}

function QuarterRow({ qData }) {
  return (
    <tr className="border-t border-border/50 bg-muted/10 text-xs">
      <td className="py-2 px-4 pl-14 text-muted-foreground font-medium">{QUARTER_LABELS[qData.quarter]}</td>
      <td className="py-2 px-4 text-center text-muted-foreground">
        {qData.hasSalary ? fmt$(qData.salary) : <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="py-2 px-4 text-center">
        {qData.hasSalary ? <KpiChip score={qData.kpiScore} /> : <span className="text-muted-foreground/50">—</span>}
      </td>
      <td className="py-2 px-4 text-center text-muted-foreground">
        {qData.hasSalary && qData.bonusTargetPct > 0 ? fmt$(qData.bonusTarget) : '—'}
      </td>
      <td className="py-2 px-4 text-center font-medium text-foreground">
        {qData.bonusEarned > 0 ? fmt$(qData.bonusEarned) : '—'}
      </td>
      <td className="py-2 px-4 text-center font-semibold" style={{ color: qData.quarterlyPayout > 0 ? '#2d4b5e' : undefined }}>
        {qData.quarterlyPayout > 0 ? fmt$(qData.quarterlyPayout) : '—'}
      </td>
      <td className="py-2 px-4" colSpan={4} />
    </tr>
  );
}

function StaffRow({ staff, property, entries, year, jobClassTitle, onEdit, onDelete, isOdd }) {
  const [expanded, setExpanded] = useState(false);

  const entriesByQuarter = useMemo(() => getEntriesByQuarter(entries, year), [entries, year]);

  const quarterlyData = useMemo(
    () => calculateQuarterlyPayouts(staff, entriesByQuarter, calculateScorecard, property),
    [staff, entriesByQuarter, property]
  );

  const summary = useMemo(() => calcAnnualSummary(quarterlyData, staff), [quarterlyData, staff]);
  const { value: estAnnual, isEstimate } = calcEstimatedAnnualSalary(staff);

  // Find the most recent quarter with data for the summary row KPI display
  const latestQWithData = [...quarterlyData].reverse().find(q => q.hasData && q.hasSalary);

  return (
    <>
      <tr
        className={`border-t border-border cursor-pointer ${isOdd ? 'bg-muted/10' : 'bg-white'} hover:bg-muted/30 transition-colors`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Expand toggle + Name */}
        <td className="py-3 px-4">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">
              {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
            <span className="font-medium text-sm">{staff.name}</span>
          </div>
        </td>

        {/* Job Classification */}
        <td className="py-3 px-4 text-center text-xs text-muted-foreground">{jobClassTitle}</td>

        {/* Q Salary — show the current/latest available quarter salary */}
        <td className="py-3 px-4 text-center text-sm">
          {latestQWithData ? (
            <span className="font-medium">{fmt$(latestQWithData.salary)}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>

        {/* KPI Score */}
        <td className="py-3 px-4 text-center">
          {latestQWithData ? (
            <KpiChip score={latestQWithData.kpiScore} />
          ) : (
            <span className="text-xs text-muted-foreground">No KPI Data</span>
          )}
        </td>

        {/* Bonus Earned (total so far) */}
        <td className="py-3 px-4 text-center text-sm font-medium">
          {summary.totalBonusEarned > 0 ? fmt$(summary.totalBonusEarned) : '—'}
        </td>

        {/* Quarterly Payout (total paid so far) */}
        <td className="py-3 px-4 text-center text-sm font-semibold" style={{ color: summary.totalQuarterlyPayouts > 0 ? '#2d4b5e' : undefined }}>
          {summary.totalQuarterlyPayouts > 0 ? fmt$(summary.totalQuarterlyPayouts) : '—'}
        </td>

        {/* Est. Annual */}
        <td className="py-3 px-4 text-center text-sm">
          {estAnnual > 0 ? (
            <span>
              {fmt$(estAnnual)}
              {isEstimate && <span className="ml-1 text-[10px] text-muted-foreground">Est.</span>}
            </span>
          ) : '—'}
        </td>

        {/* Status */}
        <td className="py-3 px-4 text-center">
          <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${
            staff.is_active ? 'bg-pass text-white' : 'bg-muted text-muted-foreground'
          }`}>
            {staff.is_active ? 'Active' : 'Inactive'}
          </span>
        </td>

        {/* Actions */}
        <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
          <div className="flex gap-2 justify-center">
            <button onClick={() => onEdit(staff.id)} className="text-primary hover:text-primary/80" title="Edit">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDelete(staff)} className="text-destructive hover:text-destructive/80" title="Delete">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </td>
      </tr>

      {/* Quarterly Detail Rows */}
      {expanded && quarterlyData.map(qData => (
        <QuarterRow key={qData.quarter} qData={qData} />
      ))}

      {/* Annual Summary Row when expanded */}
      {expanded && (
        <tr className="border-t border-primary/20 bg-primary/5 text-xs font-semibold">
          <td className="py-2 px-4 pl-14 text-primary">Annual Total</td>
          <td className="py-2 px-4" />
          <td className="py-2 px-4 text-center text-muted-foreground">
            {estAnnual > 0 ? (
              <span>{fmt$(estAnnual)}{isEstimate && <span className="ml-1 text-[10px] font-normal text-muted-foreground">Est.</span>}</span>
            ) : '—'}
          </td>
          <td className="py-2 px-4" />
          <td className="py-2 px-4 text-center text-muted-foreground">
            {staff.bonus_target_pct ? `${staff.bonus_target_pct}% of salary` : '—'}
          </td>
          <td className="py-2 px-4 text-center text-foreground">{summary.totalBonusEarned > 0 ? fmt$(summary.totalBonusEarned) : '—'}</td>
          <td className="py-2 px-4 text-center" style={{ color: '#2d4b5e' }}>
            <div>{summary.totalQuarterlyPayouts > 0 ? fmt$(summary.totalQuarterlyPayouts) : '—'}</div>
            {summary.remainingBonus > 0 && (
              <div className="text-[10px] font-normal text-amber-600">+{fmt$(summary.remainingBonus)} year-end</div>
            )}
          </td>
          <td colSpan={3} />
        </tr>
      )}
    </>
  );
}

export default function StaffPayoutTable({ staff = [], property, entries = [], year, jobClassifications = [] }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingStaffId, setEditingStaffId] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Staff.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Deleted', description: 'Staff member removed.' });
    },
  });

  const handleDelete = (staffMember) => {
    if (window.confirm(`Remove ${staffMember.name} from staff?`)) {
      deleteMutation.mutate(staffMember.id);
    }
  };

  // Group by job classification title
  const grouped = useMemo(() => {
    const map = {};
    staff.forEach(s => {
      const jc = jobClassifications.find(j => j.id === s.job_classification_id);
      const title = jc?.title || 'Unclassified';
      if (!map[title]) map[title] = [];
      map[title].push(s);
    });
    // Sort: General Manager first, then alphabetical
    return Object.entries(map).sort(([a], [b]) => {
      if (a === 'General Manager') return -1;
      if (b === 'General Manager') return 1;
      return a.localeCompare(b);
    });
  }, [staff, jobClassifications]);

  // Portfolio totals
  const allQuarterlyData = useMemo(() => {
    return staff.map(s => {
      const ebq = getEntriesByQuarter(entries, year);
      return calculateQuarterlyPayouts(s, ebq, calculateScorecard, property);
    });
  }, [staff, entries, year, property]);

  const portfolioTotals = useMemo(() => {
    let totalBonus = 0, totalPayouts = 0, totalRemaining = 0;
    allQuarterlyData.forEach(qArr => {
      qArr.forEach(q => {
        totalBonus += q.bonusEarned;
        totalPayouts += q.quarterlyPayout;
        totalRemaining += q.retainedBonus;
      });
    });
    return { totalBonus, totalPayouts, totalRemaining };
  }, [allQuarterlyData]);

  if (!staff.length) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
        <p className="text-muted-foreground text-sm">No staff members added yet. Click "Add Staff Member" to get started.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#2d4b5e', color: 'white' }} className="text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold">Name</th>
                <th className="py-3 px-4 text-center font-semibold">Job Classification</th>
                <th className="py-3 px-4 text-center font-semibold">Q Salary</th>
                <th className="py-3 px-4 text-center font-semibold">KPI Score</th>
                <th className="py-3 px-4 text-center font-semibold">Bonus Earned</th>
                <th className="py-3 px-4 text-center font-semibold">Q Payout (50%)</th>
                <th className="py-3 px-4 text-center font-semibold">Est. Annual</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
                <th className="py-3 px-4 text-center font-semibold w-20"></th>
              </tr>
            </thead>
            <tbody>
              {grouped.map(([classTitle, groupStaff]) => (
                <React.Fragment key={classTitle}>
                  <tr className="bg-muted/50 border-t border-border">
                    <td colSpan={9} className="py-2 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">
                      {classTitle} <span className="font-normal">({groupStaff.length})</span>
                    </td>
                  </tr>
                  {groupStaff.map((s, idx) => (
                    <StaffRow
                      key={s.id}
                      staff={s}
                      property={property}
                      entries={entries}
                      year={year}
                      jobClassTitle={classTitle}
                      onEdit={setEditingStaffId}
                      onDelete={handleDelete}
                      isOdd={idx % 2 !== 0}
                    />
                  ))}
                </React.Fragment>
              ))}
            </tbody>

            {/* Portfolio Total Row */}
            <tfoot>
              <tr style={{ backgroundColor: '#1e3547', color: 'white' }}>
                <td colSpan={4} className="py-3 px-4 font-bold text-sm">Portfolio Totals</td>
                <td className="py-3 px-4 text-center font-bold text-sm">{fmt$(portfolioTotals.totalBonus)}</td>
                <td className="py-3 px-4 text-center font-bold text-sm">{fmt$(portfolioTotals.totalPayouts)}</td>
                <td colSpan={3} className="py-3 px-4 text-right text-xs text-white/60 pr-6">
                  {portfolioTotals.totalRemaining > 0 && `+${fmt$(portfolioTotals.totalRemaining)} year-end retained`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {editingStaffId && (
        <StaffEditModal
          staffId={editingStaffId}
          onClose={() => setEditingStaffId(null)}
          jobClassifications={jobClassifications}
        />
      )}
    </>
  );
}