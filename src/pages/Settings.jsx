import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Save, X, Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { HOTELS, getGssForBrand } from '@/lib/hotels';

const BRANDS = ['Marriott', 'Hilton', 'IHG', 'Hyatt', 'Choice', 'Independent'];

const EMPTY_FORM = { name: '', parent_brand: 'Independent', sub_brand: '', city: '', state: '', gm_name: '' };

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [seeding, setSeeding] = useState(false);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ['properties'],
    queryFn: () => base44.entities.Property.list('name', 100),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Property.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['properties'] }); resetForm(); toast({ title: 'Property added!' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Property.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['properties'] }); resetForm(); toast({ title: 'Property updated!' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Property.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['properties'] }); toast({ title: 'Property deleted.' }); },
  });

  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };

  const handleEdit = (p) => {
    setForm({ name: p.name, parent_brand: p.parent_brand || 'Independent', sub_brand: p.sub_brand || '', city: p.city || '', state: p.state || '', gm_name: p.gm_name || '' });
    setEditingId(p.id);
    setShowForm(true);
  };

  const handleSubmit = () => {
    const gss = getGssForBrand(form.parent_brand);
    const data = { ...form, ...gss };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSeedAll = async () => {
    setSeeding(true);
    try {
      // Delete existing and re-seed
      for (const hotel of HOTELS) {
        const existing = properties.find(p => p.name === hotel.name);
        const gss = getGssForBrand(hotel.parent_brand);
        const data = { ...hotel, ...gss, is_active: true };
        if (!existing) {
          await base44.entities.Property.create(data);
        }
      }
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      toast({ title: 'Hotels seeded!', description: `${HOTELS.length} properties loaded from Rebel Deployment.` });
    } catch (e) {
      toast({ title: 'Error seeding hotels', description: e.message, variant: 'destructive' });
    }
    setSeeding(false);
  };

  return (
    <div className="p-4 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="rounded-2xl text-white p-6 shadow-lg" style={{ background: 'linear-gradient(135deg, #2d4b5e 0%, #1e3547 100%)' }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center">
            <SettingsIcon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-white/70 text-sm">Manage hotel properties and configuration</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(EMPTY_FORM); }}
          className="gap-2"
          style={{ backgroundColor: '#2d4b5e' }}
        >
          <Plus className="w-4 h-4" />
          Add Property
        </Button>
        <Button
          variant="outline"
          onClick={handleSeedAll}
          disabled={seeding}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${seeding ? 'animate-spin' : ''}`} />
          {seeding ? 'Seeding...' : 'Seed from Rebel Deployment (25 Hotels)'}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-card rounded-2xl border border-border p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base">{editingId ? 'Edit Property' : 'Add New Property'}</h3>
            <button onClick={resetForm} className="p-1.5 hover:bg-muted rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Hotel Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Hotel name" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Parent Brand</label>
              <Select value={form.parent_brand} onValueChange={v => setForm(f => ({ ...f, parent_brand: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BRANDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Sub-Brand</label>
              <Input value={form.sub_brand} onChange={e => setForm(f => ({ ...f, sub_brand: e.target.value }))} placeholder="e.g. Courtyard, DoubleTree" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">City</label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="City" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">State</label>
              <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} placeholder="e.g. NY" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">General Manager</label>
              <Input value={form.gm_name} onChange={e => setForm(f => ({ ...f, gm_name: e.target.value }))} placeholder="GM full name" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubmit} disabled={!form.name || createMutation.isPending || updateMutation.isPending} className="gap-2" style={{ backgroundColor: '#2d4b5e' }}>
              <Save className="w-4 h-4" />
              {editingId ? 'Update' : 'Add Property'}
            </Button>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Properties list */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <h2 className="font-bold">Properties ({properties.length})</h2>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : properties.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">No properties yet.</p>
            <p className="text-xs mt-1">Click "Seed from Rebel Deployment" to add all 25 hotels.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-left font-semibold">Hotel</th>
                  <th className="py-3 px-4 text-center font-semibold">Brand</th>
                  <th className="py-3 px-4 text-center font-semibold">Location</th>
                  <th className="py-3 px-4 text-center font-semibold">GM</th>
                  <th className="py-3 px-4 text-center font-semibold">GSS Metric</th>
                  <th className="py-3 px-4 text-center font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {properties.map(p => (
                  <tr key={p.id} className="border-b border-border hover:bg-muted/20">
                    <td className="py-3 px-4 font-medium text-foreground text-sm">{p.name}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs bg-muted px-2 py-1 rounded-full font-medium">{p.parent_brand || '—'}</span>
                    </td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">{p.city}, {p.state}</td>
                    <td className="py-3 px-4 text-center text-xs text-muted-foreground">{p.gm_name || '—'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="text-xs font-medium" style={{ color: '#2d4b5e' }}>{p.gss_metric || '—'}</span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(p)} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
                          <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => deleteMutation.mutate(p.id)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}