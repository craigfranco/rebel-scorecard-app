import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getQuarterFromMonth, MONTHS } from '@/lib/scoring';

/**
 * PortfolioSummarySection — editable executive narrative for the Leadership Scorecard.
 * One summary per year + quarter, shared across all lead-role groupings.
 */
export default function PortfolioSummarySection({ selectedMonth, selectedYear, periodType }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const quarter = getQuarterFromMonth(selectedMonth);
  const [text, setText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const { data: existing = [] } = useQuery({
    queryKey: ['portfolio-summary', selectedYear, quarter],
    queryFn: () => base44.entities.PortfolioSummary.filter({ year: selectedYear, quarter }),
  });

  useEffect(() => {
    setText(existing[0]?.summary_text || '');
  }, [existing]);

  const mutation = useMutation({
    mutationFn: async () => {
      const record = existing[0];
      if (record?.id) {
        return await base44.entities.PortfolioSummary.update(record.id, { summary_text: text });
      }
      return await base44.entities.PortfolioSummary.create({ year: selectedYear, quarter, summary_text: text });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['portfolio-summary', selectedYear, quarter]);
      toast({ title: 'Saved', description: 'Portfolio summary updated.', duration: 2000 });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to save. Please try again.', variant: 'destructive', duration: 3000 });
    },
  });

  const handleCancel = () => {
    setText(existing[0]?.summary_text || '');
    setIsEditing(false);
  };

  const periodLabel = periodType === 'month' ? `${MONTHS[selectedMonth - 1]} ${selectedYear}` : `Q${quarter} ${selectedYear}`;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground">Portfolio Summary</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Executive narrative — {periodLabel}</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" className="text-xs">Edit</Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button onClick={handleCancel} variant="outline" size="sm" className="text-xs" disabled={mutation.isPending}>Cancel</Button>
            <Button onClick={() => mutation.mutate()} size="sm" className="text-xs" disabled={mutation.isPending}>
              <Save className="w-3.5 h-3.5 mr-1" />
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>
      <div className="p-6">
        {!isEditing ? (
          text ? (
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
          ) : (
            <p className="text-sm text-muted-foreground italic">No portfolio summary recorded for this period.</p>
          )
        ) : (
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter portfolio summary narrative for this period..."
            className="min-h-[160px] text-sm resize-y"
          />
        )}
      </div>
    </div>
  );
}