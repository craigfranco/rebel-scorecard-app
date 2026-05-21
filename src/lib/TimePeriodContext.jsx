import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
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
  // Set of "YYYY-M" strings for months that have at least one ScoreEntry record
  const [loadedMonthKeys, setLoadedMonthKeys] = useState(new Set());

  // Returns true if the given month+year has loaded data
  const hasData = (year, month) => loadedMonthKeys.has(`${year}-${month}`);

  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const entries = await base44.entities.ScoreEntry.list('year', 500);

        // Build set of loaded month keys
        const keys = new Set();
        const years = new Set([APP_START_YEAR]);
        entries.forEach(e => {
          if (e.year && e.month) {
            keys.add(`${e.year}-${e.month}`);
          }
          if (e.year >= APP_START_YEAR) years.add(e.year);
        });
        setLoadedMonthKeys(keys);

        const sortedYears = Array.from(years).sort((a, b) => a - b);
        setAvailableYears(sortedYears);

        // Default to most recent month that has data loaded AND is not in the future
        const validEntries = entries
          .filter(e => e.year >= APP_START_YEAR && e.year && e.month)
          .filter(e => e.year < CURRENT_YEAR || (e.year === CURRENT_YEAR && e.month <= CURRENT_MONTH))
          .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));

        if (validEntries.length > 0) {
          setSelectedYear(validEntries[0].year);
          setSelectedMonth(validEntries[0].month);
        } else {
          setSelectedYear(CURRENT_YEAR);
          setSelectedMonth(CURRENT_MONTH > 1 ? CURRENT_MONTH - 1 : 1);
        }
        setIsInitialized(true);
      } catch {
        setSelectedMonth(CURRENT_MONTH > 1 ? CURRENT_MONTH - 1 : 1);
        setSelectedYear(CURRENT_YEAR);
        setIsInitialized(true);
      }
    };
    fetchAvailableData();
  }, []);

  const currentQuarter = getQuarterFromMonth(selectedMonth || CURRENT_MONTH);

  // Loaded months for the selected year (sorted ascending)
  const loadedMonthsForYear = useMemo(() => {
    const months = [];
    for (let m = 1; m <= 12; m++) {
      if (loadedMonthKeys.has(`${selectedYear}-${m}`)) months.push(m);
    }
    return months;
  }, [loadedMonthKeys, selectedYear]);

  // Last loaded month for selected year (drives ytdEndMonth)
  const ytdEndMonth = loadedMonthsForYear.length > 0
    ? loadedMonthsForYear[loadedMonthsForYear.length - 1]
    : 0;

  // Loaded months within a given quarter for the selected year
  const getQuarterLoadedMonths = (q) => {
    const qMonths = [q * 3 - 2, q * 3 - 1, q * 3];
    return qMonths.filter(m => hasData(selectedYear, m));
  };

  // Quarter state driven by data presence, not calendar
  const getQuarterState = (q) => {
    const loaded = getQuarterLoadedMonths(q);
    if (loaded.length === 0) return 'future'; // no data → grayed out
    const allThreeLoaded = loaded.length === 3;
    return allThreeLoaded ? 'complete' : 'inprogress';
  };

  // Months included in current quarter selection (only loaded ones)
  const quarterMonths = getQuarterLoadedMonths(currentQuarter);

  const getPeriodLabel = () => {
    if (!selectedMonth) return '';
    if (periodType === 'month') return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
    if (periodType === 'quarter') {
      const q = getQuarterFromMonth(selectedMonth);
      const loaded = getQuarterLoadedMonths(q);
      const isComplete = loaded.length === 3;
      return isComplete ? `Q${q} ${selectedYear}` : `Q${q}TD ${selectedYear}`;
    }
    if (periodType === 'ytd') {
      if (ytdEndMonth === 0) return `YTD ${selectedYear}`;
      return `YTD Jan–${MONTHS[ytdEndMonth - 1]} ${selectedYear}`;
    }
    return `${MONTHS[selectedMonth - 1]} ${selectedYear}`;
  };

  const getPeriodMonths = () => {
    if (periodType === 'quarter') return quarterMonths;
    if (periodType === 'ytd') return loadedMonthsForYear;
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
    loadedMonthsForYear,
    loadedMonthKeys,
    hasData,
    getQuarterLoadedMonths,
    getQuarterState,
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