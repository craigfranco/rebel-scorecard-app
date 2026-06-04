import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { calcEstimatedAnnualSalary } from '@/lib/payoutsCalculation';

const Switch = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 rounded-full transition-colors ${checked ? 'bg-pass' : 'bg-muted'} flex items-center px-1`}
  >
    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
  </button>
);

const QUARTER_LABELS = [
  { q: 1, label: 'Q1 (Jan–Mar)' },
  { q: 2, label: 'Q2 (Apr–Jun)' },
  { q: 3, label: 'Q3 (Jul–Sep)' },
  { q: 4, label: 'Q4 (Oct–Dec)' },
];

export default function StaffEditModal({ staffId, onClose, jobClassifications }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(null);

  const { data: staff } = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: () => base44.entities.Staff.filter({ id: staffId }).then(results => results[0]),
    enabled: !!staffId,
  });

  useEffect(() => {
    if (staff) setFormData(staff);
  }, [staff]);

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.update(staffId, {
      name: data.name,
      job_classification_id: data.job_classification_id,
      bonus_target_pct: parseFloat(data.bonus_target_pct) || 0,
      salary_q1: parseFloat(data.salary_q1) || 0,
      salary_q2: parseFloat(data.salary_q2) || 0,
      salary_q3: parseFloat(data.salary_q3) || 0,
      salary_q4: parseFloat(data.salary_q4) || 0,
      is_active: data.is_active,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Updated', description: 'Staff member updated.' });
      onClose();
    },
  });

  if (!formData) return null;

  const { value: estAnnual, isEstimate } = calcEstimatedAnnualSalary(formData);

  const sortedJC = [...jobClassifications].sort((a, b) => {
    if (a.title === 'General Manager') return -1;
    if (b.title === 'General Manager') return 1;
    return a.title.localeCompare(b.title);
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border p-6 shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg">Edit Staff Member</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Name *</label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>

          {/* Job Classification */}
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Job Classification *</label>
            <Select value={formData.job_classification_id} onValueChange={id => setFormData({ ...formData, job_classification_id: id })}>
              <SelectTrigger><SelectValue placeholder="Select classification..." /></SelectTrigger>
              <SelectContent>
                {sortedJC.map(jc => <SelectItem key={jc.id} value={jc.id}>{jc.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Bonus Target % */}
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Bonus Target % (of quarterly salary)</label>
            <div className="relative">
              <Input
                type="number"
                placeholder="e.g. 20"
                min="0"
                max="100"
                value={formData.bonus_target_pct ?? ''}
                onChange={e => setFormData({ ...formData, bonus_target_pct: e.target.value })}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
          </div>

          {/* Quarterly Salaries */}
          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Quarterly Salaries</label>
            <div className="grid grid-cols-2 gap-3">
              {QUARTER_LABELS.map(({ q, label }) => (
                <div key={q}>
                  <label className="text-[11px] text-muted-foreground mb-1 block">{label}</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                    <Input
                      type="number"
                      placeholder="0"
                      value={formData[`salary_q${q}`] || ''}
                      onChange={e => setFormData({ ...formData, [`salary_q${q}`]: e.target.value })}
                      className="pl-6"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Est. Annual */}
          {estAnnual > 0 && (
            <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Est. Annual Salary</span>
              <span className="text-sm font-bold text-foreground">
                ${estAnnual.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                {isEstimate && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Est.</span>}
              </span>
            </div>
          )}

          {/* Active toggle */}
          <div className="flex items-center justify-between">
            <label className="text-xs text-muted-foreground font-semibold">Active</label>
            <div className="flex items-center gap-2">
              <Switch checked={!!formData.is_active} onChange={val => setFormData({ ...formData, is_active: val })} />
              <span className="text-sm text-muted-foreground">{formData.is_active ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={() => updateMutation.mutate(formData)} disabled={updateMutation.isPending} style={{ backgroundColor: '#2d4b5e' }}>
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
          <Button onClick={onClose} variant="outline">Cancel</Button>
        </div>
      </div>
    </div>
  );
}