import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings, Plus, Pencil, Trash2, Building2, Calendar, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { MONTHS } from "@/lib/scoring";
import { useToast } from "@/components/ui/use-toast";

const BRAND_TYPES = [
  { value: "marriott", label: "Marriott" },
  { value: "hilton", label: "Hilton" },
  { value: "ihg", label: "IHG" },
  { value: "hyatt", label: "Hyatt" },
  { value: "choice", label: "Choice" },
  { value: "independent", label: "Independent" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [propDialog, setPropDialog] = useState(null); // null | 'new' | property object
  const [entryDialog, setEntryDialog] = useState(null);
  const [formData, setFormData] = useState({});
  const [entryForm, setEntryForm] = useState({});

  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: () => base44.entities.Property.list(),
  });

  const { data: entries = [] } = useQuery({
    queryKey: ["scoreEntries"],
    queryFn: () => base44.entities.ScoreEntry.list(),
  });

  const createProp = useMutation({
    mutationFn: (data) => base44.entities.Property.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setPropDialog(null);
      toast({ title: "Property added" });
    },
  });

  const updateProp = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Property.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      setPropDialog(null);
      toast({ title: "Property updated" });
    },
  });

  const deleteProp = useMutation({
    mutationFn: (id) => base44.entities.Property.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["properties"] });
      toast({ title: "Property deleted" });
    },
  });

  const createEntry = useMutation({
    mutationFn: (data) => base44.entities.ScoreEntry.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreEntries"] });
      setEntryDialog(null);
      toast({ title: "Score entry saved" });
    },
  });

  const updateEntry = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ScoreEntry.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreEntries"] });
      setEntryDialog(null);
      toast({ title: "Score entry updated" });
    },
  });

  const deleteEntry = useMutation({
    mutationFn: (id) => base44.entities.ScoreEntry.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scoreEntries"] });
      toast({ title: "Entry deleted" });
    },
  });

  const openNewProp = () => {
    setFormData({ name: "", brand: "", brandType: "" });
    setPropDialog("new");
  };

  const openEditProp = (prop) => {
    setFormData({ name: prop.name, brand: prop.brand, brandType: prop.brandType });
    setPropDialog(prop);
  };

  const saveProp = () => {
    if (propDialog === "new") createProp.mutate(formData);
    else updateProp.mutate({ id: propDialog.id, data: formData });
  };

  const openNewEntry = () => {
    setEntryForm({
      propertyId: properties[0]?.id || "",
      month: new Date().getMonth() + 1,
      year: 2026,
      quarter: Math.ceil((new Date().getMonth() + 1) / 3),
      budgetedGOP_actual: 0, budgetedGOP_target: 0,
      gopMarginActual: 0, gopMarginPrior: 0,
      rgiActual: 0, rgiPrior: 0,
      gssActual: 0, gssPrior: 0,
      forecastKicker: false, redZoneKicker: false,
    });
    setEntryDialog("new");
  };

  const openEditEntry = (entry) => {
    setEntryForm({ ...entry });
    setEntryDialog(entry);
  };

  const saveEntry = () => {
    const data = {
      ...entryForm,
      quarter: Math.ceil(entryForm.month / 3),
      budgetedGOP_actual: Number(entryForm.budgetedGOP_actual),
      budgetedGOP_target: Number(entryForm.budgetedGOP_target),
      gopMarginActual: Number(entryForm.gopMarginActual),
      gopMarginPrior: Number(entryForm.gopMarginPrior),
      rgiActual: Number(entryForm.rgiActual),
      rgiPrior: Number(entryForm.rgiPrior),
      gssActual: Number(entryForm.gssActual),
      gssPrior: Number(entryForm.gssPrior),
    };
    if (entryDialog === "new") createEntry.mutate(data);
    else updateEntry.mutate({ id: entryDialog.id, data });
  };

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-black text-foreground tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Manage properties and score data</p>
          </div>
        </div>
      </motion.div>

      {/* Properties Section */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Properties</h2>
          <Button onClick={openNewProp} size="sm" className="gap-1 bg-navy hover:bg-navy-light">
            <Plus className="w-4 h-4" /> Add Property
          </Button>
        </div>
        <div className="space-y-2">
          {properties.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition">
              <div className="flex items-center gap-3">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium text-sm">{p.name}</span>
                <Badge variant="outline" className="text-xs">{p.brand}</Badge>
                <Badge variant="secondary" className="text-xs capitalize">{p.brandType}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditProp(p)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteProp.mutate(p.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {properties.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No properties yet. Add your first hotel.</p>
          )}
        </div>
      </div>

      {/* Score Entries Section */}
      <div className="bg-card rounded-2xl border border-border p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-foreground">Score Entries</h2>
          <Button onClick={openNewEntry} size="sm" className="gap-1 bg-navy hover:bg-navy-light" disabled={properties.length === 0}>
            <Plus className="w-4 h-4" /> Add Entry
          </Button>
        </div>
        <div className="space-y-2">
          {entries.map((e) => {
            const prop = properties.find((p) => p.id === e.propertyId);
            return (
              <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition">
                <div className="flex items-center gap-3 flex-wrap">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{prop?.name || "Unknown"}</span>
                  <Badge variant="outline" className="text-xs">{MONTHS[e.month - 1]} {e.year}</Badge>
                  <Badge variant="secondary" className="text-xs">Q{e.quarter}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditEntry(e)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteEntry.mutate(e.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No score entries yet.</p>
          )}
        </div>
      </div>

      {/* Property Dialog */}
      <Dialog open={propDialog !== null} onOpenChange={() => setPropDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{propDialog === "new" ? "Add Property" : "Edit Property"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Hotel Name</Label>
              <Input value={formData.name || ""} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Hyatt Regency Downtown" />
            </div>
            <div>
              <Label>Brand</Label>
              <Input value={formData.brand || ""} onChange={(e) => setFormData({ ...formData, brand: e.target.value })} placeholder="e.g. Hyatt" />
            </div>
            <div>
              <Label>Brand Type (for GSS scoring)</Label>
              <Select value={formData.brandType || ""} onValueChange={(v) => setFormData({ ...formData, brandType: v })}>
                <SelectTrigger><SelectValue placeholder="Select brand type" /></SelectTrigger>
                <SelectContent>
                  {BRAND_TYPES.map((b) => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPropDialog(null)}>Cancel</Button>
            <Button onClick={saveProp} className="bg-navy hover:bg-navy-light">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entry Dialog */}
      <Dialog open={entryDialog !== null} onOpenChange={() => setEntryDialog(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{entryDialog === "new" ? "Add Score Entry" : "Edit Score Entry"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Property</Label>
              <Select value={entryForm.propertyId || ""} onValueChange={(v) => setEntryForm({ ...entryForm, propertyId: v })}>
                <SelectTrigger><SelectValue placeholder="Select property" /></SelectTrigger>
                <SelectContent>
                  {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Month</Label>
              <Select value={String(entryForm.month || 1)} onValueChange={(v) => setEntryForm({ ...entryForm, month: Number(v) })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Year</Label>
              <Input type="number" value={entryForm.year || 2026} onChange={(e) => setEntryForm({ ...entryForm, year: Number(e.target.value) })} />
            </div>

            <div className="col-span-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Budgeted GOP (35%)</p>
            </div>
            <div>
              <Label>Actual GOP ($)</Label>
              <Input type="number" value={entryForm.budgetedGOP_actual || ""} onChange={(e) => setEntryForm({ ...entryForm, budgetedGOP_actual: e.target.value })} />
            </div>
            <div>
              <Label>Target GOP ($)</Label>
              <Input type="number" value={entryForm.budgetedGOP_target || ""} onChange={(e) => setEntryForm({ ...entryForm, budgetedGOP_target: e.target.value })} />
            </div>

            <div className="col-span-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GOP Margin (35%)</p>
            </div>
            <div>
              <Label>Current Margin (%)</Label>
              <Input type="number" step="0.01" value={entryForm.gopMarginActual || ""} onChange={(e) => setEntryForm({ ...entryForm, gopMarginActual: e.target.value })} />
            </div>
            <div>
              <Label>Prior Year Margin (%)</Label>
              <Input type="number" step="0.01" value={entryForm.gopMarginPrior || ""} onChange={(e) => setEntryForm({ ...entryForm, gopMarginPrior: e.target.value })} />
            </div>

            <div className="col-span-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">RGI (15%)</p>
            </div>
            <div>
              <Label>Current RGI</Label>
              <Input type="number" step="0.01" value={entryForm.rgiActual || ""} onChange={(e) => setEntryForm({ ...entryForm, rgiActual: e.target.value })} />
            </div>
            <div>
              <Label>Prior Year RGI</Label>
              <Input type="number" step="0.01" value={entryForm.rgiPrior || ""} onChange={(e) => setEntryForm({ ...entryForm, rgiPrior: e.target.value })} />
            </div>

            <div className="col-span-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">GSS (15%)</p>
            </div>
            <div>
              <Label>Current GSS Score</Label>
              <Input type="number" step="0.01" value={entryForm.gssActual || ""} onChange={(e) => setEntryForm({ ...entryForm, gssActual: e.target.value })} />
            </div>
            <div>
              <Label>Prior Year GSS Score</Label>
              <Input type="number" step="0.01" value={entryForm.gssPrior || ""} onChange={(e) => setEntryForm({ ...entryForm, gssPrior: e.target.value })} />
            </div>

            <div className="col-span-2 pt-2 border-t">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kickers</p>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={entryForm.forecastKicker || false} onCheckedChange={(v) => setEntryForm({ ...entryForm, forecastKicker: v })} />
              <Label>Forecast Accuracy Hit</Label>
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={entryForm.redZoneKicker || false} onCheckedChange={(v) => setEntryForm({ ...entryForm, redZoneKicker: v })} />
              <Label>Red Zone Hit</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialog(null)}>Cancel</Button>
            <Button onClick={saveEntry} className="bg-navy hover:bg-navy-light">Save Entry</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}