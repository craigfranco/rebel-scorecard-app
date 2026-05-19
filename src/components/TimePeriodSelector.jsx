import React from 'react';
import { useTimePeriod } from '@/lib/TimePeriodContext';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
    // Set to first month of the quarter
    const firstMonth = (quarter - 1) * 3 + 1;
    setSelectedMonth(firstMonth);
    setPeriodType('quarter');
  };

  return (
    <div className="sticky top-0 z-50 bg-card border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-3 space-y-3">
        {/* Header with year */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {CURRENT_YEAR}
          </span>
          <Tabs value={periodType} onValueChange={setPeriodType} className="w-auto">
            <TabsList className="bg-muted/50 h-8">
              <TabsTrigger value="month" className="text-xs h-6">Month</TabsTrigger>
              <TabsTrigger value="quarter" className="text-xs h-6">Quarter</TabsTrigger>
              <TabsTrigger value="qtd" className="text-xs h-6">QTD</TabsTrigger>
              <TabsTrigger value="ytd" className="text-xs h-6">YTD</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Month Pills - scrollable horizontally */}
        {periodType === 'month' && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent">
            {availableMonths.map(({ month, year }) => (
              <Button
                key={`${year}-${month}`}
                variant={selectedMonth === month && year === selectedYear ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleMonthSelect(month)}
                className={`flex-shrink-0 text-xs font-medium min-w-[60px] ${
                  selectedMonth === month && year === selectedYear 
                    ? 'bg-primary text-primary-foreground' 
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
        )}

        {/* Quarter Pills + QTD/YTD */}
        {periodType === 'quarter' && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {availableQuarters.map((quarter) => (
              <Button
                key={`q${quarter}`}
                variant={periodType === 'quarter' && selectedMonth === (quarter - 1) * 3 + 1 ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleQuarterSelect(quarter)}
                className={`flex-shrink-0 text-xs font-medium min-w-[60px] ${
                  periodType === 'quarter' && selectedMonth === (quarter - 1) * 3 + 1
                    ? 'bg-primary text-primary-foreground' 
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
              className={`flex-shrink-0 text-xs font-medium min-w-[60px] ${
                periodType === 'qtd'
                  ? 'bg-primary text-primary-foreground' 
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
              className={`flex-shrink-0 text-xs font-medium min-w-[60px] ${
                periodType === 'ytd'
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-transparent hover:bg-muted'
              }`}
              style={periodType === 'ytd' ? { backgroundColor: '#2d4b5e' } : {}}
            >
              YTD
            </Button>
          </div>
        )}

        {/* QTD View */}
        {periodType === 'qtd' && (
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">QTD:</span>
            <div className="flex gap-1">
              {availableMonths
                .filter(({ month }) => month <= ((Math.ceil(selectedMonth / 3) - 1) * 3 + 1) && month <= selectedMonth)
                .map(({ month }) => (
                  <span key={month} className="text-xs font-medium px-2 py-1 bg-muted rounded">
                    {MONTHS[month - 1]}
                  </span>
                ))}
            </div>
          </div>
        )}

        {/* YTD View */}
        {periodType === 'ytd' && (
          <div className="flex gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground">YTD:</span>
            <div className="flex gap-1 flex-wrap">
              {availableMonths
                .filter(({ year }) => year === selectedYear)
                .map(({ month }) => (
                  <span key={month} className="text-xs font-medium px-2 py-1 bg-muted rounded">
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