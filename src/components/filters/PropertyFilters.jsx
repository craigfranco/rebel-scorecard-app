import React from 'react';

/**
 * Filter bar with clean native-looking select dropdowns.
 * props:
 *   properties: Property[]
 *   filters: { brand: '', subBrand: '', city: '', state: '', leadType: '', department: '' }
 *   onChange: (filters) => void
 */
export default function PropertyFilters({ properties, filters, onChange }) {
  const unique = (key, sourceList = properties) => {
    const vals = sourceList.map(p => p[key]).filter(Boolean);
    return [...new Set(vals)].sort();
  };

  // Sub-brands cascade off selected brand
  const subBrandSource = filters.brand
    ? properties.filter(p => p.parent_brand === filters.brand)
    : properties;

  const brands = unique('parent_brand');
  const subBrands = unique('sub_brand', subBrandSource);
  const cities = unique('city');
  const states = unique('state');
  const leadTypes = unique('lead_type');
  const departments = unique('department');

  const set = (key, value) => {
    const next = { ...filters, [key]: value };
    // Reset sub-brand when brand changes
    if (key === 'brand') next.subBrand = '';
    onChange(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-3 bg-white border border-border rounded-xl px-4 py-3 shadow-sm">
      <FilterSelect
        value={filters.brand}
        onChange={v => set('brand', v)}
        allLabel={`All Brands (${brands.length})`}
        options={brands}
      />
      <FilterSelect
        value={filters.subBrand}
        onChange={v => set('subBrand', v)}
        allLabel={`All Sub-Brands (${subBrands.length})`}
        options={subBrands}
      />
      <FilterSelect
        value={filters.city}
        onChange={v => set('city', v)}
        allLabel={`All Cities (${cities.length})`}
        options={cities}
      />
      <FilterSelect
        value={filters.state}
        onChange={v => set('state', v)}
        allLabel={`All States (${states.length})`}
        options={states}
      />
      <FilterSelect
        value={filters.leadType}
        onChange={v => set('leadType', v)}
        allLabel="Filter by Lead Type"
        options={leadTypes}
      />
      <FilterSelect
        value={filters.department}
        onChange={v => set('department', v)}
        allLabel="Filter by Department"
        options={departments}
      />
    </div>
  );
}

function FilterSelect({ value, onChange, allLabel, options }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-white border border-gray-300 rounded-md text-sm text-gray-700 pl-3 pr-8 py-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary hover:border-gray-400 transition-colors min-w-[160px]"
      >
        <option value="">{allLabel}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}