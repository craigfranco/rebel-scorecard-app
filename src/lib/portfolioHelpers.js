import React from 'react';

const BRAND_COLORS = {
  Marriott: '#e11d48',
  Hilton: '#2563eb',
  IHG: '#16a34a',
  Hyatt: '#ca8a04',
  Choice: '#9333ea',
  Independent: '#64748b',
};

export function getBrandColor(brand) {
  return BRAND_COLORS[brand] || BRAND_COLORS.Independent;
}

export function getStatusBadge(scorecard) {
  if (!scorecard) return { label: 'NO DATA', color: '#94a3b8', bgColor: '#e2e8f0' };
  
  const kpis = [scorecard.gop, scorecard.gopMargin, scorecard.rgi, scorecard.gss];
  const incomplete = kpis.some(k => k?.incomplete);
  
  if (incomplete) {
    return { label: 'INCOMPLETE', color: '#64748b', bgColor: '#f1f5f9' };
  }
  
  const failedCount = kpis.filter(k => !k?.pass).length;
  
  if (failedCount === 0) {
    return { label: 'ON TRACK', color: '#16a34a', bgColor: '#dcfce7' };
  } else if (failedCount <= 2) {
    return { label: 'WATCH', color: '#ca8a04', bgColor: '#fef3c7' };
  } else {
    return { label: 'AT RISK', color: '#dc2626', bgColor: '#fee2e2' };
  }
}

export function getVarianceColor(actual, target, isPercentage = false) {
  if (actual == null || target == null) return 'text-muted-foreground';
  const variance = actual - target;
  if (variance > 0) return 'text-pass';
  if (variance < 0) return 'text-fail';
  return 'text-muted-foreground';
}

export function formatCurrency(value, compact = false) {
  if (value == null) return '—';
  if (compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toFixed(0)}K`;
  }
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export function formatPercentage(value, decimals = 1) {
  if (value == null) return '—';
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`;
}