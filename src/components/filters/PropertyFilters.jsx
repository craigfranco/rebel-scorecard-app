import React, { useState, useEffect, useMemo } from 'react';
import { getLeadTypes } from '@/functions/getLeadTypes';

function FilterSelect({ value, onChange, options, allLabel, width = 'auto' }) {
  return (
    <div className="relative" style={{ minWidth: width }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none h-9 pl-3 pr-8 text-sm bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors w-full"
      >
        <option value="">{allLabel}</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export default function PropertyFilters({ properties, filters, onChange, strIdToLeads = {} }) {
  const [leadTypes, setLeadTypes] = useState([]);

  useEffect(() => {
    getLeadTypes({}).then(res => {
      if (res?.data?.leadTypes) setLeadTypes(res.data.leadTypes);
    }).catch(() => {});
  }, []);

  const set = (key, val) => onChange({ ...filters, [key]: val });

  // All unique brands (unfiltered)
  const allBrands = useMemo(() =>
    [...new Set(properties.map(p => p.parent_brand).filter(Boolean))].sort(),
    [properties]
  );

  // Sub-brands cascade from selected brand
  const subBrands = useMemo(() => {
    const base = filters.brand
      ? properties.filter(p => p.parent_brand === filters.brand)
      : properties;
    return [...new Set(base.map(p => p.sub_brand).filter(Boolean))].sort();
  }, [properties, filters.brand]);

  const allCities = useMemo(() =>
    [...new Set(properties.map(p => p.city).filter(Boolean))].sort(),
    [properties]
  );

  const allStates = useMemo(() =>
    [...new Set(properties.map(p => p.state).filter(Boolean))].sort(),
    [properties]
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <FilterSelect
        value={filters.brand}
        onChange={v => {
          // When brand changes, clear sub-brand if it no longer belongs
          onChange({ ...filters, brand: v, subBrand: '' });
        }}
        options={allBrands.map(b => ({ value: b, label: b }))}
        allLabel={`All Brands (${allBrands.length})`}
        width="160px"
      />

      <FilterSelect
        value={filters.subBrand}
        onChange={v => set('subBrand', v)}
        options={subBrands.map(b => ({ value: b, label: b }))}
        allLabel={`All Sub-Brands (${subBrands.length})`}
        width="180px"
      />

      <FilterSelect
        value={filters.city}
        onChange={v => set('city', v)}
        options={allCities.map(c => ({ value: c, label: c }))}
        allLabel={`All Cities (${allCities.length})`}
        width="148px"
      />

      <FilterSelect
        value={filters.state}
        onChange={v => set('state', v)}
        options={allStates.map(s => ({ value: s, label: s }))}
        allLabel={`All States (${allStates.length})`}
        width="130px"
      />

      <FilterSelect
        value={filters.leadType}
        onChange={v => set('leadType', v)}
        options={leadTypes.map(lt => ({ value: lt, label: lt }))}
        allLabel="Filter by Lead Type"
        width="180px"
      />
    </div>
  );
}