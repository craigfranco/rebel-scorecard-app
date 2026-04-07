import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Save, Trash2, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function JobClassifications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newJob, setNewJob] = useState({
    title: '',
    max_bonus_percentage: '',
    gop_bonus_percentage: '',
    gop_margin_bonus_percentage: '',
    rgi_bonus_percentage_low: '',
    rgi_bonus_percentage_high: '',
    gss_bonus_percentage: '',
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data: jobClassifications = [] } = useQuery({
    queryKey: ['job-classifications'],
    queryFn: () => base44.entities.JobClassification.list('title', 100),
  });

  const addMutation = useMutation({
    mutationFn: (data) => base44.entities.JobClassification.create({
      ...data,
      max_bonus_percentage: parseFloat(data.max_bonus_percentage),
      gop_bonus_percentage: parseFloat(data.gop_bonus_percentage),
      gop_margin_bonus_percentage: parseFloat(data.gop_margin_bonus_percentage),
      rgi_bonus_percentage_low: parseFloat(data.rgi_bonus_percentage_low),
      rgi_bonus_percentage_high: parseFloat(data.rgi_bonus_percentage_high),
      gss_bonus_percentage: parseFloat(data.gss_bonus_percentage),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-classifications'] });
      setNewJob({
        title: '',
        max_bonus_percentage: '',
        gop_bonus_percentage: '',
        gop_margin_bonus_percentage: '',
        rgi_bonus_percentage_low: '',
        rgi_bonus_percentage_high: '',
        gss_bonus_percentage: '',
      });
      setShowAddForm(false);
      toast({ title: 'Added', description: 'Job classification created.' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.JobClassification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['job-classifications'] });
      toast({ title: 'Deleted', description: 'Job classification removed.' });
    },
  });

  const handleAdd = () => {
    if (!newJob.title) {
      toast({ title: 'Error', description: 'Title is required.' });
      return;
    }
    addMutation.mutate(newJob);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
              <span>Settings</span>
              <ChevronRight className="w-3 h-3" />
              <span>Job Classifications</span>
            </div>
            <h1 className="text-2xl font-bold">Bonus Thresholds by Job Title</h1>
            <p className="text-white/70 text-sm mt-1">Configure max bonuses and KPI percentages per classification</p>
          </div>
        </div>
      </div>

      {/* Add Form */}
      {showAddForm ? (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm">
          <h3 className="font-bold mb-4">New Job Classification</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <Input
              placeholder="Job Title"
              value={newJob.title}
              onChange={e => setNewJob({ ...newJob, title: e.target.value })}
            />
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1 block">Max Bonus %</label>
              <Input
                placeholder="50"
                type="number"
                step="0.1"
                value={newJob.max_bonus_percentage}
                onChange={e => setNewJob({ ...newJob, max_bonus_percentage: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1 block">GOP %</label>
              <Input
                placeholder="10"
                type="number"
                step="0.1"
                value={newJob.gop_bonus_percentage}
                onChange={e => setNewJob({ ...newJob, gop_bonus_percentage: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1 block">GOP Margin %</label>
              <Input
                placeholder="10"
                type="number"
                step="0.1"
                value={newJob.gop_margin_bonus_percentage}
                onChange={e => setNewJob({ ...newJob, gop_margin_bonus_percentage: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1 block">RGI (0.1-2.0%) %</label>
              <Input
                placeholder="7.5"
                type="number"
                step="0.1"
                value={newJob.rgi_bonus_percentage_low}
                onChange={e => setNewJob({ ...newJob, rgi_bonus_percentage_low: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1 block">RGI (2.1%+) %</label>
              <Input
                placeholder="15"
                type="number"
                step="0.1"
                value={newJob.rgi_bonus_percentage_high}
                onChange={e => setNewJob({ ...newJob, rgi_bonus_percentage_high: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground font-semibold mb-1 block">GSS %</label>
              <Input
                placeholder="15"
                type="number"
                step="0.1"
                value={newJob.gss_bonus_percentage}
                onChange={e => setNewJob({ ...newJob, gss_bonus_percentage: e.target.value })}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleAdd} disabled={addMutation.isPending} className="gap-2">
              <Save className="w-4 h-4" />
              Create
            </Button>
            <Button onClick={() => setShowAddForm(false)} variant="outline">
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setShowAddForm(true)} className="gap-2" style={{ backgroundColor: '#2d4b5e' }}>
          <Plus className="w-4 h-4" />
          Add Classification
        </Button>
      )}

      {/* Classifications Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <th className="py-3 px-4 text-left font-semibold">Job Title</th>
                <th className="py-3 px-4 text-center font-semibold">Max Bonus</th>
                <th className="py-3 px-4 text-center font-semibold">GOP</th>
                <th className="py-3 px-4 text-center font-semibold">GOP Margin</th>
                <th className="py-3 px-4 text-center font-semibold">RGI (0.1-2%)</th>
                <th className="py-3 px-4 text-center font-semibold">RGI (2.1%+)</th>
                <th className="py-3 px-4 text-center font-semibold">GSS</th>
                <th className="py-3 px-4 text-center font-semibold"></th>
              </tr>
            </thead>
            <tbody>
              {jobClassifications.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-muted-foreground">
                    No job classifications. Create one to get started.
                  </td>
                </tr>
              ) : (
                jobClassifications.map(jc => (
                  <tr key={jc.id} className="border-t border-border hover:bg-muted/30">
                    <td className="py-3 px-4 font-medium">{jc.title}</td>
                    <td className="py-3 px-4 text-center">{jc.max_bonus_percentage}%</td>
                    <td className="py-3 px-4 text-center">{jc.gop_bonus_percentage}%</td>
                    <td className="py-3 px-4 text-center">{jc.gop_margin_bonus_percentage}%</td>
                    <td className="py-3 px-4 text-center">{jc.rgi_bonus_percentage_low}%</td>
                    <td className="py-3 px-4 text-center">{jc.rgi_bonus_percentage_high}%</td>
                    <td className="py-3 px-4 text-center">{jc.gss_bonus_percentage}%</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => deleteMutation.mutate(jc.id)}
                        className="text-destructive hover:text-destructive/80"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Example Data */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-6 text-sm text-blue-900">
        <p className="font-semibold mb-2">Default Thresholds (from chart)</p>
        <p className="text-xs mb-3">Here are the suggested bonus percentages from your 2026 Operations Bonuses chart:</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <p className="font-semibold">General Manager</p>
            <p>Max: 50%, GOP: 10%, Margin: 10%, RGI: 15%, GSS: 15%</p>
          </div>
          <div>
            <p className="font-semibold">AGM / EC Members</p>
            <p>Max: 40%, GOP: 10%, Margin: 10%, RGI: 10%, GSS: 10%</p>
          </div>
          <div>
            <p className="font-semibold">Department Heads</p>
            <p>Max: 20%, GOP: 5%, Margin: 5%, RGI: 2%, GSS: 8%</p>
          </div>
        </div>
      </div>
    </div>
  );
}