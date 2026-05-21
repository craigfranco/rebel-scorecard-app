import React, { useState, useEffect, useMemo } from 'react';
import { getLeadTypes } from '@/functions/getLeadTypes';

// Lead role definitions with grouping and field mapping
const LEAD_ROLE_GROUPS = [
  {
    label: 'CORPORATE',
    roles: [
      { label: 'Corporate Operations', field: 'corporate_operations' },
      { label: 'Corporate Finance',    field: 'corporate_finance' },
      { label: 'Corporate HR',         field: 'corporate_hr' },
      { label: 'Corporate Revenue',    field: 'corporate_revenue' },
      { label: 'Corporate Sales',      field: 'corporate_sales' },
      { label: 'Corporate E-Commerce', field: 'corporate_ecommerce' },
    ],
  },
  {
    label: 'PROPERTY',
    roles: [
      { label: 'General Manager',              field: 'property_gm' },
      { label: 'Director of Sales & Marketing', field: 'property_dosm' },
      { label: 'Director of Finance',           field: 'property_dof' },
      { label: 'Director of Engineering',       field: 'property_doe' },
      { label: 'Director of Revenue',           field: 'property_dorm' },
      { label: 'Director of HR',                field: 'property_hrd' },
    ],
  },
];

const ALL_ROLES = LEAD_ROLE_GROUPS.flatMap(g => g.roles);

function FilterSelect({ value, onChange, placeholder, children, width = 'auto' }) {
  return (
    <div className="relative" style={{ minWidth: width }}>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none h-9 pl-3 pr-8 text-sm bg-white border border-gray-200 rounded-lg shadow-sm text-gray-700 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors w-full"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {children}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center">
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

export default function PropertyFilters({ properties, filters, onChange }) {
  const [fieldToPersonStrIds, setFieldToPersonStrIds] = useState({});

  useEffect(() => {
    getLeadTypes({}).then(res => {
      if (res?.data?.fieldToPersonStrIds) setFieldToPersonStrIds(res.data.fieldToPersonStrIds);
    }).catch(() => {});
  }, []);

  const set = (key, val) => onChange({ ...filters, [key]: val });

  const allBrands = useMemo(() =>
    [...new Set(properties.map(p => p.parent_brand).filter(Boolean))].sort(),
    [properties]
  );

  const subBrands = useMemo(() => {
    const base = filters.brand ? properties.filter(p => p.parent_brand === filters.brand) : properties;
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

  // People options for the selected role
  const personOptions = useMemo(() => {
    if (!filters.leadRole) return [];
    const personMap = fieldToPersonStrIds[filters.leadRole] || {};
    return Object.entries(personMap)
      .map(([name, strIds]) => ({ name, count: strIds.length }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [filters.leadRole, fieldToPersonStrIds]);

  const selectedRoleLabel = ALL_ROLES.find(r => r.field === filters.leadRole)?.label || '';

  const handleLeadRoleChange = (val) => {
    onChange({ ...filters, leadRole: val, leadPerson: '' });
  };

  const hasActiveFilters = filters.brand || filters.subBrand || filters.city || filters.state || filters.leadRole || filters.leadPerson;

  const clearAll = () => onChange({ brand: '', subBrand: '', city: '', state: '', leadRole: '', leadPerson: '' });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Brand */}
      <FilterSelect
        value={filters.brand}
        onChange={v => onChange({ ...filters, brand: v, subBrand: '' })}
        placeholder={`All Brands (${allBrands.length})`}
        width="160px"
      >
        {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
      </FilterSelect>

      {/* Sub-Brand */}
      <FilterSelect
        value={filters.subBrand}
        onChange={v => set('subBrand', v)}
        placeholder={`All Sub-Brands (${subBrands.length})`}
        width="180px"
      >
        {subBrands.map(b => <option key={b} value={b}>{b}</option>)}
      </FilterSelect>

      {/* City */}
      <FilterSelect
        value={filters.city}
        onChange={v => set('city', v)}
        placeholder={`All Cities (${allCities.length})`}
        width="148px"
      >
        {allCities.map(c => <option key={c} value={c}>{c}</option>)}
      </FilterSelect>

      {/* State */}
      <FilterSelect
        value={filters.state}
        onChange={v => set('state', v)}
        placeholder={`All States (${allStates.length})`}
        width="130px"
      >
        {allStates.map(s => <option key={s} value={s}>{s}</option>)}
      </FilterSelect>

      {/* Step 1 — Lead Role (grouped) */}
      <FilterSelect
        value={filters.leadRole}
        onChange={handleLeadRoleChange}
        placeholder="Filter by Lead Type"
        width="190px"
      >
        {LEAD_ROLE_GROUPS.map(group => (
          <optgroup key={group.label} label={group.label}>
            {group.roles.map(r => (
              <option key={r.field} value={r.field}>{r.label}</option>
            ))}
          </optgroup>
        ))}
      </FilterSelect>

      {/* Step 2 — Person (only shown when a role is selected) */}
      {filters.leadRole && (
        <FilterSelect
          value={filters.leadPerson}
          onChange={v => set('leadPerson', v)}
          placeholder={`All ${selectedRoleLabel} (${personOptions.length})`}
          width="220px"
        >
          {personOptions.map(({ name, count }) => (
            <option key={name} value={name}>{name} ({count})</option>
          ))}
        </FilterSelect>
      )}

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="h-9 px-3 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 hover:text-gray-700 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}