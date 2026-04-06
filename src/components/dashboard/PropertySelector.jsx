import React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2 } from "lucide-react";

export default function PropertySelector({ properties, selectedId, onSelect }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <Building2 className="w-5 h-5 text-primary" />
      </div>
      <Select value={selectedId || ""} onValueChange={onSelect}>
        <SelectTrigger className="w-[280px] bg-card border-border text-sm font-medium">
          <SelectValue placeholder="Select a property..." />
        </SelectTrigger>
        <SelectContent>
          {properties.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}