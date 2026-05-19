import React from 'react';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { Button } from '@/components/ui/button';
import { MONTHS } from '@/lib/aggregation';

export default function TimePeriodSelector() {
  const { 
    selectedMonth, 
    setSelectedMonth, 
    selectedYear, 
    periodType, 
    setPeriodType,
    availableMonths,
    availableQuarters,
    CURRENT_YEAR
  } = useTimePeriod();

  const handleMonthSelect = (month) => {
    setSelectedMonth(month);
    setPeriodType('month');
  };

  const handleQuarterSelect = (quarter) => {
    const firstMonth = (quarter - 1) * 3 + 1;
    setSelectedMonth(firstMonth);
    setPeriodType('quarter');
  };

  return (
    <div className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 space-y-3">
        {/* Row 1: Month Pills */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Month
          </span>
          <div className="flex flex-wrap gap-2">
            {availableMonths.map(({ month, year }) => (
              <Button
                key={`${year}-${month}`}
                variant={selectedMonth === month && year === selectedYear ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMonthSelect(month)}
                className={`text-xs font-medium min-w-[52px] px-3 ${
                  selectedMonth === month && year === selectedYear 
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-transparent hover:bg-muted'
                }`}
                style={
                  selectedMonth === month && year === selectedYear 
                    ? { backgroundColor: '#2d4b5e' } 
                    : {}
                }
              >
                {MONTHS[month - 1]}
              </Button>
            ))}
          </div>
        </div>

        {/* Row 2: Period Pills (Quarters, QTD, YTD) */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Period
          </span>
          <div className="flex flex-wrap gap-2">
            {availableQuarters.map((quarter) => (
              <Button
                key={`q${quarter}`}
                variant={periodType === 'quarter' && selectedMonth === (quarter - 1) * 3 + 1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuarterSelect(quarter)}
                className={`text-xs font-medium min-w-[52px] px-3 ${
                  periodType === 'quarter' && selectedMonth === (quarter - 1) * 3 + 1
                    ? 'bg-primary text-primary-foreground border-primary' 
                    : 'bg-transparent hover:bg-muted'
                }`}
                style={
                  periodType === 'quarter' && selectedMonth === (quarter - 1) * 3 + 1
                    ? { backgroundColor: '#2d4b5e' } 
                    : {}
                }
              >
                Q{quarter}
              </Button>
            ))}
            <Button
              variant={periodType === 'qtd' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodType('qtd')}
              className={`text-xs font-medium min-w-[52px] px-3 ${
                periodType === 'qtd'
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-transparent hover:bg-muted'
              }`}
              style={periodType === 'qtd' ? { backgroundColor: '#2d4b5e' } : {}}
            >
              QTD
            </Button>
            <Button
              variant={periodType === 'ytd' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setPeriodType('ytd')}
              className={`text-xs font-medium min-w-[52px] px-3 ${
                periodType === 'ytd'
                  ? 'bg-primary text-primary-foreground border-primary' 
                  : 'bg-transparent hover:bg-muted'
              }`}
              style={periodType === 'ytd' ? { backgroundColor: '#2d4b5e' } : {}}
            >
              YTD
            </Button>
          </div>
        </div>

        {/* QTD Indicator */}
        {periodType === 'qtd' && (
          <div className="flex gap-2 items-center pt-1">
            <span className="text-xs font-medium text-muted-foreground">QTD includes:</span>
            <div className="flex gap-1">
              {availableMonths
                .filter(({ month }) => month <= ((Math.ceil(selectedMonth / 3) - 1) * 3 + 1) && month <= selectedMonth)
                .map(({ month }) => (
                  <span key={month} className="text-xs font-medium px-2 py-0.5 bg-muted rounded">
                    {MONTHS[month - 1]}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* YTD Indicator */}
        {periodType === 'ytd' && (
          <div className="flex gap-2 items-center pt-1">
            <span className="text-xs font-medium text-muted-foreground">YTD includes:</span>
            <div className="flex gap-1 flex-wrap">
              {availableMonths
                .filter(({ year }) => year === selectedYear)
                .map(({ month }) => (
                  <span key={month} className="text-xs font-medium px-2 py-0.5 bg-muted rounded">
                    {MONTHS[month - 1]}
                  </span>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}