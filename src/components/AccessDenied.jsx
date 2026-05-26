import React from 'react';
import { ShieldOff, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function AccessDenied({ reason = 'not_found' }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <div className="max-w-md w-full mx-4 text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto" style={{ backgroundColor: '#fef2f2' }}>
          <ShieldOff className="w-10 h-10" style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          {reason === 'inactive' ? (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your account has been deactivated. Please contact your administrator to restore access.
            </p>
          ) : (
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your account is not yet set up in this system. Please contact your administrator to request access.
            </p>
          )}
        </div>
        <div className="bg-muted/50 rounded-xl p-4 text-xs text-muted-foreground">
          Contact: <a href="mailto:craig.franco@rebelhotelco.com" className="font-semibold text-primary hover:underline">craig.franco@rebelhotelco.com</a>
        </div>
        <button
          onClick={() => base44.auth.logout()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-muted hover:bg-muted/80 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}