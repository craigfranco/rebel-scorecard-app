import React from 'react';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { MONTHS, getQuarterFromMonth } from '@/lib/aggregation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TimePeriodSelector() {
  const {
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    periodType,
    setPeriodType,
    getPeriodLabel,
    LAST_CLOSED_MONTH,
    CURRENT_YEAR,
  } = useTimePeriod();

  const currentQuarter = getQuarterFromMonth(selectedMonth);

  // Get available months based on current quarter context
  const getAvailableMonths = () => {
    const quarterStart = (currentQuarter - 1) * 3 + 1;
    const quarterMonths = [quarterStart, quarterStart + 1, quarterStart + 2];
    return quarterMonths.filter(m => m <= LAST_CLOSED_MONTH);
  };

  const handlePrevious = () => {
    if (periodType === 'month') {
      if (selectedMonth > 1) {
        setSelectedMonth(selectedMonth - 1);
      } else {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      }
    } else if (periodType === 'quarter') {
      if (currentQuarter > 1) {
        const prevQuarterStart = (currentQuarter - 2) * 3 + 1;
        setSelectedMonth(Math.min(prevQuarterStart + 1, LAST_CLOSED_MONTH));
      } else {
        setSelectedYear(selectedYear - 1);
        setSelectedMonth(10); // Q4 of previous year
      }
    } else if (periodType === 'qtd') {
      if (selectedMonth > 1) {
        setSelectedMonth(selectedMonth - 1);
      } else {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      }
    } else {
      // YTD - just change year
      setSelectedYear(selectedYear - 1);
    }
  };

  const handleNext = () => {
    if (periodType === 'month') {
      if (selectedMonth < LAST_CLOSED_MONTH) {
        setSelectedMonth(selectedMonth + 1);
      }
    } else if (periodType === 'quarter') {
      const nextQuarterStart = currentQuarter * 3 + 1;
      if (nextQuarterStart <= LAST_CLOSED_MONTH) {
        setSelectedMonth(Math.min(nextQuarterStart + 1, LAST_CLOSED_MONTH));
      }
    } else if (periodType === 'qtd') {
      if (selectedMonth < LAST_CLOSED_MONTH) {
        setSelectedMonth(selectedMonth + 1);
      }
    } else {
      // YTD
      if (selectedYear < CURRENT_YEAR) {
        setSelectedYear(selectedYear + 1);
      }
    }
  };

  const availableMonths = getAvailableMonths();

  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Navigation arrows */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrevious}
              className="h-8 w-8"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleNext}
              className="h-8 w-8"
              disabled={selectedMonth >= LAST_CLOSED_MONTH && periodType !== 'ytd'}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          {/* Period type pills */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {/* Month pills */}
            {availableMonths.map((month) => (
              <button
                key={month}
                onClick={() => {
                  setSelectedMonth(month);
                  setPeriodType('month');
                }}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  periodType === 'month' && selectedMonth === month
                    ? 'bg-white text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {MONTHS[month - 1].slice(0, 3)}
              </button>
            ))}

            {/* Quarter pill */}
            <button
              onClick={() => setPeriodType('quarter')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                periodType === 'quarter'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Q{currentQuarter}
            </button>

            {/* QTD pill */}
            <button
              onClick={() => setPeriodType('qtd')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                periodType === 'qtd'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              QTD
            </button>

            {/* YTD pill */}
            <button
              onClick={() => setPeriodType('ytd')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                periodType === 'ytd'
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              YTD
            </button>
          </div>

          {/* Period label */}
          <div className="text-sm font-semibold text-foreground min-w-[120px] text-center">
            {getPeriodLabel()}
          </div>
        </div>
      </div>
    </div>
  );
}