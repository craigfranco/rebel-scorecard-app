import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { getQuarterFromMonth, getQuarterStartMonth, MONTHS } from '@/lib/scoring';

/**
 * KeyWinsSection — GM narrative section for monthly/quarterly scorecards.
 * Three categories (Key Wins, Previous Results, Next Priorities), each with 3 numbered initiatives.
 */
export default function KeyWinsSection({ property, entry, periodType, selectedMonth, selectedYear }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [localData, setLocalData] = useState({
    key_wins: '',
    previous_results: '',
    next_priorities: '',
  });

  const [isEditing, setIsEditing] = useState(false);

  // Sync local state when entry changes
  useEffect(() => {
    setLocalData({
      key_wins: entry?.key_wins || '',
      previous_results: entry?.previous_results || '',
      next_priorities: entry?.next_priorities || '',
    });
  }, [entry]);

  const mutation = useMutation({
    mutationFn: async (data) => {
      // Determine the month to use based on period type
      let month;
      if (periodType === 'month') {
        month = selectedMonth;
      } else if (periodType === 'quarter') {
        month = getQuarterStartMonth(selectedMonth);
      } else {
        month = selectedMonth; // YTD defaults to selected month
      }

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
    mutation.mutate(localData);
  };

  const handleCancel = () => {
    setLocalData({
      key_wins: entry?.key_wins || '',
      previous_results: entry?.previous_results || '',
      next_priorities: entry?.next_priorities || '',
    });
    setIsEditing(false);
  };

  const updateField = (field, value) => {
    setLocalData(prev => ({ ...prev, [field]: value }));
  };

  // Helper to render numbered initiatives (1-3)
  const renderInitiatives = (label, field, placeholder) => {
    if (!isEditing) {
      const value = localData[field];
      if (!value || value.trim() === '') {
        return (
          <div className="text-xs text-muted-foreground italic">No {label.toLowerCase()} entered</div>
        );
      }
      return (
        <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{value}</div>
      );
    }

    return (
      <Textarea
        value={localData[field]}
        onChange={(e) => updateField(field, e.target.value)}
        placeholder={placeholder}
        className="min-h-[120px] text-sm resize-none"
      />
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
          {renderInitiatives(
            'Key Wins',
            'key_wins',
            'Enter 3 key wins (numbered 1-3):\n1. \n2. \n3. '
          )}
        </div>

        {/* Previous Months Results */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            Previous Months Results
          </h3>
          {renderInitiatives(
            'Previous Results',
            'previous_results',
            'Enter 3 previous results (numbered 1-3):\n1. \n2. \n3. '
          )}
        </div>

        {/* Next Months Priorities */}
        <div className="space-y-2">
          <h3 className="font-semibold text-sm text-foreground flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
            Next Months Priorities
          </h3>
          {renderInitiatives(
            'Next Priorities',
            'next_priorities',
            'Enter 3 next priorities (numbered 1-3):\n1. \n2. \n3. '
          )}
        </div>
      </div>
    </div>
  );
}