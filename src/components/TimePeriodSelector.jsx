import React from 'react';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MONTHS, getQuarterFromMonth } from '@/lib/aggregation';

export default function TimePeriodSelector() {
  const { 
    selectedMonth, 
    setSelectedMonth, 
    selectedYear, 
    setSelectedYear,
    periodType, 
    setPeriodType,
    availableMonths,
    LAST_CLOSED_MONTH,
    CURRENT_YEAR
  } = useTimePeriod();

  const currentQuarter = getQuarterFromMonth(selectedMonth);

  // Build dynamic options based on current quarter
  const getQuarterOptions = () => {
    const options = [];
    
    // Add individual months for current quarter
    const quarterStart = (currentQuarter - 1) * 3;
    for (let i = 0; i < 3; i++) {
      const monthIndex = quarterStart + i;
      if (monthIndex <= LAST_CLOSED_MONTH) {
        options.push(
          <SelectItem key={`month-${monthIndex + 1}`} value={`month-${monthIndex + 1}`}>
            {MONTHS[monthIndex]}
          </SelectItem>
        );
      }
    }
    
    // Add QTD if we're not in the first month of the quarter
    if (selectedMonth > quarterStart + 1) {
      options.push(
        <SelectItem key="qtd" value="qtd">
          Q{currentQuarter}TD
        </SelectItem>
      );
    }
    
    // Add full quarter option if all 3 months are available
    if (quarterStart + 2 <= LAST_CLOSED_MONTH) {
      options.push(
        <SelectItem key="quarter" value="quarter">
          Q{currentQuarter}
        </SelectItem>
      );
    }
    
    return options;
  };

  // Add YTD option if we're past January
  const showYTD = selectedMonth > 1;

  return (
    <div className="sticky top-0 z-50 bg-background border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3">
        <div className="flex items-center justify-between gap-4">
          {/* Period Type Tabs */}
          <Tabs value={periodType} onValueChange={setPeriodType} className="w-full">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="month">Month</TabsTrigger>
              <TabsTrigger value="quarter">Quarter</TabsTrigger>
              <TabsTrigger value="qtd">QTD</TabsTrigger>
              <TabsTrigger value="ytd">YTD</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Month/Quarter Selector */}
          <div className="flex items-center gap-2">
            <Select 
              value={`${periodType}-${selectedMonth}`} 
              onValueChange={(value) => {
                if (value.startsWith('month-')) {
                  setPeriodType('month');
                  setSelectedMonth(Number(value.split('-')[1]));
                } else if (value === 'quarter') {
                  setPeriodType('quarter');
                } else if (value === 'qtd') {
                  setPeriodType('qtd');
                } else if (value === 'ytd') {
                  setPeriodType('ytd');
                }
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getQuarterOptions()}
                {showYTD && (
                  <SelectItem value="ytd">YTD</SelectItem>
                )}
              </SelectContent>
            </Select>

            {/* Year Selector */}
            <Select 
              value={String(selectedYear)} 
              onValueChange={(year) => setSelectedYear(Number(year))}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={String(CURRENT_YEAR)}>{CURRENT_YEAR}</SelectItem>
                <SelectItem value={String(CURRENT_YEAR - 1)}>{CURRENT_YEAR - 1}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}