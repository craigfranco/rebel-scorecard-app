import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const Switch = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 rounded-full transition-colors ${
      checked ? 'bg-pass' : 'bg-muted'
    } flex items-center px-1`}
  >
    <div className={`w-4 h-4 rounded-full bg-white transition-transform ${
      checked ? 'translate-x-4' : 'translate-x-0'
    }`} />
  </button>
);

export default function StaffEditModal({ staffId, onClose, jobClassifications }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState(null);

  // Determine closed quarters dynamically based on today's date
  const getClosedQuarters = () => {
    const today = new Date();
    const closedQuarters = [];
    if (today >= new Date('2026-04-01')) closedQuarters.push(1); // Q1 closed Mar 31
    if (today >= new Date('2026-07-01')) closedQuarters.push(2); // Q2 closed Jun 30
    if (today >= new Date('2026-10-01')) closedQuarters.push(3); // Q3 closed Sep 30
    if (today >= new Date('2027-01-01')) closedQuarters.push(4); // Q4 closed Dec 31
    return closedQuarters;
  };

  const calculateProjectedAnnualSalary = (salaries) => {
    const q1 = parseFloat(salaries.salary_q1) || 0;
    const q2 = parseFloat(salaries.salary_q2) || 0;
    const q3 = parseFloat(salaries.salary_q3) || 0;
    const q4 = parseFloat(salaries.salary_q4) || 0;
    const closedQuarters = getClosedQuarters();

    if (closedQuarters.includes(4)) {
      return { total: q1 + q2 + q3 + q4, formula: 'Q1 + Q2 + Q3 + Q4' };
    } else if (closedQuarters.includes(3)) {
      return { total: q1 + q2 + q3 + q3, formula: 'Q1 + Q2 + Q3 × 2' };
    } else if (closedQuarters.includes(2)) {
      return { total: q1 + q2 + q2 * 2, formula: 'Q1 + Q2 × 3' };
    } else {
      return { total: q1 * 4, formula: 'Q1 × 4' };
    }
  };

  const { data: staff } = useQuery({
    queryKey: ['staff-detail', staffId],
    queryFn: () => base44.entities.Staff.filter({ id: staffId }).then(results => results[0]),
    enabled: !!staffId,
  });

  useEffect(() => {
    if (staff) {
      setFormData(staff);
    }
  }, [staff]);

  const updateMutation = useMutation({
    mutationFn: (data) =>
      base44.entities.Staff.update(staffId, {
        name: data.name,
        job_classification_id: data.job_classification_id,
        salary_q1: parseFloat(data.salary_q1) || 0,
        salary_q2: parseFloat(data.salary_q2) || 0,
        salary_q3: parseFloat(data.salary_q3) || 0,
        salary_q4: parseFloat(data.salary_q4) || 0,
        is_active: data.is_active,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Updated', description: 'Staff member updated successfully.' });
      onClose();
    },
  });

  const handleSave = () => {
    if (!formData.name) {
      toast({ title: 'Error', description: 'Name is required.' });
      return;
    }
    updateMutation.mutate(formData);
  };

  if (!formData) return null;

  // Filter out Supervisor from job classifications
  const filteredJobClassifications = jobClassifications.filter(
    jc => !jc.title.toLowerCase().includes('supervisor')
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-2xl border border-border p-8 shadow-lg max-w-2xl w-full">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-lg">Edit Staff Member</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-2 block">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-2 block">Job Classification</label>
              <Select value={formData.job_classification_id} onValueChange={(id) => setFormData({ ...formData, job_classification_id: id })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select classification..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredJobClassifications.sort((a, b) => {
                    if (a.title === 'General Manager') return -1;
                    if (b.title === 'General Manager') return 1;
                    return a.title.localeCompare(b.title);
                  }).map((jc) => (
                    <SelectItem key={jc.id} value={jc.id}>
                      {jc.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-2 block">Quarterly Salaries</label>
            <p className="text-xs text-muted-foreground mb-3">Only closed quarters are displayed. Q2 unlocks July 1, 2026.</p>
            <div className="grid grid-cols-4 gap-3">
              {[
                { q: 'Q1', field: 'salary_q1', quarterNum: 1 },
                { q: 'Q2', field: 'salary_q2', quarterNum: 2, unlockDate: 'July 1, 2026' },
                { q: 'Q3', field: 'salary_q3', quarterNum: 3, unlockDate: 'Oct 1, 2026' },
                { q: 'Q4', field: 'salary_q4', quarterNum: 4, unlockDate: 'Jan 1, 2027' }
              ]
                .filter(({ quarterNum }) => getClosedQuarters().includes(quarterNum))
                .map(({ q, field }) => (
                <div key={q}>
                  <label className="text-xs text-muted-foreground mb-1 block">{q}</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={formData[field] || ''}
                    onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                  />
                </div>
              ))}
            </div>
            <div className="mt-3 p-3 bg-muted/30 rounded">
              {(() => {
                const projData = calculateProjectedAnnualSalary(formData);
                return (
                  <p className="text-xs text-muted-foreground">
                    Projected Annual Salary: <span className="font-semibold text-foreground">${projData.total.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span> <span className="text-muted-foreground">({projData.formula})</span>
                  </p>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground font-semibold mb-2 block">Active</label>
            <div className="flex items-center gap-2">
              <Switch checked={formData.is_active} onChange={(val) => setFormData({ ...formData, is_active: val })} />
              <span className="text-sm text-muted-foreground">{formData.is_active ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={handleSave} disabled={updateMutation.isPending} style={{ backgroundColor: '#2d4b5e' }}>
            <Save className="w-4 h-4 mr-2" />
            Update
          </Button>
          <Button onClick={onClose} variant="outline">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}