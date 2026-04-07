import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Save, ChevronRight, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { calculateQuarterlyBonus, calculateAnnualBonus, getMetricStatus } from '@/lib/bonusCalculation';
import { calculateScorecard, MONTHS, getQuarterFromMonth } from '@/lib/scoring';

const CURRENT_YEAR = 2026;

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

export default function Payouts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStaff, setNewStaff] = useState({ 
    name: '', 
    property_id: '', 
    job_classification_id: '', 
    salary_q1: '', 
    salary_q2: '', 
    salary_q3: '', 
    salary_q4: '',
    year: CURRENT_YEAR,
    is_active: true
  });

  // Fetch data
  const { data: properties = [] } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('name', 100),
  });

  const { data: jobClassifications = [] } = useQuery({
    queryKey: ['job-classifications'],
    queryFn: () => base44.entities.JobClassification.list('title', 100),
  });

  const { data: staffMembers = [] } = useQuery({
    queryKey: ['staff', selectedPropertyId, selectedYear],
    queryFn: () =>
      selectedPropertyId
        ? base44.entities.Staff.filter({ property_id: selectedPropertyId, year: selectedYear, is_active: true })
        : Promise.resolve([]),
    enabled: !!selectedPropertyId,
  });

  const { data: allStaff = [] } = useQuery({
    queryKey: ['all-staff'],
    queryFn: () => base44.entities.Staff.list('name', 500),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ['score-entries', selectedPropertyId, selectedYear],
    queryFn: () =>
      selectedPropertyId
        ? base44.entities.ScoreEntry.filter({ property_id: selectedPropertyId, year: selectedYear })
        : Promise.resolve([]),
    enabled: !!selectedPropertyId,
  });

  const { data: bonusPayouts = [] } = useQuery({
    queryKey: ['bonus-payouts', selectedPropertyId, selectedYear],
    queryFn: () =>
      selectedPropertyId
        ? base44.entities.BonusPayout.filter({ year: selectedYear })
        : Promise.resolve([]),
    enabled: !!selectedPropertyId,
  });

  // Mutations
  const addStaffMutation = useMutation({
    mutationFn: (data) => {
      const avgSalary = (parseFloat(data.salary_q1 || 0) + parseFloat(data.salary_q2 || 0) + parseFloat(data.salary_q3 || 0) + parseFloat(data.salary_q4 || 0)) / 4;
      return base44.entities.Staff.create({
        name: data.name,
        property_id: data.property_id,
        job_classification_id: data.job_classification_id,
        year: data.year,
        is_active: data.is_active,
        salary_q1: parseFloat(data.salary_q1) || avgSalary,
        salary_q2: parseFloat(data.salary_q2) || avgSalary,
        salary_q3: parseFloat(data.salary_q3) || avgSalary,
        salary_q4: parseFloat(data.salary_q4) || avgSalary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', selectedPropertyId, selectedYear] });
      queryClient.invalidateQueries({ queryKey: ['all-staff'] });
      setNewStaff({ 
        name: '', 
        property_id: selectedPropertyId, 
        job_classification_id: '', 
        salary_q1: '', 
        salary_q2: '', 
        salary_q3: '', 
        salary_q4: '',
        year: CURRENT_YEAR,
        is_active: true
      });
      setShowAddForm(false);
      toast({ title: 'Staff added', description: 'New staff member added successfully.' });
    },
  });

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);
  const selectedStaff = allStaff.find(s => s.id === selectedStaffId);

  // Calculate estimated annual salary
  const getEstimatedAnnualSalary = (staff) => {
    const salaries = [staff.salary_q1, staff.salary_q2, staff.salary_q3, staff.salary_q4].filter(s => s);
    if (salaries.length === 0) return 0;
    return (salaries.reduce((sum, s) => sum + s, 0) / salaries.length) * 4;
  };

  // Calculate bonus for selected staff
  const selectedStaffBonus = selectedStaff && selectedProperty ? (() => {
    const jobClass = jobClassifications.find(jc => jc.id === selectedStaff.job_classification_id);
    if (!jobClass) return null;

    const staffEntries = entries.filter(e => e.property_id === selectedPropertyId);
    if (staffEntries.length === 0) return null;

    const entry = staffEntries[staffEntries.length - 1];
    const scorecard = calculateScorecard(entry, selectedProperty);
    const estAnnualSalary = getEstimatedAnnualSalary(selectedStaff);

    const quarterlyBonus = calculateQuarterlyBonus(
      { ...selectedStaff, annual_salary: estAnnualSalary },
      scorecard,
      jobClass,
      entry
    );

    return {
      ...selectedStaff,
      jobClass,
      quarterlyBonus,
      scorecard,
      entry,
      estimatedAnnualSalary: estAnnualSalary,
    };
  })() : null;

  const handleAddStaff = () => {
    if (!newStaff.name || !newStaff.job_classification_id) {
      toast({ title: 'Error', description: 'Name and Job Classification are required.' });
      return;
    }
    addStaffMutation.mutate(newStaff);
  };

  // Auto-select first property
  React.useEffect(() => {
    if (properties.length && !selectedPropertyId) {
      setSelectedPropertyId(properties[0].id);
    }
  }, [properties]);

  // Reset staff selection when property changes
  React.useEffect(() => {
    setSelectedStaffId('');
  }, [selectedPropertyId]);

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
            <h1 className="text-2xl font-bold">Operations Bonuses</h1>
            {selectedProperty && (
              <p className="text-white/70 text-sm mt-1">{selectedProperty.city}, {selectedProperty.state}</p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
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
      </div>

      {!selectedProperty ? (
        <div className="bg-card rounded-2xl border border-border p-16 text-center shadow-sm">
          <p className="text-muted-foreground">Select a property to view payouts.</p>
        </div>
      ) : (
        <>
          {/* Add Staff Button */}
          <Button onClick={() => {
            setNewStaff({ 
              name: '', 
              property_id: selectedPropertyId, 
              job_classification_id: '', 
              salary_q1: '', 
              salary_q2: '', 
              salary_q3: '', 
              salary_q4: '',
              year: CURRENT_YEAR,
              is_active: true
            });
            setShowAddForm(true);
          }} className="gap-2" style={{ backgroundColor: '#2d4b5e' }}>
            <Plus className="w-4 h-4" />
            Add Staff Member
          </Button>

          {/* Add Staff Form Modal */}
          {showAddForm && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-card rounded-2xl border border-border p-8 shadow-lg max-w-2xl w-full">
                <h3 className="font-bold mb-6 text-lg">Add New Staff Member</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold mb-2 block">Name *</label>
                      <Input
                        placeholder="Staff name"
                        value={newStaff.name}
                        onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold mb-2 block">Job Classification *</label>
                      <Select value={newStaff.job_classification_id} onValueChange={id => setNewStaff({ ...newStaff, job_classification_id: id })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select classification..." />
                        </SelectTrigger>
                        <SelectContent>
                          {jobClassifications.map(jc => (
                            <SelectItem key={jc.id} value={jc.id}>{jc.title}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground font-semibold mb-2 block">Property</label>
                    <Select value={newStaff.property_id} onValueChange={pid => setNewStaff({ ...newStaff, property_id: pid })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select property..." />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground font-semibold mb-2 block">Quarterly Salaries</label>
                    <div className="grid grid-cols-4 gap-3">
                      {['Q1', 'Q2', 'Q3', 'Q4'].map((q, i) => (
                        <div key={q}>
                          <label className="text-xs text-muted-foreground mb-1 block">{q}</label>
                          <Input
                            placeholder="0"
                            type="number"
                            value={newStaff[`salary_${q.toLowerCase()}`]}
                            onChange={e => setNewStaff({ ...newStaff, [`salary_${q.toLowerCase()}`]: e.target.value })}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold mb-2 block">Year</label>
                      <Input
                        type="number"
                        value={newStaff.year}
                        onChange={e => setNewStaff({ ...newStaff, year: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-semibold mb-2 block">Active</label>
                      <div className="flex items-center gap-2">
                        <Switch checked={newStaff.is_active} onChange={val => setNewStaff({ ...newStaff, is_active: val })} />
                        <span className="text-sm text-muted-foreground">{newStaff.is_active ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 mt-6">
                  <Button onClick={handleAddStaff} disabled={addStaffMutation.isPending} style={{ backgroundColor: '#2d4b5e' }}>
                    <Save className="w-4 h-4 mr-2" />
                    Create Staff Member
                  </Button>
                  <Button onClick={() => setShowAddForm(false)} variant="outline">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Bonus Breakdown */}
          {selectedStaffBonus && (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="font-bold mb-4 text-lg">Bonus Breakdown — {selectedStaffBonus.name}</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                      <th className="py-3 px-4 text-left font-semibold">Metric</th>
                      <th className="py-3 px-4 text-center font-semibold">Actual</th>
                      <th className="py-3 px-4 text-center font-semibold">Target</th>
                      <th className="py-3 px-4 text-center font-semibold">Status</th>
                      <th className="py-3 px-4 text-right font-semibold">Bonus %</th>
                      <th className="py-3 px-4 text-right font-semibold">Bonus $</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t border-border hover:bg-muted/30">
                      <td className="py-3 px-4 font-medium">Base Salary</td>
                      <td colSpan="5" className="py-3 px-4 text-right">${(selectedStaffBonus.estimatedAnnualSalary).toFixed(0)}</td>
                    </tr>
                    {selectedStaffBonus.quarterlyBonus && Object.entries(selectedStaffBonus.quarterlyBonus).map(([key, val]) => (
                      typeof val === 'number' && key !== 'total' && (
                        <tr key={key} className="border-t border-border hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium capitalize">{key.replace('_', ' ')}</td>
                          <td className="py-3 px-4 text-center text-muted-foreground">—</td>
                          <td className="py-3 px-4 text-center text-muted-foreground">—</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${val > 0 ? 'text-pass' : 'text-fail'}`}>
                              {val > 0 ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">{(selectedStaffBonus.jobClass[`${key}_percentage`] || 0).toFixed(1)}%</td>
                          <td className="py-3 px-4 text-right font-semibold">${(val || 0).toFixed(0)}</td>
                        </tr>
                      )
                    ))}
                    <tr className="border-t border-border bg-muted/30 font-bold">
                      <td colSpan="5" className="py-3 px-4 text-right">Total Quarterly Payout</td>
                      <td className="py-3 px-4 text-right text-primary">${(selectedStaffBonus.quarterlyBonus?.total || 0).toFixed(0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 text-sm text-blue-900">
            <p className="font-semibold mb-2">2026 Operations Bonuses</p>
            <p className="text-xs">Quarterly bonuses are 50% of annual rates. Bonuses are earned when KPI targets are met (GOP, GOP Margin, RGI, GSS). Check marks indicate metrics that passed thresholds.</p>
          </div>
        </>
      )}
    </div>
  );
}