import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Save, Trash2, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { calculateQuarterlyBonus, calculateAnnualBonus, getMetricStatus } from '@/lib/bonusCalculation';
import { calculateScorecard, MONTHS, getQuarterFromMonth } from '@/lib/scoring';

const CURRENT_YEAR = 2026;

export default function Payouts() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [newStaff, setNewStaff] = useState({ name: '', job_classification_id: '', salary_q1: '', salary_q2: '', salary_q3: '', salary_q4: '' });
  const [showAddForm, setShowAddForm] = useState(false);

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
    mutationFn: (data) =>
      base44.entities.Staff.create({
        ...data,
        property_id: selectedPropertyId,
        year: selectedYear,
        is_active: true,
        salary_q1: parseFloat(data.salary_q1) || null,
        salary_q2: parseFloat(data.salary_q2) || null,
        salary_q3: parseFloat(data.salary_q3) || null,
        salary_q4: parseFloat(data.salary_q4) || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      setNewStaff({ name: '', job_classification_id: '', salary_q1: '', salary_q2: '', salary_q3: '', salary_q4: '' });
      setShowAddForm(false);
      toast({ title: 'Staff added', description: 'New staff member added successfully.' });
    },
  });

  const deleteStaffMutation = useMutation({
    mutationFn: (staffId) => base44.entities.Staff.update(staffId, { is_active: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Removed', description: 'Staff member removed.' });
    },
  });

  const selectedProperty = properties.find(p => p.id === selectedPropertyId);

  // Calculate estimated annual salary
  const getEstimatedAnnualSalary = (staff) => {
   const salaries = [staff.salary_q1, staff.salary_q2, staff.salary_q3, staff.salary_q4].filter(s => s);
   if (salaries.length === 0) return 0;
   return (salaries.reduce((sum, s) => sum + s, 0) / salaries.length) * 4;
  };

  // Calculate bonuses for all staff
  const staffWithBonuses = staffMembers.map(staff => {
   const jobClass = jobClassifications.find(jc => jc.id === staff.job_classification_id);
   if (!jobClass) return null;

   const staffEntries = entries.filter(e => e.property_id === selectedPropertyId);
   const scorecards = staffEntries.map(entry => calculateScorecard(entry, selectedProperty)).filter(Boolean);

   // Get quarterly bonuses (all quarters available in data)
   const quarterlyBonuses = {};
   const quarters = [1, 2, 3, 4];
   quarters.forEach(q => {
     const qEntries = staffEntries.filter(e => getQuarterFromMonth(e.month) === q);
     if (qEntries.length > 0) {
       const entry = qEntries[qEntries.length - 1];
       const scorecard = calculateScorecard(entry, selectedProperty);
       const estAnnualSalary = getEstimatedAnnualSalary(staff);
       quarterlyBonuses[q] = calculateQuarterlyBonus({...staff, annual_salary: estAnnualSalary}, scorecard, jobClass, entry);
     }
   });

   const estAnnualSalary = getEstimatedAnnualSalary(staff);
   const annualBonus = calculateAnnualBonus({...staff, annual_salary: estAnnualSalary}, scorecards, jobClass, staffEntries);

   return {
     ...staff,
     jobClass,
     quarterlyBonuses,
     annualBonus,
     estimatedAnnualSalary: estAnnualSalary,
   };
  }).filter(Boolean);

  const handleAddStaff = () => {
   if (!newStaff.name || !newStaff.job_classification_id || (!newStaff.salary_q1 && !newStaff.salary_q2 && !newStaff.salary_q3 && !newStaff.salary_q4)) {
     toast({ title: 'Error', description: 'Please fill all fields.' });
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
          {/* Add Staff Form */}
          {showAddForm ? (
            <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
              <h3 className="font-bold mb-4">Add Staff Member</h3>
              <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
                <Input
                  placeholder="Name"
                  value={newStaff.name}
                  onChange={e => setNewStaff({ ...newStaff, name: e.target.value })}
                />
                <div>
                   <label className="text-xs text-muted-foreground font-semibold mb-1 block">Job Title</label>
                   <Select value={newStaff.job_classification_id} onValueChange={id => setNewStaff({ ...newStaff, job_classification_id: id })}>
                     <SelectTrigger className="w-full">
                       <SelectValue placeholder="Select job title..." />
                     </SelectTrigger>
                     <SelectContent>
                       {jobClassifications.map(jc => (
                         <SelectItem key={jc.id} value={jc.id}>{jc.title}</SelectItem>
                       ))}
                     </SelectContent>
                   </Select>
                 </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold mb-1 block">Q1 Salary</label>
                  <Input
                    placeholder="0"
                    type="number"
                    value={newStaff.salary_q1}
                    onChange={e => setNewStaff({ ...newStaff, salary_q1: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold mb-1 block">Q2 Salary</label>
                  <Input
                    placeholder="0"
                    type="number"
                    value={newStaff.salary_q2}
                    onChange={e => setNewStaff({ ...newStaff, salary_q2: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold mb-1 block">Q3 Salary</label>
                  <Input
                    placeholder="0"
                    type="number"
                    value={newStaff.salary_q3}
                    onChange={e => setNewStaff({ ...newStaff, salary_q3: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground font-semibold mb-1 block">Q4 Salary</label>
                  <Input
                    placeholder="0"
                    type="number"
                    value={newStaff.salary_q4}
                    onChange={e => setNewStaff({ ...newStaff, salary_q4: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddStaff} disabled={addStaffMutation.isPending} className="gap-2">
                  <Save className="w-4 h-4" />
                  Add
                </Button>
                <Button onClick={() => setShowAddForm(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowAddForm(true)} className="gap-2" style={{ backgroundColor: '#2d4b5e' }}>
              <Plus className="w-4 h-4" />
              Add Staff Member
            </Button>
          )}

          {/* Staff Table */}
          <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="font-bold text-foreground">Staff & Bonus Projections — {selectedYear}</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                    <th className="py-3 px-4 text-left font-semibold">Name</th>
                    <th className="py-3 px-4 text-left font-semibold">Job Title</th>
                    <th className="py-3 px-4 text-right font-semibold">Est. Annual Salary</th>
                    <th className="py-3 px-4 text-right font-semibold">Q1 Bonus</th>
                    <th className="py-3 px-4 text-right font-semibold">Q2 Bonus</th>
                    <th className="py-3 px-4 text-right font-semibold">Q3 Bonus</th>
                    <th className="py-3 px-4 text-right font-semibold">Q4 Bonus</th>
                    <th className="py-3 px-4 text-right font-semibold">Annual Bonus</th>
                    <th className="py-3 px-4 text-center font-semibold">Max Allowed</th>
                    <th className="py-3 px-4 text-center font-semibold"></th>
                  </tr>
                </thead>
                <tbody>
                  {staffWithBonuses.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-muted-foreground">
                        No staff members added yet.
                      </td>
                    </tr>
                  ) : (
                    staffWithBonuses.map(staff => {
                       const maxAllowed = (staff.estimatedAnnualSalary * staff.jobClass.max_bonus_percentage) / 100;
                       return (
                         <tr key={staff.id} className="border-t border-border hover:bg-muted/30">
                           <td className="py-3 px-4 font-medium">{staff.name}</td>
                           <td className="py-3 px-4 text-muted-foreground">{staff.jobClass.title}</td>
                           <td className="py-3 px-4 text-right">${(staff.estimatedAnnualSalary / 1000).toFixed(0)}K</td>
                           <td className="py-3 px-4 text-right">${(staff.quarterlyBonuses[1]?.total || 0).toFixed(0)}</td>
                           <td className="py-3 px-4 text-right">${(staff.quarterlyBonuses[2]?.total || 0).toFixed(0)}</td>
                           <td className="py-3 px-4 text-right">${(staff.quarterlyBonuses[3]?.total || 0).toFixed(0)}</td>
                           <td className="py-3 px-4 text-right">${(staff.quarterlyBonuses[4]?.total || 0).toFixed(0)}</td>
                           <td className="py-3 px-4 text-right font-bold">${(staff.annualBonus.total).toFixed(0)}</td>
                           <td className="py-3 px-4 text-center text-muted-foreground">${(maxAllowed).toFixed(0)}</td>
                           <td className="py-3 px-4 text-center">
                             <button
                               onClick={() => deleteStaffMutation.mutate(staff.id)}
                               className="text-destructive hover:text-destructive/80"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </td>
                         </tr>
                       );
                     })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Legend */}
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 text-sm text-blue-900">
            <p className="font-semibold mb-2">2026 Operations Bonuses</p>
            <p className="text-xs">Quarterly bonuses are 50% of annual rates. Annual bonuses are capped at the "Max Allowed" percentage of salary. Employees earn bonuses for each KPI metric they hit (GOP, GOP Margin, RGI, GSS).</p>
          </div>
        </>
      )}
    </div>
  );
}