import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { getClosedQuarters, calculateActualYtdSalary } from '@/lib/salaryCalculation';
import StaffEditModal from './StaffEditModal';
import StaffExpandedRow from './StaffExpandedRow';

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

export default function StaffTable({ staff = [], jobClassifications = [], properties = [], salaryColHeader = 'Q1 Salary', onQuarterClick }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [expandedStaffId, setExpandedStaffId] = useState(null);
  const closedQuarters = getClosedQuarters();

  // Dynamic header: "Annual Total" if all 4 quarters have salary data (for any staff), else "YTD Salary"
  const ytdColHeader = (() => {
    const maxQtrsWithData = staff.reduce((max, s) => {
      const { count } = calculateActualYtdSalary(s);
      return Math.max(max, count);
    }, 0);
    return maxQtrsWithData === 4 ? 'Annual Total' : 'YTD Salary';
  })();

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

  const formatYtdSalary = (s) => {
    const { total, quarters } = calculateActualYtdSalary(s);
    if (total === 0) return '—';
    return `$${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
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
                <th className="py-3 px-4 text-center font-semibold">{salaryColHeader}</th>
                <th className="py-3 px-4 text-center font-semibold">{ytdColHeader}</th>
                <th className="py-3 px-4 text-center font-semibold">Status</th>
                <th className="py-3 px-4 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {sortedGroups.map((classTitle, groupIndex) => (
                <React.Fragment key={classTitle}>
                  {/* Group Header */}
                  <tr className="bg-muted/50 border-t border-border">
                    <td colSpan={6} className="py-3 px-4 font-bold text-sm">
                      {JOB_CLASS_LABELS[classTitle] || classTitle} ({groupedStaff[classTitle].length})
                    </td>
                  </tr>
                  {/* Group Rows */}
                  {groupedStaff[classTitle].map((s, idx) => {
                    const isExpanded = expandedStaffId === s.id;
                    const property = properties.find(p => p.id === s.property_id);
                    const jobClass = jobClassifications.find(jc => jc.id === s.job_classification_id);
                    return (
                      <React.Fragment key={s.id}>
                        <tr
                          className={`border-t border-border cursor-pointer ${
                            isExpanded ? 'bg-slate-100' : (groupIndex + idx) % 2 === 0 ? 'bg-white' : 'bg-muted/20'
                          } hover:bg-slate-100`}
                          onClick={() => setExpandedStaffId(isExpanded ? null : s.id)}
                        >
                          <td className="py-3 px-4 font-medium">
                            <div className="flex items-center gap-2">
                              {isExpanded
                                ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                              }
                              {s.name}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center text-muted-foreground text-xs">{classTitle}</td>
                          <td className="py-3 px-4 text-center">
                            {closedQuarters.includes(1) ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); onQuarterClick?.(s.id, 1); }}
                                className="text-primary hover:text-primary/80 hover:underline font-medium"
                              >
                                {getDisplayedQ1(s)}
                              </button>
                            ) : (
                              <span className="text-muted-foreground">{getDisplayedQ1(s)}</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-semibold">
                            {formatYtdSalary(s)}
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
                          <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
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
                        {isExpanded && (
                          <StaffExpandedRow
                            staff={s}
                            property={property}
                            jobClass={jobClass}
                            colSpan={6}
                          />
                        )}
                      </React.Fragment>
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