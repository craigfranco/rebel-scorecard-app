import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getQuarterFromMonth, getQuarterStartMonth, MONTHS } from '@/lib/scoring';

// Parse initiatives from stored text into array of 3
function parseInitiatives(text) {
  if (!text) return ['', '', ''];
  // Split by numbered patterns (1., 2., 3. or 1) 2) 3))
  const lines = text.split(/\d+[.)]\s*/).filter(line => line.trim());
  const result = ['', '', ''];
  for (let i = 0; i < 3; i++) {
    result[i] = lines[i] ? lines[i].trim() : '';
  }
  return result;
}

// Convert array of 3 initiatives back to numbered text
function formatInitiatives(initiatives) {
  return initiatives
    .map((text, i) => text.trim() ? `${i + 1}. ${text.trim()}` : '')
    .filter(t => t)
    .join('\n');
}

/**
 * KeyWinsSection — GM narrative section for monthly/quarterly scorecards.
 * Three categories (Key Wins, Previous Results, Next Priorities), each with 3 numbered initiatives.
 */
export default function KeyWinsSection({ property, entry, periodType, selectedMonth, selectedYear }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Store as arrays of 3 initiatives each
  const [initiatives, setInitiatives] = useState({
    key_wins: ['', '', ''],
    previous_results: ['', '', ''],
    next_priorities: ['', '', ''],
  });

  const [isEditing, setIsEditing] = useState(false);

  // Sync local state when entry changes
  useEffect(() => {
    setInitiatives({
      key_wins: parseInitiatives(entry?.key_wins || ''),
      previous_results: parseInitiatives(entry?.previous_results || ''),
      next_priorities: parseInitiatives(entry?.next_priorities || ''),
    });
  }, [entry]);

  const mutation = useMutation({
    mutationFn: async () => {
      // Determine the month to use based on period type
      let month;
      if (periodType === 'month') {
        month = selectedMonth;
      } else if (periodType === 'quarter') {
        month = getQuarterStartMonth(selectedMonth);
      } else {
        month = selectedMonth; // YTD defaults to selected month
      }

      const data = {
        key_wins: formatInitiatives(initiatives.key_wins),
        previous_results: formatInitiatives(initiatives.previous_results),
        next_priorities: formatInitiatives(initiatives.next_priorities),
      };

      if (!entry?.id) {
        // Create new ScoreEntry
        const newEntry = await base44.entities.ScoreEntry.create({
          property_id: property.id,
          month,
          year: selectedYear,
          quarter: getQuarterFromMonth(month),
          ...data,
        });
        return newEntry;
      } else {
        // Update existing
        return await base44.entities.ScoreEntry.update(entry.id, data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['score-entries', property?.id, selectedYear]);
      toast({
        title: 'Saved',
        description: 'Key Wins & Risks section updated successfully.',
        duration: 2000,
      });
      setIsEditing(false);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: 'Failed to save. Please try again.',
        variant: 'destructive',
        duration: 3000,
      });
    },
  });

  const handleSave = () => {
    mutation.mutate();
  };

  const handleCancel = () => {
    setInitiatives({
      key_wins: parseInitiatives(entry?.key_wins || ''),
      previous_results: parseInitiatives(entry?.previous_results || ''),
      next_priorities: parseInitiatives(entry?.next_priorities || ''),
    });
    setIsEditing(false);
  };

  const updateInitiative = (category, index, value) => {
    setInitiatives(prev => ({
      ...prev,
      [category]: prev[category].map((item, i) => i === index ? value : item),
    }));
  };

  // Render 3 separate text boxes for each category
  const renderInitiatives = (label, category, colorClass) => {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((idx) => (
          <div key={idx} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              {label} #{idx + 1}
            </label>
            {!isEditing ? (
              initiatives[category][idx] ? (
                <div className="text-sm text-foreground leading-relaxed">{initiatives[category][idx]}</div>
              ) : (
                <div className="text-xs text-muted-foreground italic">Not specified</div>
              )
            ) : (
              <Textarea
                value={initiatives[category][idx]}
                onChange={(e) => updateInitiative(category, idx, e.target.value)}
                placeholder={`Enter ${label.toLowerCase()} #${idx + 1}...`}
                className="min-h-[60px] text-sm resize-none"
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div>
          <h2 className="font-bold text-foreground">Key Wins & Risks</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            GM narrative — {periodType === 'month' ? MONTHS[selectedMonth - 1] : `Q${getQuarterFromMonth(selectedMonth)}`} {selectedYear}
          </p>
        </div>
        {!isEditing ? (
          <Button
            onClick={() => setIsEditing(true)}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Edit
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              onClick={handleCancel}
              variant="outline"
              size="sm"
              className="text-xs"
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              className="text-xs"
              disabled={mutation.isPending}
            >
              <Save className="w-3.5 h-3.5 mr-1" />
              {mutation.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        )}
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Key Wins */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Key Wins
          </h3>
          {renderInitiatives('Key Win', 'key_wins', 'green')}
        </div>

        {/* Previous Months Results */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Previous Months Results
          </h3>
          {renderInitiatives('Result', 'previous_results', 'blue')}
        </div>

        {/* Next Months Priorities */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            Next Months Priorities
          </h3>
          {renderInitiatives('Priority', 'next_priorities', 'orange')}
        </div>
      </div>
    </div>
  );
}