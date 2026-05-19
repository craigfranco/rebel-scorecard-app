import React, { createContext, useContext, useState, useEffect } from 'react';
import { MONTHS, getQuarterFromMonth, getQuarterMonths } from './aggregation';

const TimePeriodContext = createContext(null);

const today = new Date();
const CURRENT_YEAR = today.getFullYear();
// Month is "closed" only on or after the 18th of the following month
const LAST_CLOSED_MONTH = today.getDate() >= 18 ? today.getMonth() : today.getMonth() - 1;

export function TimePeriodProvider({ children }) {
  const [selectedMonth, setSelectedMonth] = useState(LAST_CLOSED_MONTH + 1); // 1-indexed
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [periodType, setPeriodType] = useState('month'); // 'month', 'quarter', 'qtd', 'ytd'

  // Get available months based on current date
  const availableMonths = MONTHS.slice(0, LAST_CLOSED_MONTH + 1);
  
  // Get current quarter based on selected month
  const currentQuarter = getQuarterFromMonth(selectedMonth);
  const quarterMonths = getQuarterMonths(currentQuarter);
  
  // Get QTD months (from quarter start to selected month)
  const qtdMonths = quarterMonths.filter(m => m <= selectedMonth);
  
  // Get YTD months (from January to selected month)
  const ytdMonths = Array.from({ length: selectedMonth }, (_, i) => i + 1);

  const getPeriodLabel = () => {
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
    currentQuarter,
    quarterMonths,
    qtdMonths,
    ytdMonths,
    getPeriodLabel,
    getPeriodMonths,
    LAST_CLOSED_MONTH,
    CURRENT_YEAR,
  };

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