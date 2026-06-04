import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Edit2, Trash2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getClosedQuarters, calculateEstimatedAnnualSalary } from '@/lib/salaryCalculation';
import StaffEditModal from './StaffEditModal';

const JOB_CLASS_ORDER = {
  'General Manager': 0,
  'Asst. General Manager / EC Member': 1,
  'Department Head': 2,
};

const JOB_CLASS_LABELS = {
  'General Manager': 'General Managers',
  'Asst. General Manager / EC Member': 'AGM / EC Members',
  'Department Head': 'Department Heads',
};

export default function StaffTable({ staff = [], jobClassifications = [], staffVarianceMap = {}, onQuarterClick }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingStaffId, setEditingStaffId] = useState(null);
  const closedQuarters = getClosedQuarters();

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

  // Group staff by job classification
  const groupedStaff = {};
  staff.forEach(s => {
    const jobClass = jobClassifications.find(jc => jc.id === s.job_classification_id);
    const classTitle = jobClass?.title || 'Unknown';
    if (!groupedStaff[classTitle]) {
      groupedStaff[classTitle] = [];
    }
    groupedStaff[classTitle].push(s);
  });

  // Sort groups by order
  const sortedGroups = Object.keys(groupedStaff).sort(
    (a, b) => (JOB_CLASS_ORDER[a] ?? 999) - (JOB_CLASS_ORDER[b] ?? 999)
  );

  const getDisplayedQ1 = (s) => {
    return s.salary_q1 ? `$${s.salary_q1.toLocaleString()}` : '—';
  };

  const formatEstimatedAnnual = (s) => {
    const estimated = calculateEstimatedAnnualSalary(s, closedQuarters);
    return estimated > 0 ? `$${estimated.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
  };

  if (staff.length === 0) {
    return (
      <div className="bg-card rounded-2xl border border-border p-8 text-center shadow-sm">
        <p className="text-muted-foreground">No staff members added yet.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase tracking-wide" style={{ backgroundColor: '#2d4b5e', color: 'white' }}>
                <th className="py-3 px-4 text-left font-semibold">Name</th>
                <th className="py-3 px-4 text-center font-semibold">Job Classification</th>
                <th className="py-3 px-4 text-center font-semibold">Q1 Salary</th>
                <th className="py-3 px-4 text-center font-semibold">Est. Annual</th>
                <th className="py-3 px-4 text-center font-semibold">vs Target</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
                <th className="py-3 px-4 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map((classTitle, groupIndex) => (
                <React.Fragment key={classTitle}>
                  {/* Group Header */}
                  <tr className="bg-muted/50 border-t border-border">
                    <td colSpan={7} className="py-3 px-4 font-bold text-sm">
                      {JOB_CLASS_LABELS[classTitle] || classTitle} ({groupedStaff[classTitle].length})
                    </td>
                  </tr>
                  {/* Group Rows */}
                  {groupedStaff[classTitle].map((s, idx) => {
                    return (
                      <tr
                        key={s.id}
                        className={`border-t border-border ${
                          (groupIndex + idx) % 2 === 0 ? 'bg-white' : 'bg-muted/20'
                        } hover:bg-muted/40`}
                      >
                        <td className="py-3 px-4 font-medium">{s.name}</td>
                        <td className="py-3 px-4 text-center text-muted-foreground text-xs">{classTitle}</td>
                        <td className="py-3 px-4 text-center">
                          {closedQuarters.includes(1) ? (
                            <button
                              onClick={() => onQuarterClick?.(s.id, 1)}
                              className="text-primary hover:text-primary/80 hover:underline font-medium"
                            >
                              {getDisplayedQ1(s)}
                            </button>
                          ) : (
                            <span className="text-muted-foreground">{getDisplayedQ1(s)}</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center font-semibold">
                          {formatEstimatedAnnual(s)}
                        </td>
                        <td className="py-3 px-4 text-center text-xs font-bold">
                          {(() => {
                            const v = staffVarianceMap[s.id];
                            if (!v) return <span className="text-muted-foreground">—</span>;
                            const { diff, target } = v;
                            const pct = target > 0 ? Math.round((diff / target) * 100) : 0;
                            const color = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b';
                            const dollarStr = diff === 0
                              ? '$0'
                              : `${diff > 0 ? '+' : '-'}$${Math.abs(Math.round(diff)).toLocaleString('en-US')}`;
                            return (
                              <span style={{ color }}>
                                {dollarStr}
                                <span className="block text-[10px] font-normal opacity-80">{diff > 0 ? '+' : ''}{pct}%</span>
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                              s.is_active
                                ? 'bg-pass text-white'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={() => setEditingStaffId(s.id)}
                              className="text-primary hover:text-primary/80"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(s)}
                              className="text-destructive hover:text-destructive/80"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
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