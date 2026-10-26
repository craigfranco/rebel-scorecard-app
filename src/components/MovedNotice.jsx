import React from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const NEW_PORTAL_URL = 'https://pmd.rebelbi.com/scorecard';

export default function MovedNotice() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#f0f4f7' }}>
      <div className="max-w-xl w-full bg-card rounded-2xl shadow-lg border border-border p-10 text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mb-6">
          <Lock className="w-7 h-7 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">The Scorecard has moved</h1>
        <p className="mt-3 text-muted-foreground">
          This application is now closed for data entry and reporting. All future scorecard
          activity takes place in the new PMD portal.
        </p>
        <Button asChild size="lg" className="mt-8 h-11 px-8 text-base">
          <a href={NEW_PORTAL_URL}>
            Go to the new portal
            <ArrowRight className="ml-1" />
          </a>
        </Button>
        <p className="mt-6 text-xs text-muted-foreground break-all">{NEW_PORTAL_URL}</p>
      </div>
    </div>
  );
}