import React from 'react';
import { Link } from 'react-router-dom';
import { getBrandColor } from '@/lib/portfolioHelpers';

export default function KpiTracker({ title, icon, iconColor, subtitle, hotels }) {
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
  
  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-border flex items-center gap-2">
        {icon}
        <h2 className="font-bold text-foreground">{title}</h2>
        {subtitle && (
          <span className="ml-auto text-xs text-muted-foreground">{subtitle}</span>
        )}
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
              // Segmented bar for partial passes (RGI)
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
              // Simple bar for pass/fail
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${pct}%`, backgroundColor: pct >= 75 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444' }}
              />
            )}
          </div>
        </div>

        {/* Hotel list split into two columns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {hotelsWithData.map(({ prop, status, details }) => {
            const brandColor = getBrandColor(prop.parent_brand);
            const isPass = status === 'pass';
            const isPartial = status === 'partial';
            const isNa = status === 'na';
            
            return (
              <div key={prop.id} className="flex items-center gap-2 py-1">
                <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: brandColor }} />
                <Link to={`/hotel-scorecard?propertyId=${prop.id}`} className="text-xs text-foreground hover:underline truncate flex-1">
                  {prop.name}
                </Link>
                <div className="flex items-center gap-1 shrink-0">
                  {details && (
                    <span className="text-[10px] text-muted-foreground hidden lg:inline">
                      {details}
                    </span>
                  )}
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
                    style={{
                      backgroundColor: isNa ? '#f1f5f9' : isPass ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2',
                      color: isNa ? '#94a3b8' : isPass ? '#15803d' : isPartial ? '#92400e' : '#dc2626',
                    }}
                  >
                    {isNa ? 'N/A' : isPass ? 'PASS' : isPartial ? 'PARTIAL' : 'FAIL'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}