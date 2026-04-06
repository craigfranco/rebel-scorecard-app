import React, { useState, useEffect } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

export default function NotesPanel({ title, icon: Icon, value, onSave }) {
  const [text, setText] = useState(value || "");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setText(value || "");
    setDirty(false);
  }, [value]);

  const handleChange = (e) => {
    setText(e.target.value);
    setDirty(true);
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-primary" />}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {dirty && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 text-primary"
            onClick={() => { onSave(text); setDirty(false); }}
          >
            <Save className="w-3 h-3" /> Save
          </Button>
        )}
      </div>
      <Textarea
        value={text}
        onChange={handleChange}
        placeholder={`Enter ${title.toLowerCase()}...`}
        className="min-h-[100px] resize-none text-sm bg-muted/50 border-0"
      />
    </div>
  );
}