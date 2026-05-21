import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getLeadTypes } from '@/functions/getLeadTypes';

export default function PropertyFilters({ properties, filters, onChange }) {
  const [leadTypes, setLeadTypes] = React.useState([]);

  React.useEffect(() => {
    getLeadTypes({}).then(res => {
      if (res?.data?.leadTypes) setLeadTypes(res.data.leadTypes);
    }).catch(() => {});
  }, []);

  const brands = [...new Set(properties.map(p => p.parent_brand).filter(Boolean))].sort();
  const subBrands = [...new Set(properties.map(p => p.sub_brand).filter(Boolean))].sort();
  const cities = [...new Set(properties.map(p => p.city).filter(Boolean))].sort();
  const states = [...new Set(properties.map(p => p.state).filter(Boolean))].sort();

  const set = (key, val) => onChange({ ...filters, [key]: val === '__all__' ? '' : val });

  return (
    <div className="flex flex-wrap gap-2">
      <Select value={filters.leadType || '__all__'} onValueChange={v => set('leadType', v)}>
        <SelectTrigger className="w-44 h-8 text-xs">
          <SelectValue placeholder="All Lead Types" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Lead Types</SelectItem>
          {leadTypes.map(lt => <SelectItem key={lt} value={lt}>{lt}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.brand || '__all__'} onValueChange={v => set('brand', v)}>
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue placeholder="All Brands" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Brands</SelectItem>
          {brands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.subBrand || '__all__'} onValueChange={v => set('subBrand', v)}>
        <SelectTrigger className="w-40 h-8 text-xs">
          <SelectValue placeholder="All Sub-Brands" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Sub-Brands</SelectItem>
          {subBrands.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.state || '__all__'} onValueChange={v => set('state', v)}>
        <SelectTrigger className="w-28 h-8 text-xs">
          <SelectValue placeholder="All States" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All States</SelectItem>
          {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.city || '__all__'} onValueChange={v => set('city', v)}>
        <SelectTrigger className="w-36 h-8 text-xs">
          <SelectValue placeholder="All Cities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">All Cities</SelectItem>
          {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}