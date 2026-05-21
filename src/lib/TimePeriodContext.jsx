import React, { createContext, useContext, useState, useEffect } from 'react';
import { MONTHS, getQuarterFromMonth, getQuarterMonths } from './aggregation';
import { base44 } from '@/api/base44Client';

const TimePeriodContext = createContext(null);

const APP_START_YEAR = 2026;
const APP_START_MONTH = 1;

const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1; // 1-12

export function TimePeriodProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  // 'month', 'quarter', or 'ytd'
  const [periodType, setPeriodType] = useState('month');
  const [availableYears, setAvailableYears] = useState([CURRENT_YEAR]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch available years from ScoreEntry data
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const entries = await base44.entities.ScoreEntry.list();
        const years = new Set([APP_START_YEAR]);
        entries.forEach(e => {
          if (e.year >= APP_START_YEAR) years.add(e.year);
        });
        const sortedYears = Array.from(years).sort((a, b) => a - b);
        setAvailableYears(sortedYears);

        // Default to most recent month with data, clamped to current month
        const validEntries = entries
          .filter(e => e.year >= APP_START_YEAR)
          .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));

        if (validEntries.length > 0) {
          const best = validEntries.find(e =>
            e.year < CURRENT_YEAR || (e.year === CURRENT_YEAR && e.month <= CURRENT_MONTH)
          );
          if (best) {
            setSelectedYear(best.year);
            setSelectedMonth(best.month);
          } else {
            setSelectedYear(APP_START_YEAR);
            setSelectedMonth(APP_START_MONTH);
          }
        } else {
          // No data - default to last completed month
          const defaultMonth = CURRENT_MONTH > 1 ? CURRENT_MONTH - 1 : 1;
          setSelectedMonth(defaultMonth);
          setSelectedYear(CURRENT_YEAR);
        }
        setIsInitialized(true);
      } catch {
        const defaultMonth = CURRENT_MONTH > 1 ? CURRENT_MONTH - 1 : 1;
        setSelectedMonth(defaultMonth);
        setSelectedYear(CURRENT_YEAR);
        setIsInitialized(true);
      }
    };
    fetchAvailableData();
  }, []);

  const currentQuarter = getQuarterFromMonth(selectedMonth || CURRENT_MONTH);
  const quarterMonths = getQuarterMonths(currentQuarter);

  // Last fully completed month (current month - 1, or 12 if Jan)
  const lastCompletedMonth = CURRENT_MONTH > 1 ? CURRENT_MONTH - 1 : 12;
  // YTD end month: for current year = last completed month; for past years = 12
  const ytdEndMonth = selectedYear < CURRENT_YEAR ? 12 : lastCompletedMonth;

  const getPeriodLabel = () => {
    if (!selectedMonth) return '';
    if (periodType === 'month') return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
    if (periodType === 'quarter') {
      const q = getQuarterFromMonth(selectedMonth);
      const lastMonthOfQ = q * 3;
      const isComplete = selectedYear < CURRENT_YEAR || lastMonthOfQ < CURRENT_MONTH;
      return isComplete ? `Q${q} ${selectedYear}` : `Q${q}TD ${selectedYear}`;
    }
    if (periodType === 'ytd') {
      return `YTD Jan–${MONTHS[ytdEndMonth - 1]} ${selectedYear}`;
    }
    return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
  };

  const getPeriodMonths = () => {
    if (periodType === 'quarter') return quarterMonths;
    if (periodType === 'ytd') {
      // All months from Jan through ytdEndMonth
      return Array.from({ length: ytdEndMonth }, (_, i) => i + 1);
    }
    return [selectedMonth];
  };

  const value = {
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    periodType,
    setPeriodType,
    availableYears,
    currentQuarter,
    quarterMonths,
    getPeriodLabel,
    getPeriodMonths,
    CURRENT_YEAR,
    CURRENT_MONTH,
    APP_START_YEAR,
    APP_START_MONTH,
    isInitialized,
    ytdEndMonth,
    lastCompletedMonth,
    // legacy compat
    LAST_CLOSED_MONTH: CURRENT_MONTH,
  };

  if (!isInitialized) return null;

  return (
    <TimePeriodContext.Provider value={value}>
      {children}
    </TimePeriodContext.Provider>
  );
}

export function useTimePeriod() {
  const context = useContext(TimePeriodContext);
  if (!context) throw new Error('useTimePeriod must be used within a TimePeriodProvider');
  return context;
}