import React from 'react';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { Button } from '@/components/ui/button';
import { MONTHS } from '@/lib/aggregation';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function TimePeriodSelector() {
  const { 
    selectedMonth, 
    setSelectedMonth, 
    selectedYear, 
    setSelectedYear,
    periodType, 
    setPeriodType,
    availableMonths,
    availableQuarters,
    CURRENT_YEAR,
    APP_START_YEAR,
    APP_START_MONTH
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

  // Check if at minimum date (January 2026)
  const isAtMinimumDate = selectedYear === APP_START_YEAR && selectedMonth === APP_START_MONTH;
  
  // Check if at maximum date (current month/year)
  const isAtMaximumDate = selectedYear === CURRENT_YEAR && selectedMonth === new Date().getMonth() + 1;

  // Navigate to previous month
  const handlePrevious = () => {
    if (isAtMinimumDate) return;
    
    let newMonth = selectedMonth - 1;
    let newYear = selectedYear;
    
    if (newMonth < 1) {
      newMonth = 12;
      newYear = selectedYear - 1;
    }
    
    // Don't go before January 2026
    if (newYear < APP_START_YEAR || (newYear === APP_START_YEAR && newMonth < APP_START_MONTH)) {
      return;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  // Navigate to next month
  const handleNext = () => {
    if (isAtMaximumDate) return;
    
    let newMonth = selectedMonth + 1;
    let newYear = selectedYear;
    
    if (newMonth > 12) {
      newMonth = 1;
      newYear = selectedYear + 1;
    }
    
    // Don't go beyond current month
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();
    
    if (newYear > currentYear || (newYear === currentYear && newMonth > currentMonth)) {
      return;
    }
    
    setSelectedMonth(newMonth);
    setSelectedYear(newYear);
  };

  return (
    <div className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 space-y-3">
        {/* Row 1: Month Navigation + Pills */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Month
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handlePrevious}
                disabled={isAtMinimumDate}
                className={`h-7 w-7 ${isAtMinimumDate ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleNext}
                disabled={isAtMaximumDate}
                className={`h-7 w-7 ${isAtMaximumDate ? 'opacity-30 cursor-not-allowed' : ''}`}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
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