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
  const [periodType, setPeriodType] = useState('quarter');
  const [availableYears, setAvailableYears] = useState([CURRENT_YEAR]);
  const [isInitialized, setIsInitialized] = useState(false);
  // Set of "YYYY-M" strings for months that have at least one ScoreEntry record
  const [loadedMonthKeys, setLoadedMonthKeys] = useState(new Set());

  // Returns true if the given month+year has loaded data
  const hasData = (year, month) => loadedMonthKeys.has(`${year}-${month}`);

  const refreshAvailableData = async () => {
    try {
      const entries = await base44.entities.ScoreEntry.filter({}, '-year', 2000);
      const keys = new Set();
      const years = new Set([APP_START_YEAR]);
      entries.forEach(e => {
        if (e.year && e.month) {
          keys.add(`${e.year}-${e.month}`);
          if (e.year >= APP_START_YEAR) years.add(e.year);
        }
      });
      setLoadedMonthKeys(keys);
      const sortedYears = Array.from(years).sort((a, b) => a - b);
      setAvailableYears(sortedYears);
    } catch {}
  };

  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        // Query ALL ScoreEntry records with no filter — we just need distinct month+year pairs
        const entries = await base44.entities.ScoreEntry.filter({}, '-year', 2000);

        // Build set of loaded month keys from raw data — no property or active filter
        const keys = new Set();
        const years = new Set([APP_START_YEAR]);
        entries.forEach(e => {
          if (e.year && e.month) {
            keys.add(`${e.year}-${e.month}`);
            if (e.year >= APP_START_YEAR) years.add(e.year);
          }
        });
        setLoadedMonthKeys(keys);

        const sortedYears = Array.from(years).sort((a, b) => a - b);
        setAvailableYears(sortedYears);

        // Default to most recent month+year that has any ScoreEntry data
        const distinctMonths = Array.from(keys)
          .map(k => { const [y, m] = k.split('-').map(Number); return { year: y, month: m }; })
          .sort((a, b) => (b.year * 100 + b.month) - (a.year * 100 + a.month));

        if (distinctMonths.length > 0) {
          // Default to the last month of the most recent complete quarter that has data
          // A complete quarter has all 3 months loaded
          let defaultYear = distinctMonths[0].year;
          let defaultMonth = distinctMonths[0].month;

          // Try to find the most recent complete quarter
          const yearsDesc = Array.from(new Set(distinctMonths.map(d => d.year))).sort((a, b) => b - a);
          outerLoop: for (const yr of yearsDesc) {
            for (let q = 4; q >= 1; q--) {
              const qMonths = [q * 3 - 2, q * 3 - 1, q * 3];
              if (qMonths.every(m => keys.has(`${yr}-${m}`))) {
                defaultYear = yr;
                defaultMonth = q * 3; // last month of the complete quarter
                break outerLoop;
              }
            }
          }
          // If no complete quarter found, fall back to most recent loaded month
          setSelectedYear(defaultYear);
          setSelectedMonth(defaultMonth);
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
    refreshAvailableData,
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