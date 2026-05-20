import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * FilterBar — horizontal row of single-select dropdown filters
 * Matches screenshot: outlined dropdowns, chevron, "All X (N)" placeholders
 *
 * props:
 *   properties: Property[]
 *   filters: { brand, subBrand, city, state, leadType, department }
 *   onChange: (filters) => void
 */
export default function FilterBar({ properties = [], filters, onChange }) {
  const unique = (key) => {
    const vals = properties.map(p => p[key]).filter(Boolean);
    return [...new Set(vals)].sort();
  };

  const subBrandOptions = (() => {
    const source = filters.brand
      ? properties.filter(p => p.parent_brand === filters.brand)
      : properties;
    const vals = source.map(p => p.sub_brand).filter(Boolean);
    return [...new Set(vals)].sort();
  })();

  const brands = unique('parent_brand');
  const cities = unique('city');
  const states = unique('state');

  const handleChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    // Cascade: if brand changes, clear sub-brand if it no longer belongs
    if (key === 'brand') {
      if (value) {
        const validSubs = new Set(
          properties.filter(p => p.parent_brand === value).map(p => p.sub_brand).filter(Boolean)
        );
        if (filters.subBrand && !validSubs.has(filters.subBrand)) {
          newFilters.subBrand = '';
        }
      }
    }
    onChange(newFilters);
  };

  return (
    <div className="flex flex-wrap gap-2">
      <FilterDropdown
        placeholder={`All Brands (${brands.length})`}
        options={brands}
        value={filters.brand}
        onChange={(v) => handleChange('brand', v)}
      />
      <FilterDropdown
        placeholder={`All Sub-Brands (${subBrandOptions.length})`}
        options={subBrandOptions}
        value={filters.subBrand}
        onChange={(v) => handleChange('subBrand', v)}
      />
      <FilterDropdown
        placeholder={`All Cities (${cities.length})`}
        options={cities}
        value={filters.city}
        onChange={(v) => handleChange('city', v)}
      />
      <FilterDropdown
        placeholder={`All States (${states.length})`}
        options={states}
        value={filters.state}
        onChange={(v) => handleChange('state', v)}
      />
      <FilterDropdown
        placeholder="Filter by Lead Type"
        options={[]}
        value={filters.leadType}
        onChange={(v) => handleChange('leadType', v)}
      />
      <FilterDropdown
        placeholder="Filter by Department"
        options={[]}
        value={filters.department}
        onChange={(v) => handleChange('department', v)}
      />
    </div>
  );
}

function FilterDropdown({ placeholder, options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const displayLabel = value || placeholder;
  const isActive = !!value;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-2 h-9 px-3 text-sm rounded border bg-white transition-colors select-none whitespace-nowrap
          ${isActive
            ? 'border-gray-400 text-gray-900 font-medium'
            : 'border-gray-300 text-gray-500 hover:border-gray-400'
          }`}
        style={{ minWidth: 160 }}
      >
        <span className="flex-1 text-left truncate">{displayLabel}</span>
        <ChevronDown className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-white border border-gray-200 rounded shadow-lg min-w-full max-h-64 overflow-y-auto py-1">
          {/* Reset option */}
          <button
            onClick={() => { onChange(''); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors
              ${!value ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
          >
            {placeholder}
          </button>

          {options.length > 0 && <div className="border-t border-gray-100 my-1" />}

          {options.map(opt => (
            <button
              key={opt}
              onClick={() => { onChange(opt); setOpen(false); }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors
                ${value === opt ? 'font-semibold text-gray-900 bg-gray-50' : 'text-gray-700'}`}
            >
              {opt}
            </button>
          ))}

          {options.length === 0 && (
            <div className="px-3 py-2 text-xs text-gray-400 italic">No options available</div>
          )}
        </div>
      )}
    </div>
  );
}