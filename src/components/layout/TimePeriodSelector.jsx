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
    ytdEndMonth,
    loadedMonthsForYear,
    hasData,
    getQuarterLoadedMonths,
    getQuarterState,
  } = useTimePeriod();

  const handleYearChange = (year) => {
    const y = parseInt(year, 10);
    setSelectedYear(y);
    // selectedMonth will be stale for the new year — reset to first loaded month of that year
    // (context will stay as-is; user can pick a month)
  };

  const handleMonthClick = (month) => {
    if (!hasData(selectedYear, month)) return;
    setSelectedMonth(month);
    setPeriodType('month');
  };

  const handleQuarterClick = (q) => {
    const state = getQuarterState(q);
    if (state === 'future') return; // no data, disabled
    const loaded = getQuarterLoadedMonths(q);
    // Set selectedMonth to last loaded month in that quarter
    setSelectedMonth(loaded[loaded.length - 1]);
    setPeriodType('quarter');
  };

  const handleYtdClick = () => {
    if (ytdEndMonth === 0) return; // no data at all
    setSelectedMonth(ytdEndMonth);
    setPeriodType('ytd');
  };

  const activeQuarter = selectedMonth ? Math.ceil(selectedMonth / 3) : 0;

  // YTD sub-label based on loaded months
  const ytdSubLabel = ytdEndMonth > 0
    ? `Jan – ${MONTH_LABELS[ytdEndMonth - 1]} ${selectedYear}`
    : 'No data';

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
              onClick={() => {
                const q = selectedMonth ? Math.ceil(selectedMonth / 3) : 1;
                if (getQuarterState(q) !== 'future') setPeriodType('quarter');
              }}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodType === 'quarter' || periodType === 'ytd'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Quarterly
            </button>
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-gray-200" />

          {/* Month buttons */}
          {periodType === 'month' && (
            <div className="flex items-center gap-1 flex-wrap">
              {MONTH_LABELS.map((label, i) => {
                const month = i + 1;
                const loaded = hasData(selectedYear, month);
                const active = selectedMonth === month;
                return (
                  <button
                    key={month}
                    onClick={() => handleMonthClick(month)}
                    disabled={!loaded}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      active
                        ? 'bg-primary text-white shadow-sm'
                        : !loaded
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

          {/* Quarter + YTD buttons */}
          {(periodType === 'quarter' || periodType === 'ytd') && (
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4].map(q => {
                const state = getQuarterState(q);
                const noData = state === 'future';
                const isActive = periodType === 'quarter' && activeQuarter === q;
                const label = state === 'inprogress' ? `Q${q}TD` : `Q${q}`;
                const loadedMonths = getQuarterLoadedMonths(q);
                const subLabel = loadedMonths.length > 0
                  ? loadedMonths.map(m => MONTH_LABELS[m - 1]).join(' · ')
                  : '—';

                return (
                  <button
                    key={q}
                    onClick={() => handleQuarterClick(q)}
                    disabled={noData}
                    className={`flex flex-col items-center px-3 py-1 rounded-lg transition-all min-w-[52px] ${
                      isActive
                        ? 'bg-primary text-white shadow-sm'
                        : noData
                        ? 'text-gray-300 cursor-not-allowed'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span className="text-xs font-semibold leading-tight">{label}</span>
                    <span className={`text-[9px] leading-tight mt-0.5 ${
                      isActive ? 'text-white/80' : noData ? 'text-gray-300' : 'text-gray-400'
                    }`}>
                      {subLabel}
                    </span>
                  </button>
                );
              })}

              {/* YTD button */}
              <button
                onClick={handleYtdClick}
                disabled={ytdEndMonth === 0}
                className={`flex flex-col items-center px-3 py-1 rounded-lg transition-all min-w-[52px] ${
                  periodType === 'ytd'
                    ? 'bg-primary text-white shadow-sm'
                    : ytdEndMonth === 0
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <span className="text-xs font-semibold leading-tight">YTD</span>
                <span className={`text-[9px] leading-tight mt-0.5 ${
                  periodType === 'ytd' ? 'text-white/80' : ytdEndMonth === 0 ? 'text-gray-300' : 'text-gray-400'
                }`}>
                  {ytdSubLabel}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}