import React, { useState, useRef, useEffect } from 'react';
import { X, ChevronDown, Filter } from 'lucide-react';

/**
 * Multi-select filter bar for Brand, Sub Brand, City, State, GM
 * props:
 *   properties: Property[]
 *   filters: { brands: [], subBrands: [], cities: [], states: [], gms: [] }
 *   onChange: (filters) => void
 */
export default function PropertyFilters({ properties, filters, onChange }) {
  const activeCount = Object.values(filters).reduce((n, arr) => n + arr.length, 0);

  const unique = (key) => {
    const vals = properties.map(p => p[key]).filter(Boolean);
    return [...new Set(vals)].sort();
  };

  // Sub Brand options cascade: only show sub-brands belonging to selected brands (if any brands are selected)
  const subBrandOptions = (() => {
    const source = filters.brands.length > 0
      ? properties.filter(p => filters.brands.includes(p.parent_brand))
      : properties;
    const vals = source.map(p => p.sub_brand).filter(Boolean);
    return [...new Set(vals)].sort();
  })();

  // When brand selection changes, remove any selected sub-brands that no longer belong
  const toggle = (key, value) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];

    const newFilters = { ...filters, [key]: next };

    // Cascade: when brands change, drop any selected sub-brands not in the new brand set
    if (key === 'brands') {
      if (next.length > 0) {
        const validSubBrands = new Set(
          properties.filter(p => next.includes(p.parent_brand)).map(p => p.sub_brand).filter(Boolean)
        );
        newFilters.subBrands = filters.subBrands.filter(sb => validSubBrands.has(sb));
      }
    }

    onChange(newFilters);
  };

  const clearAll = () => {
    onChange({ brands: [], subBrands: [], cities: [], states: [], gms: [] });
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
          <Filter className="w-3.5 h-3.5" />
          Filter
        </div>

        <MultiSelect
          label="Brand"
          options={unique('parent_brand')}
          selected={filters.brands}
          onToggle={(v) => toggle('brands', v)}
        />
        <MultiSelect
          label="Sub Brand"
          options={subBrandOptions}
          selected={filters.subBrands}
          onToggle={(v) => toggle('subBrands', v)}
        />
        <MultiSelect
          label="City"
          options={unique('city')}
          selected={filters.cities}
          onToggle={(v) => toggle('cities', v)}
        />
        <MultiSelect
          label="State"
          options={unique('state')}
          selected={filters.states}
          onToggle={(v) => toggle('states', v)}
        />
        <MultiSelect
          label="GM"
          options={unique('gm_name')}
          selected={filters.gms}
          onToggle={(v) => toggle('gms', v)}
        />

        {activeCount > 0 && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 font-medium transition-colors"
          >
            <X className="w-3 h-3" />
            Clear all ({activeCount})
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-border">
          {Object.entries(filters).map(([key, values]) =>
            values.map(v => (
              <span
                key={`${key}-${v}`}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
              >
                {v}
                <button
                  onClick={() => toggle(key, v)}
                  className="hover:opacity-70 transition-opacity ml-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function MultiSelect({ label, options, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (options.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors
          ${selected.length > 0
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-background border-border text-foreground hover:bg-muted'
          }`}
      >
        {label}
        {selected.length > 0 && (
          <span className="bg-white/25 rounded-full px-1.5 py-0 text-[10px] font-bold leading-4">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-popover border border-border rounded-xl shadow-lg min-w-[160px] max-h-64 overflow-y-auto py-1">
          {options.map(opt => (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
            >
              <span className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors
                ${selected.includes(opt) ? 'bg-primary border-primary' : 'border-border'}`}
              >
                {selected.includes(opt) && (
                  <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className="font-medium text-foreground">{opt}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}