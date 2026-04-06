import React from 'react';
import { Textarea } from '@/components/ui/textarea';

export default function NotesPanel({ title, icon, value, onChange, placeholder }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <h3 className="font-semibold text-sm text-foreground">{title}</h3>
      </div>
      <Textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-h-[100px] resize-none text-sm border-border focus:ring-primary/30 bg-muted/30"
      />
    </div>
  );
}