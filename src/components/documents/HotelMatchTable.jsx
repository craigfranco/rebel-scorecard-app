import React from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function HotelMatchTable({ rows, matches, setMatches, properties }) {
  const NONE = '__none__';

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Review how hotel names in the file matched to your Properties. Fix any mismatches before importing.
      </p>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50 text-muted-foreground uppercase tracking-wide">
              <th className="py-2 px-3 text-left font-semibold">Name in File</th>
              <th className="py-2 px-3 text-left font-semibold">Matched Property</th>
              <th className="py-2 px-3 text-center font-semibold w-16">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const matched = matches[i];
              return (
                <tr key={i} className="border-t border-border hover:bg-muted/20">
                  <td className="py-2 px-3 font-medium text-foreground">{row.hotel_name}</td>
                  <td className="py-2 px-3">
                    <Select
                      value={matched?.id || NONE}
                      onValueChange={v => {
                        const prop = properties.find(p => p.id === v) || null;
                        setMatches(prev => { const n = [...prev]; n[i] = prop; return n; });
                      }}
                    >
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue placeholder="— unmatched —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— unmatched (skip) —</SelectItem>
                        {properties.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-2 px-3 text-center">
                    {matched
                      ? <CheckCircle className="w-4 h-4 text-green-500 inline" />
                      : <AlertCircle className="w-4 h-4 text-amber-500 inline" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        {rows.filter((_, i) => matches[i]).length} of {rows.length} rows will be imported.
      </p>
    </div>
  );
}