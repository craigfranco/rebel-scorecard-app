import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CalendarClock, FileSpreadsheet, BarChart3 } from 'lucide-react';

const STORAGE_KEY = 'announcement_june_data_2026';

export default function DataAnnouncementPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setOpen(true);
    }
  }, []);

  const handleOpenChange = (val) => {
    setOpen(val);
    if (!val) {
      localStorage.setItem(STORAGE_KEY, 'dismissed');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'hsl(207 35% 27%)' }}>
              <CalendarClock className="w-5 h-5 text-white" />
            </div>
            <DialogTitle className="text-lg">Upcoming Data Update</DialogTitle>
          </div>
          <DialogDescription className="text-sm text-muted-foreground">
            June data is on its way.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <BarChart3 className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">STR Data — June</p>
              <p className="text-xs text-muted-foreground">RevPAR Index & competitive set report</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3">
            <FileSpreadsheet className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">GOP Data — June</p>
              <p className="text-xs text-muted-foreground">P&L and budgeted GOP figures</p>
            </div>
          </div>
          <p className="text-sm pt-1">
            These reports will be uploaded <span className="font-semibold">on or around July 20th</span>.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}