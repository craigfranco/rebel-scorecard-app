import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import LeadershipRollupPdfExport from './LeadershipRollupPdfExport';

/**
 * OperatorSummarySection — editable narrative + per-operator PDF download,
 * shown inside each Leadership group card. Saved per year + quarter + lead role + leader.
 */
export default function OperatorSummarySection({ leaderName, leadRole, year, quarter, periodLabel, roleLabel, entries }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [text, setText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const queryKey = ['operator-summary', year, quarter, leadRole, leaderName];
  const { data: existing = [] } = useQuery({
    queryKey,
    queryFn: () => base44.entities.PortfolioSummary.filter({ year, quarter, lead_role: leadRole, leader_name: leaderName }),
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
      return await base44.entities.PortfolioSummary.create({
        year, quarter, lead_role: leadRole, leader_name: leaderName, summary_text: text,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast({ title: 'Saved', description: 'Operator summary updated.', duration: 2000 });
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

  return (
    <div className="border-t border-border bg-muted/20 px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h4 className="font-semibold text-sm text-foreground">Operator Summary</h4>
          <p className="text-xs text-muted-foreground">Narrative for {leaderName} — {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <Button size="sm" variant="outline" className="text-xs" onClick={() => setIsEditing(true)}>Edit</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" className="text-xs" onClick={handleCancel} disabled={mutation.isPending}>Cancel</Button>
              <Button size="sm" className="text-xs" onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                <Save className="w-3.5 h-3.5 mr-1" />{mutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </>
          )}
          <LeadershipRollupPdfExport
            groups={[[leaderName, entries]]}
            roleLabel={roleLabel}
            periodLabel={periodLabel}
            summaryText={text}
            title={`OPERATOR ROLLUP — ${leaderName.toUpperCase()}`}
          />
        </div>
      </div>
      {!isEditing ? (
        text ? (
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{text}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">No operator summary recorded for this period.</p>
        )
      ) : (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Enter summary narrative for ${leaderName}...`}
          className="min-h-[120px] text-sm resize-y bg-card"
        />
      )}
    </div>
  );
}