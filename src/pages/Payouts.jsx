import React, { useState, useMemo, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Save, ChevronRight, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import StaffPayoutTable from '@/components/payouts/StaffPayoutTable';
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

const EMPTY_FORM = (propertyId, year) => ({
  name: '',
  property_id: propertyId || '',
  job_classification_id: '',
  bonus_target_pct: '',
  salary_q1: '',
  salary_q2: '',
  salary_q3: '',
  salary_q4: '',
  year: year,
  is_active: true,
});

export default function Payouts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedYear } = useTimePeriod();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState(EMPTY_FORM('', selectedYear));

  // Active properties — deduplicated by name
  const { data: rawProperties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.filter({ is_active: true }, 'name', 100),
  });

  const properties = useMemo(() => {
    const seen = new Map();
    for (const p of rawProperties) {
      if (!seen.has(p.name)) seen.set(p.name, p);
    }
    return Array.from(seen.values());
  }, [rawProperties]);

  const { data: jobClassifications = [] } = useQuery({
    queryKey: ['job-classifications'],
    queryFn: () => base44.entities.JobClassification.list('title', 100),
  });

  const { data: staffMembers = [] } = useQuery({
    queryKey: ['staff', selectedPropertyId, selectedYear],
    queryFn: () =>
      selectedPropertyId
        ? base44.entities.Staff.filter({ property_id: selectedPropertyId, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!selectedPropertyId,
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries', selectedPropertyId, selectedYear],
    queryFn: () =>
      selectedPropertyId
        ? base44.entities.ScoreEntry.filter({ property_id: selectedPropertyId, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!selectedPropertyId,
  });

  const addStaffMutation = useMutation({
    mutationFn: (data) => base44.entities.Staff.create({
      name: data.name,
      property_id: data.property_id,
      job_classification_id: data.job_classification_id,
      bonus_target_pct: parseFloat(data.bonus_target_pct) || 0,
      salary_q1: parseFloat(data.salary_q1) || 0,
      salary_q2: parseFloat(data.salary_q2) || 0,
      salary_q3: parseFloat(data.salary_q3) || 0,
      salary_q4: parseFloat(data.salary_q4) || 0,
      year: data.year,
      is_active: data.is_active,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', selectedPropertyId, selectedYear] });
      setShowAddForm(false);
      setNewStaff(EMPTY_FORM(selectedPropertyId, selectedYear));
      toast({ title: 'Staff added', description: 'New staff member added successfully.' });
    },
  });

  const handleAddStaff = () => {
    if (!newStaff.name.trim()) {
      toast({ title: 'Error', description: 'Name is required.', variant: 'destructive' });
      return;
    }
    if (!newStaff.job_classification_id) {
      toast({ title: 'Error', description: 'Job Classification is required.', variant: 'destructive' });
      return;
    }
    if (!newStaff.property_id) {
      toast({ title: 'Error', description: 'Hotel is required.', variant: 'destructive' });
      return;
    }
    addStaffMutation.mutate(newStaff);
  };

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Auto-select first property
  useEffect(() => {
    if (properties.length && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties]);

  const { value: previewAnnual, isEstimate: previewIsEst } = calcEstimatedAnnualSalary(newStaff);

  const sortedJC = useMemo(() => [...jobClassifications].sort((a, b) => {
    if (a.title === 'General Manager') return -1;
    if (b.title === 'General Manager') return 1;
    return a.title.localeCompare(b.title);
  }), [jobClassifications]);

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <span>Operations</span>
              <ChevronRight className="w-3 h-3" />
              <span>Payouts</span>
            </div>
            <h1 className="text-2xl font-bold">Bonus Payouts</h1>
            <p className="text-white/60 text-xs mt-0.5">Quarterly KPI-based bonus calculations per staff member</p>
          </div>

          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger className="w-full sm:w-72 bg-white/10 border-white/20 text-white">
              <SelectValue placeholder="Select property..." />
            </SelectTrigger>
            <SelectContent>
              {properties.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-xs text-muted-foreground">{p.city}, {p.state}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedProperty ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm">
          <p className="text-muted-foreground">Select a property to view payouts.</p>
        </div>
      ) : (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">{selectedProperty.name}</p>
              <p className="text-xs text-muted-foreground">{staffMembers.length} staff member{staffMembers.length !== 1 ? 's' : ''} · {selectedYear}</p>
            </div>
            <Button
              onClick={() => {
                setNewStaff(EMPTY_FORM(selectedPropertyId, selectedYear));
                setShowAddForm(true);
              }}
              className="gap-2"
              style={{ backgroundColor: '#2d4b5e' }}
            >
              <Plus className="w-4 h-4" />
              Add Staff Member
            </Button>
          </div>

          {/* Staff Payout Table */}
          <StaffPayoutTable
            staff={staffMembers}
            property={selectedProperty}
            entries={entries}
            year={selectedYear}
            jobClassifications={jobClassifications}
          />
        </>
      )}

      {/* Add Staff Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-2xl border border-border p-6 shadow-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Add Staff Member</h3>
              <button onClick={() => setShowAddForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Full Name *</label>
                <Input
                  placeholder="Staff member name"
                  value={newStaff.name}
                  onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                />
              </div>

              {/* Job Classification */}
              <div>
                <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Job Classification *</label>
                <Select value={newStaff.job_classification_id} onValueChange={id => setNewStaff({ ...newStaff, job_classification_id: id })}>
                  <SelectTrigger><SelectValue placeholder="Select classification..." /></SelectTrigger>
                  <SelectContent>
                    {sortedJC.map(jc => <SelectItem key={jc.id} value={jc.id}>{jc.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Hotel */}
              <div>
                <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Hotel *</label>
                <Select value={newStaff.property_id} onValueChange={pid => setNewStaff({ ...newStaff, property_id: pid })}>
                  <SelectTrigger><SelectValue placeholder="Select hotel..." /></SelectTrigger>
                  <SelectContent>
                    {properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
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
                    value={newStaff.bonus_target_pct}
                    onChange={e => setNewStaff({ ...newStaff, bonus_target_pct: e.target.value })}
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
                          value={newStaff[`salary_q${q}`]}
                          onChange={e => setNewStaff({ ...newStaff, [`salary_q${q}`]: e.target.value })}
                          className="pl-6"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Annual preview */}
              {previewAnnual > 0 && (
                <div className="p-3 bg-muted/30 rounded-lg flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-semibold">Est. Annual Salary</span>
                  <span className="text-sm font-bold text-foreground">
                    ${previewAnnual.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    {previewIsEst && <span className="ml-1.5 text-xs font-normal text-muted-foreground">Est.</span>}
                  </span>
                </div>
              )}

              {/* Year */}
              <div>
                <label className="text-xs text-muted-foreground font-semibold mb-1.5 block">Year</label>
                <Input
                  type="number"
                  value={newStaff.year}
                  onChange={e => setNewStaff({ ...newStaff, year: parseInt(e.target.value) })}
                />
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground font-semibold">Status</label>
                <div className="flex items-center gap-2">
                  <Switch checked={newStaff.is_active} onChange={val => setNewStaff({ ...newStaff, is_active: val })} />
                  <span className="text-sm text-muted-foreground">{newStaff.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <Button onClick={handleAddStaff} disabled={addStaffMutation.isPending} style={{ backgroundColor: '#2d4b5e' }}>
                <Save className="w-4 h-4 mr-2" />
                Add Staff Member
              </Button>
              <Button onClick={() => setShowAddForm(false)} variant="outline">Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}