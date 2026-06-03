import React, { useState } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { getBrandColor } from '@/lib/portfolioHelpers';

function fmtDollar(val) {
  if (val == null) return '—';
  return '$' + Math.round(val).toLocaleString('en-US');
}

function fmtPct(val, decimals = 1) {
  if (val == null) return '—';
  return val.toFixed(decimals) + '%';
}

function fmtNum(val, decimals = 1) {
  if (val == null) return '—';
  return val.toFixed(decimals);
}

export default function KpiTracker({ title, icon, iconColor, subtitle, hotels }) {
  const [expanded, setExpanded] = useState(false);
  
  // Filter to only hotels with data
  const hotelsWithData = hotels.filter(h => h.hasData);
  
  // Count by status
  const passCount = hotelsWithData.filter(h => h.status === 'pass').length;
  const partialCount = hotelsWithData.filter(h => h.status === 'partial').length;
  const failCount = hotelsWithData.filter(h => h.status === 'fail').length;
  const naCount = hotelsWithData.filter(h => h.status === 'na').length;
  const total = hotelsWithData.length;
  
  // Calculate percentage (pass only, or pass + partial for RGI)
  const effectivePassCount = passCount + partialCount;
  const pct = total > 0 ? (effectivePassCount / total) * 100 : 0;
  
  // Sort hotels: failing first, then passing
  const sortedHotels = [...hotelsWithData].sort((a, b) => {
    const statusOrder = { 'fail': 0, 'partial': 1, 'na': 2, 'pass': 3 };
    return (statusOrder[a.status] ?? 4) - (statusOrder[b.status] ?? 4);
  });

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div 
        className="px-6 py-4 border-b border-border flex items-center gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {icon}
        <h2 className="font-bold text-foreground">{title}</h2>
        {subtitle && (
          <span className="ml-auto text-xs text-muted-foreground">{subtitle}</span>
        )}
        <button className="ml-2 text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <div className="px-6 py-4 space-y-4">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-foreground">
                {passCount} pass
              </span>
              {partialCount > 0 && (
                <span className="text-muted-foreground">
                  {partialCount} partial
                </span>
              )}
              {failCount > 0 && (
                <span className="text-muted-foreground">
                  {failCount} fail
                </span>
              )}
              {naCount > 0 && (
                <span className="text-muted-foreground">
                  {naCount} N/A
                </span>
              )}
            </div>
            <span className="text-sm font-bold" style={{ color: pct >= 75 ? '#16a34a' : pct >= 50 ? '#ca8a04' : '#dc2626' }}>
              {pct.toFixed(0)}%
            </span>
          </div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            {partialCount > 0 ? (
              <div className="flex h-full">
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${(passCount / total) * 100}%`, backgroundColor: '#22c55e' }}
                />
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${(partialCount / total) * 100}%`, backgroundColor: '#f59e0b' }}
                />
                <div
                  className="h-full transition-all duration-700"
                  style={{ width: `${(failCount / total) * 100}%`, backgroundColor: '#ef4444' }}
                />
              </div>
            ) : (
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}
              />
            )}
          </div>
        </div>

        {/* Expanded drill-down panel */}
        {expanded && (
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Hotel Details</h3>
              <button 
                onClick={() => setExpanded(false)}
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <X className="w-3 h-3" /> Close
              </button>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {sortedHotels.map(({ prop, status, actual, target, ly, metricType }) => {
                const brandColor = getBrandColor(prop.parent_brand);
                const isPass = status === 'pass';
                const isPartial = status === 'partial';
                const isNa = status === 'na';
                
                return (
                  <div key={prop.id} className="flex items-start gap-3 py-3 px-4 rounded-lg bg-muted/30">
                    <div className="w-2 h-2 rounded-full shrink-0 mt-1" style={{ backgroundColor: brandColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-semibold text-foreground truncate">
                          {prop.name}
                        </span>
                        <span
                          className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0"
                          style={{
                            backgroundColor: isNa ? '#f1f5f9' : isPass ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2',
                            color: isNa ? '#94a3b8' : isPass ? '#15803d' : isPartial ? '#92400e' : '#dc2626',
                          }}
                        >
                          {isNa ? 'N/A' : isPass ? '✓ PASS' : isPartial ? 'PARTIAL' : '✗ FAIL'}
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div>
                          <div className="text-muted-foreground mb-0.5">Actual</div>
                          <div className="font-semibold text-foreground">
                            {metricType === 'gop' || metricType === 'forecast' ? fmtDollar(actual) : 
                             metricType === 'margin' ? fmtPct(actual) :
                             metricType === 'rgi' ? fmtNum(actual) :
                             fmtNum(actual)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-0.5">Target</div>
                          <div className="font-semibold text-foreground">
                            {metricType === 'gop' || metricType === 'forecast' ? fmtDollar(target) : 
                             metricType === 'margin' ? fmtPct(target) :
                             metricType === 'rgi' ? fmtPct(target) :
                             fmtNum(target)}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground mb-0.5">LY</div>
                          <div className="font-semibold text-foreground">
                            {metricType === 'gop' ? fmtDollar(ly) : 
                             metricType === 'margin' ? fmtPct(ly) :
                             metricType === 'rgi' ? fmtNum(ly) :
                             fmtNum(ly)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}