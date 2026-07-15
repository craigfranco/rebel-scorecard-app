import React from 'react';
import { CheckCircle, AlertCircle, PlusCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const NONE = '__none__';
const NEW = '__new__';

export { NEW as NEW_PROPERTY_SENTINEL };

export default function HotelMatchTable({ rows, matches, setMatches, properties }) {
  const getValue = (matched) => {
    if (!matched) return NONE;
    if (matched.__new__) return NEW;
    return matched.id;
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Review how hotel names in the file matched to your Properties. Unmatched hotels will be created as new properties automatically — fix any mismatches before importing.
      </p>
      <div className="border border-border rounded-xl overflow-hidden max-h-[350px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0">
            <tr className="bg-muted/50 text-muted-foreground uppercase tracking-wide">
              <th className="py-2 px-3 text-left font-semibold">Name in File</th>
              <th className="py-2 px-3 text-left font-semibold">Matched Property</th>
              <th className="py-2 px-3 text-center font-semibold w-16">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const matched = matches[i];
              const val = getValue(matched);
              return (
                <tr key={i} className="border-t border-border hover:bg-muted/20">
                  <td className="py-2 px-3 font-medium text-foreground">
                    {row.hotel_name}
                    {row.str_id && (
                      <span className="text-muted-foreground ml-1">({row.str_id})</span>
                    )}
                  </td>
                  <td className="py-2 px-3">
                    <Select
                      value={val}
                      onValueChange={v => {
                        if (v === NONE) {
                          setMatches(prev => { const n = [...prev]; n[i] = null; return n; });
                        } else if (v === NEW) {
                          setMatches(prev => { const n = [...prev]; n[i] = { __new__: true, name: row.hotel_name, str_id: row.str_id || null }; return n; });
                        } else {
                          const prop = properties.find(p => p.id === v) || null;
                          setMatches(prev => { const n = [...prev]; n[i] = prop; return n; });
                        }
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="— unmatched —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NEW}>
                          <span className="flex items-center gap-1 text-green-700">
                            <PlusCircle className="w-3 h-3" /> Create new property
                          </span>
                        </SelectItem>
                        <SelectItem value={NONE}>— unmatched (skip) —</SelectItem>
                        {properties.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {matched && !matched.__new__
                      ? <CheckCircle className="w-4 h-4 text-green-500 inline" />
                      : matched && matched.__new__
                        ? <PlusCircle className="w-4 h-4 text-blue-500 inline" />
                        : <AlertCircle className="w-4 h-4 text-amber-500 inline" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.filter((_, i) => matches[i]).length} of {rows.length} rows will be imported
        {rows.filter((_, i) => matches[i]?.__new__).length > 0 && (
          <span className="text-blue-600"> ({rows.filter((_, i) => matches[i]?.__new__).length} new hotel{rows.filter((_, i) => matches[i]?.__new__).length > 1 ? 's' : ''} will be created)</span>
        )}.
      </p>
    </div>
  );
}