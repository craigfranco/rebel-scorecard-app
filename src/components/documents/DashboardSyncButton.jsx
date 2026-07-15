import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { deploymentSync } from '@/functions/deploymentSync';

export default function DashboardSyncButton() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await deploymentSync({ pull: true });
      const data = res.data || {};
      toast({
        title: '✅ Sync complete',
        description: `${data.properties_upserted ?? 0} properties synced from the Dashboard app.`,
      });
      queryClient.invalidateQueries({ queryKey: ['properties'] });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (err) {
      toast({
        title: '⚠️ Sync failed',
        description: err?.response?.data?.error || err?.message || 'Could not reach the Dashboard app.',
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing} className="gap-1.5">
      <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
      {syncing ? 'Syncing…' : 'Sync with Dashboard'}
    </Button>
  );
}