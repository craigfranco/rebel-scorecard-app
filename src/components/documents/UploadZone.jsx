import React, { useRef, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';

export default function UploadZone({ onFile, loading, label, subLabel, accept = '.xlsx,.xls,.csv,.pdf' }) {
  const ref = useRef();
  const [dragOver, setDragOver] = useState(false);

  const handle = (files) => {
    if (files && files.length > 0) onFile(files[0]);
  };

  return (
    <div
      className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); handle(e.dataTransfer.files); }}
      onClick={() => !loading && ref.current?.click()}
    >
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={e => handle(e.target.files)} />
      {loading ? (
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Parsing file…</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload className="w-7 h-7 text-muted-foreground" />
          <p className="font-semibold text-sm">{label || 'Drop file here or click to browse'}</p>
          {subLabel && <p className="text-xs text-muted-foreground">{subLabel}</p>}
        </div>
      )}
    </div>
  );
}