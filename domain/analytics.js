/**
 * domain/analytics.js
 * Алгоритмы расчета пожизненной статистики, личных рекордов, стриков и динамики MoM.
 * Чистые функции без привязки к DOM.
 */

import { formatDateKey } from "./payroll.js";

/**
 * Преобразование даты YYYY-MM-DD в целое количество дней с начала эпохи Unix
 * @param {string} key
 * @returns {number}
 */
export function dateKeyToEpochDays(key) {
  const [y, m, d] = key.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

/**
 * Подсчет всеобщей аналитики, рекордов, стриков и структуры смен
 * @param {Record<string, any>} shifts
 * @returns {Object}
 */
export function calculateAllTimeAnalytics(shifts) {
  const keys = Object.keys(shifts).sort();

  if (keys.length === 0) {
    return {
      isEmpty: true,
      totalIncome: 0,
      totalHours: 0,
      totalShifts: 0,
      avgMonthlyIncome: 0,
      dayShiftsCount: 0,
      nightShiftsCount: 0,
      extraShiftsCount: 0,
      dayPct: 0,
      nightPct: 0,
      extraPct: 0,
      bestMonth: null,
      bestShift: null,
      longestShift: null,
      maxStreak: 0,
      currentStreak: { status: "none", days: 0 },
    };
  }

  let totalIncome = 0;
  let totalHours = 0;
  const totalShifts = keys.length;

  let dayShiftsCount = 0;
  let nightShiftsCount = 0;
  let extraShiftsCount = 0;

  const monthTotals = {};

  let bestShiftKey = null;
  let bestShiftPay = -1;

  let longestShiftKey = null;
  let longestShiftHours = -1;

  keys.forEach((key) => {
    const s = shifts[key];
    const pay = Number(s.totalPay) || 0;
    const hours = Number(s.hours) || 0;

    totalIncome += pay;
    totalHours += hours;

    if (s.type === "night") nightShiftsCount++;
    else if (s.type === "extra") extraShiftsCount++;
    else dayShiftsCount++;

    const mKey = key.slice(0, 7);
    if (!monthTotals[mKey]) {
      monthTotals[mKey] = { income: 0, shifts: 0 };
    }
    monthTotals[mKey].income += pay;
    monthTotals[mKey].shifts++;

    if (pay > bestShiftPay) {
      bestShiftPay = pay;
      bestShiftKey = key;
    }

    if (hours > longestShiftHours) {
      longestShiftHours = hours;
      longestShiftKey = key;
    }
  });

  const distinctMonths = Object.keys(monthTotals).length;
  const avgMonthlyIncome = Math.round(totalIncome / Math.max(1, distinctMonths));

  // Рекордный месяц
  let bestMKey = null;
  let maxMonthIncome = -1;
  Object.entries(monthTotals).forEach(([mKey, data]) => {
    if (data.income > maxMonthIncome) {
      maxMonthIncome = data.income;
      bestMKey = mKey;
    }
  });

  let bestMonth = null;
  if (bestMKey) {
    const [by, bm] = bestMKey.split("-").map(Number);
    bestMonth = { year: by, month: bm - 1, income: maxMonthIncome, key: bestMKey };
  }

  // Лучшая смена
  let bestShift = null;
  if (bestShiftKey) {
    const [sy, sm, sd] = bestShiftKey.split("-").map(Number);
    bestShift = { key: bestShiftKey, year: sy, month: sm - 1, day: sd, pay: bestShiftPay };
  }

  // Самая длинная смена
  let longestShift = null;
  if (longestShiftKey) {
    const [ly, lm, ld] = longestShiftKey.split("-").map(Number);
    longestShift = { key: longestShiftKey, year: ly, month: lm - 1, day: ld, hours: longestShiftHours };
  }

  // Подсчет максимального стрика
  const epochDays = keys.map(dateKeyToEpochDays).filter((val, idx, arr) => arr.indexOf(val) === idx);
  let maxStreak = 1;
  let currRun = 1;

  for (let i = 1; i < epochDays.length; i++) {
    if (epochDays[i] === epochDays[i - 1] + 1) {
      currRun++;
      if (currRun > maxStreak) maxStreak = currRun;
    } else {
      currRun = 1;
    }
  }

  // Подсчет текущего стрика
  const today = new Date();
  const todayEpoch = Math.round(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000);
  const epochSet = new Set(epochDays);

  let activeStreak = 0;
  let checkEpoch = todayEpoch;
  let currentStreak = { status: "none", days: 0 };

  if (epochSet.has(todayEpoch)) {
    while (epochSet.has(checkEpoch)) {
      activeStreak++;
      checkEpoch--;
    }
    currentStreak = { status: "today", days: activeStreak };
  } else if (epochSet.has(todayEpoch - 1)) {
    checkEpoch = todayEpoch - 1;
    while (epochSet.has(checkEpoch)) {
      activeStreak++;
      checkEpoch--;
    }
    currentStreak = { status: "yesterday", days: activeStreak };
  } else {
    const lastDay = epochDays[epochDays.length - 1];
    const restDays = Math.max(1, todayEpoch - lastDay);
    currentStreak = { status: "rest", days: restDays };
  }

  // Проценты структуры работы
  const dayPct = Math.round((dayShiftsCount / totalShifts) * 100);
  const nightPct = Math.round((nightShiftsCount / totalShifts) * 100);
  const extraPct = Math.round((extraShiftsCount / totalShifts) * 100);

  return {
    isEmpty: false,
    totalIncome: Math.round(totalIncome),
    totalHours: Math.round(totalHours * 10) / 10,
    totalShifts,
    avgMonthlyIncome,
    dayShiftsCount,
    nightShiftsCount,
    extraShiftsCount,
    dayPct,
    nightPct,
    extraPct,
    bestMonth,
    bestShift,
    longestShift,
    maxStreak,
    currentStreak,
  };
}

/**
 * Подсчет динамики месяца к предыдущему календарному месяцу (Month-over-Month)
 * @param {number} year
 * @param {number} month 0-indexed
 * @param {Record<string, any>} shifts
 * @param {number} currentShifts
 * @param {number} currentHours
 * @param {number} currentIncome
 * @returns {Object|null}
 */
export function calcMomTrends(year, month, shifts, currentShifts, currentHours, currentIncome) {
  const prevDate = new Date(year, month - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();

  let prevShiftsCount = 0;
  let prevHours = 0;
  let prevIncome = 0;

  // Bolt Оптимизация: Прямая выборка из хэш-мапы по дням предыдущего месяца O(1)
  // вместо полного перебора всех смен за все годы O(N)
  const daysInPrevMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
  for (let day = 1; day <= daysInPrevMonth; day++) {
    const key = formatDateKey(prevYear, prevMonth, day);
    const s = shifts[key];
    if (s) {
      prevShiftsCount++;
      prevHours += Number(s.hours) || 0;
      prevIncome += Number(s.totalPay) || 0;
    }
  }

  if (prevShiftsCount === 0) {
    return null; // Нет данных за прошлый месяц для сравнения
  }

  const diffIncome = currentIncome - prevIncome;
  const pctIncome = prevIncome > 0 ? Math.round((diffIncome / prevIncome) * 100) : 0;
  const diffShifts = currentShifts - prevShiftsCount;
  const diffHours = Math.round((currentHours - prevHours) * 10) / 10;

  return {
    prevYear,
    prevMonth,
    prevIncome,
    currentIncome,
    diffIncome,
    pctIncome,
    prevShiftsCount,
    currentShifts,
    diffShifts,
    prevHours: Math.round(prevHours * 10) / 10,
    currentHours: Math.round(currentHours * 10) / 10,
    diffHours,
  };
}
