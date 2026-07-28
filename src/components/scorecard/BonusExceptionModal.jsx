import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, Check, X, Plus, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';

const CATEGORIES = ['Concession', 'Natural Disaster', 'Legal', 'Insurance', 'One-Time Expense', 'Other'];

export default function BonusExceptionModal({ open, onClose, property, year }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    quarter: 1,
    amount: '',
    description: '',
    category: 'Concession',
  });
  const [saving, setSaving] = useState(false);

  const { data: exceptions = [], refetch } = useQuery({
    queryKey: ['bonus-exceptions', property?.id, year],
    queryFn: () =>
      property?.id
        ? base44.entities.BonusException.filter({ property_id: property.id, year })
        : Promise.resolve([]),
    enabled: !!property?.id && open,
  });

  const handleCreate = async () => {
    if (!form.amount || !form.description.trim()) return;
    setSaving(true);
    try {
      await base44.entities.BonusException.create({
        property_id: property.id,
        year,
        quarter: Number(form.quarter),
        amount: parseFloat(form.amount),
        description: form.description.trim(),
        category: form.category,
        status: 'Pending',
        submitted_by: user?.full_name || user?.email || 'Unknown',
      });
      setForm({ quarter: form.quarter, amount: '', description: '', category: 'Concession' });
      setShowForm(false);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['bonus-exceptions'] });
    } catch (e) {
      console.error('Failed to create exception', e);
    }
    setSaving(false);
  };

  const handleStatusChange = async (id, status) => {
    try {
      await base44.entities.BonusException.update(id, {
        status,
        approved_by: user?.full_name || user?.email || 'Unknown',
        approved_date: new Date().toISOString(),
      });
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['bonus-exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['score-entries'] });
      queryClient.invalidateQueries({ queryKey: ['all-entries'] });
    } catch (e) {
      console.error('Failed to update exception', e);
    }
  };

  const handleDelete = async (id) => {
    try {
      await base44.entities.BonusException.delete(id);
      await refetch();
      queryClient.invalidateQueries({ queryKey: ['bonus-exceptions'] });
    } catch (e) {
      console.error('Failed to delete exception', e);
    }
  };

  const statusBadge = (status) => {
    const styles = {
      Pending: 'bg-amber-100 text-amber-800 border-amber-200',
      Approved: 'bg-green-100 text-green-800 border-green-200',
      Rejected: 'bg-red-100 text-red-800 border-red-200',
    };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${styles[status] || ''}`}>
        {status}
      </span>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-600" />
            Bonus Exceptions — {property?.name}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Quarterly add-backs to GOP for extraordinary expenses (concessions, natural disasters, legal settlements, etc.).
            Only <strong>Approved</strong> exceptions affect scorecard calculations.
          </p>
        </DialogHeader>

        {/* Existing exceptions */}
        <div className="space-y-2">
          {exceptions.length === 0 && !showForm && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No bonus exceptions recorded for {year}.
            </div>
          )}
          {exceptions.map((exc) => (
            <div key={exc.id} className="border border-border rounded-lg p-3 bg-muted/30">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-muted-foreground">Q{exc.quarter}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{exc.category}</span>
                    {statusBadge(exc.status)}
                  </div>
                  <div className="text-sm font-semibold text-foreground">
                    ${Math.round(exc.amount).toLocaleString('en-US')}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{exc.description}</div>
                  {exc.submitted_by && (
                    <div className="text-[10px] text-muted-foreground mt-1">Submitted by {exc.submitted_by}</div>
                  )}
                  {exc.approved_by && (
                    <div className="text-[10px] text-muted-foreground">
                      {exc.status} by {exc.approved_by}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {exc.status === 'Pending' && (
                    <>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleStatusChange(exc.id, 'Approved')}>
                        <Check className="w-3 h-3" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-red-700 border-red-300 hover:bg-red-50" onClick={() => handleStatusChange(exc.id, 'Rejected')}>
                        <X className="w-3 h-3" /> Reject
                      </Button>
                    </>
                  )}
                  {exc.status !== 'Pending' && (
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => handleDelete(exc.id)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Create form */}
        {showForm ? (
          <div className="border border-border rounded-lg p-4 bg-card space-y-3">
            <h4 className="text-sm font-bold">New Bonus Exception</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Quarter</label>
                <Select value={String(form.quarter)} onValueChange={(v) => setForm({ ...form, quarter: Number(v) })}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map(q => <SelectItem key={q} value={String(q)}>Q{q}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Amount ($)</label>
                <Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} placeholder="50000" className="h-9" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the extraordinary expense and why it should be added back to GOP..." rows={3} className="text-sm" />
            </div>
          </div>
        ) : null}

        <DialogFooter className="flex items-center justify-between gap-2">
          {showForm ? (
            <>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !form.amount || !form.description.trim()}>
                {saving ? 'Saving...' : 'Submit for Approval'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Close</Button>
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Add Exception
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}