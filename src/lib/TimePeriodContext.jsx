import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { MONTHS, getQuarterFromMonth, getQuarterMonths } from './aggregation';
import { base44 } from '@/api/base44Client';

const TimePeriodContext = createContext(null);

// App started in January 2026 - never show periods before this
const APP_START_YEAR = 2026;
const APP_START_MONTH = 1;

// Get current date dynamically
const now = new Date();
const CURRENT_YEAR = now.getFullYear();
const CURRENT_MONTH = now.getMonth() + 1; // 1-12

// Calculate last closed month (on or after 18th of following month)
const LAST_CLOSED_MONTH = now.getDate() >= 18 ? now.getMonth() : now.getMonth() - 1;

export function TimePeriodProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [periodType, setPeriodType] = useState('month');
  const [availableDataMonths, setAvailableDataMonths] = useState([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch available ScoreEntry data on mount
  useEffect(() => {
    const fetchAvailableData = async () => {
      try {
        const entries = await base44.entities.ScoreEntry.list();
        const uniqueMonths = new Set();
        entries.forEach(entry => {
          if (entry.year >= APP_START_YEAR) {
            uniqueMonths.add(`${entry.year}-${String(entry.month).padStart(2, '0')}`);
          }
        });
        const sortedMonths = Array.from(uniqueMonths).sort();
        setAvailableDataMonths(sortedMonths);
        
        // Set default to most recent month with data
        if (sortedMonths.length > 0) {
          const mostRecent = sortedMonths[sortedMonths.length - 1];
          const [year, month] = mostRecent.split('-').map(Number);
          setSelectedMonth(month);
          setSelectedYear(year);
        } else {
          // No data yet - default to last closed month
          setSelectedMonth(LAST_CLOSED_MONTH + 1);
        }
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to fetch available data:', error);
        // Fallback to last closed month
        setSelectedMonth(LAST_CLOSED_MONTH + 1);
        setIsInitialized(true);
      }
    };
    
    fetchAvailableData();
  }, []);

  // Generate available months from app start to current month
  const availableMonths = useMemo(() => {
    const months = [];
    let year = APP_START_YEAR;
    let month = APP_START_MONTH;
    
    // Only include months up to the current month of the current year
    while (year < CURRENT_YEAR || (year === CURRENT_YEAR && month <= CURRENT_MONTH)) {
      // Skip months before app start
      if (year === APP_START_YEAR && month < APP_START_MONTH) {
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
        continue;
      }
      
      months.push({ month, year });
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
    }
    
    return months;
  }, []);

  // Generate available quarters based on current date
  const availableQuarters = useMemo(() => {
    const quarters = [];
    const currentQuarter = getQuarterFromMonth(CURRENT_MONTH);
    
    // Check each quarter to see if at least one month has passed since app start
    for (let q = 1; q <= currentQuarter; q++) {
      const quarterMonths = getQuarterMonths(q);
      const hasPassedMonths = quarterMonths.some(m => {
        // For 2026, check if month is >= Jan (app start)
        if (CURRENT_YEAR === APP_START_YEAR && m < APP_START_MONTH) {
          return false;
        }
        // Check if month has passed (is <= current month)
        return m <= CURRENT_MONTH;
      });
      
      if (hasPassedMonths) {
        quarters.push(q);
      }
    }
    
    return quarters;
  }, []);

  // Get quarter months for selected month
  const currentQuarter = getQuarterFromMonth(selectedMonth || CURRENT_MONTH);
  const quarterMonths = getQuarterMonths(currentQuarter);
  
  // Get QTD months (from quarter start to selected month)
  const qtdMonths = useMemo(() => {
    const quarterStart = (currentQuarter - 1) * 3 + 1;
    return Array.from(
      { length: (selectedMonth || CURRENT_MONTH) - quarterStart + 1 },
      (_, i) => quarterStart + i
    ).filter(m => m <= CURRENT_MONTH);
  }, [currentQuarter, selectedMonth]);
  
  // Get YTD months (from Jan selectedYear through selectedMonth)
  const ytdMonths = useMemo(() => {
    // For YTD, we want months from Jan of selectedYear to selectedMonth
    // Since YTD is within a single year, just return 1 through selectedMonth
    return Array.from({ length: selectedMonth || CURRENT_MONTH }, (_, i) => i + 1);
  }, [selectedMonth]);

  const getPeriodLabel = () => {
    if (!selectedMonth) return '';
    const monthName = MONTHS[selectedMonth - 1];
    switch (periodType) {
      case 'month':
        return `${monthName} ${selectedYear}`;
      case 'quarter':
        return `Q${currentQuarter} ${selectedYear}`;
      case 'qtd':
        return `Q${currentQuarter} TD ${selectedYear}`;
      case 'ytd':
        return `YTD ${selectedYear}`;
      default:
        return monthName;
    }
  };

  const getPeriodMonths = () => {
    switch (periodType) {
      case 'month':
        return [selectedMonth];
      case 'quarter':
        return quarterMonths;
      case 'qtd':
        return qtdMonths;
      case 'ytd':
        return ytdMonths;
      default:
        return [selectedMonth];
    }
  };

  const value = {
    selectedMonth,
    setSelectedMonth,
    selectedYear,
    setSelectedYear,
    periodType,
    setPeriodType,
    availableMonths,
    availableQuarters,
    currentQuarter,
    quarterMonths,
    qtdMonths,
    ytdMonths,
    getPeriodLabel,
    getPeriodMonths,
    LAST_CLOSED_MONTH,
    CURRENT_YEAR,
    isInitialized,
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <TimePeriodContext.Provider value={value}>
      {children}
    </TimePeriodContext.Provider>
  );
}

export function useTimePeriod() {
  const context = useContext(TimePeriodContext);
  if (!context) {
    throw new Error('useTimePeriod must be used within a TimePeriodProvider');
  }
  return context;
}