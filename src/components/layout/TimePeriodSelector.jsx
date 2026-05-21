import React from 'react';
import { useTimePeriod } from '@/lib/TimePeriodContext';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function TimePeriodSelector() {
  const {
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    periodType,
    setPeriodType,
    availableYears,
    CURRENT_YEAR,
    CURRENT_MONTH,
  } = useTimePeriod();

  // A month is "future" if it hasn't started yet this year (or is beyond current month)
  const isMonthFuture = (month) => {
    if (selectedYear < CURRENT_YEAR) return false;
    if (selectedYear > CURRENT_YEAR) return true;
    return month > CURRENT_MONTH;
  };

  // A quarter is "future" if all its months are in the future
  const isQuarterFuture = (q) => {
    const firstMonth = (q - 1) * 3 + 1;
    return isMonthFuture(firstMonth);
  };

  const handleYearChange = (year) => {
    const y = parseInt(year, 10);
    setSelectedYear(y);
    // If selected month is now future for the new year, clamp it
    if (y === CURRENT_YEAR && selectedMonth > CURRENT_MONTH) {
      setSelectedMonth(CURRENT_MONTH);
    }
  };

  const handleMonthClick = (month) => {
    if (isMonthFuture(month)) return;
    setSelectedMonth(month);
    setPeriodType('month');
  };

  const handleQuarterClick = (q) => {
    if (isQuarterFuture(q)) return;
    // Set selectedMonth to the last month of the quarter (or CURRENT_MONTH if Q is in progress)
    const lastMonthOfQ = q * 3;
    const clampedMonth = selectedYear === CURRENT_YEAR
      ? Math.min(lastMonthOfQ, CURRENT_MONTH)
      : lastMonthOfQ;
    setSelectedMonth(clampedMonth);
    setPeriodType('quarter');
  };

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-2.5">
        <div className="flex flex-wrap items-center gap-3">

          {/* Year Dropdown */}
          <select
            value={selectedYear}
            onChange={e => handleYearChange(e.target.value)}
            className="h-8 pl-3 pr-7 text-sm font-semibold bg-white border border-gray-200 rounded-lg shadow-sm text-gray-800 cursor-pointer hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors appearance-none"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%236b7280' stroke-width='2'%3E%3Cpath d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 6px center' }}
          >
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          {/* Monthly / Quarterly toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setPeriodType('month')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodType === 'month'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setPeriodType('quarter')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodType === 'quarter'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Quarterly
            </button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200" />

          {/* Month buttons (Monthly view) */}
          {periodType === 'month' && (
            <div className="flex items-center gap-1 flex-wrap">
              {MONTH_LABELS.map((label, i) => {
                const month = i + 1;
                const future = isMonthFuture(month);
                const active = selectedMonth === month;
                return (
                  <button
                    key={month}
                    onClick={() => handleMonthClick(month)}
                    disabled={future}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : future
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Quarter buttons (Quarterly view) */}
          {periodType === 'quarter' && (
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map(q => {
                const future = isQuarterFuture(q);
                // Active quarter = the quarter that contains selectedMonth
                const qOfSelected = selectedMonth ? Math.ceil(selectedMonth / 3) : 0;
                const active = qOfSelected === q;
                return (
                  <button
                    key={q}
                    onClick={() => handleQuarterClick(q)}
                    disabled={future}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : future
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    Q{q}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}