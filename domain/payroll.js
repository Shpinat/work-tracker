/**
 * domain/payroll.js
 * Бизнес-логика расчета рабочего времени, ставок, оплат, аванса/расчета и целей.
 * Чистые функции без привязки к DOM.
 */

/**
 * Форматирование даты в ключ YYYY-MM-DD
 * @param {number} year
 * @param {number} month 0-indexed (0..11)
 * @param {number} day 1..31
 * @returns {string}
 */
export function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Расчет часов к оплате с учетом ночных смен (перехода через полночь) и перерывов
 * @param {string} start "HH:MM"
 * @param {string} end "HH:MM"
 * @param {number|string} [breakMins=0]
 * @returns {number} часы с округлением до сотых
 */
export function calcHoursDiff(start, end, breakMins = 0) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins <= startMins) {
    endMins += 24 * 60; // Переход через полночь
  }
  const netMins = Math.max(0, endMins - startMins - (Number(breakMins) || 0));
  return Math.round((netMins / 60) * 100) / 100;
}

/**
 * Расчет итоговой суммы за смену
 * @param {number} hours
 * @param {number} rate
 * @param {string} payMode "hourly" | "fixed"
 * @param {number} [bonus=0]
 * @returns {number}
 */
export function calcShiftPay(hours, rate, payMode = "hourly", bonus = 0) {
  const h = Number(hours) || 0;
  const r = Number(rate) || 0;
  const b = Number(bonus) || 0;
  const basePay = payMode === "hourly" ? h * r : r;
  return Math.round(basePay + b);
}

/**
 * Подсчет сводной финансовой статистики и периодов выплат (Аванс / Расчет) за месяц
 * @param {Record<string, any>} shifts
 * @param {number} year
 * @param {number} month 0-indexed
 * @param {number} cutoffDay
 * @returns {Object}
 */
export function calcMonthSummary(shifts, year, month, cutoffDay = 15) {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;

  let totalShifts = 0;
  let totalHours = 0;
  let totalIncome = 0;

  let advanceShiftsCount = 0;
  let advanceHours = 0;
  let advanceIncome = 0;

  let salaryShiftsCount = 0;
  let salaryHours = 0;
  let salaryIncome = 0;

  const monthShifts = [];

  Object.keys(shifts)
    .sort()
    .forEach((dateKey) => {
      if (dateKey.startsWith(monthPrefix)) {
        const shift = shifts[dateKey];
        const day = parseInt(dateKey.slice(8, 10), 10);
        const h = Number(shift.hours) || 0;
        const p = Number(shift.totalPay) || 0;

        totalShifts++;
        totalHours += h;
        totalIncome += p;
        monthShifts.push({ dateKey, day, ...shift });

        if (day <= cutoffDay) {
          advanceShiftsCount++;
          advanceHours += h;
          advanceIncome += p;
        } else {
          salaryShiftsCount++;
          salaryHours += h;
          salaryIncome += p;
        }
      }
    });

  return {
    totalShifts,
    totalHours: Math.round(totalHours * 100) / 100,
    totalIncome: Math.round(totalIncome),
    advanceShiftsCount,
    advanceHours: Math.round(advanceHours * 10) / 10,
    advanceIncome: Math.round(advanceIncome),
    salaryShiftsCount,
    salaryHours: Math.round(salaryHours * 10) / 10,
    salaryIncome: Math.round(salaryIncome),
    monthShifts,
  };
}

/**
 * Пересчет всех смен за указанный месяц по новой ставке
 * @param {Record<string, any>} shifts
 * @param {number} year
 * @param {number} month
 * @param {number} newRate
 * @param {string} newPayMode
 * @returns {{ count: number, updatedShifts: Record<string, any> }}
 */
export function recalcMonthShifts(shifts, year, month, newRate, newPayMode) {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const updatedShifts = { ...shifts };
  let count = 0;

  Object.keys(updatedShifts).forEach((key) => {
    if (key.startsWith(monthPrefix)) {
      const s = { ...updatedShifts[key] };
      s.rate = newRate;
      s.payMode = newPayMode;
      const h = Number(s.hours) || 0;
      const bonus = Number(s.bonus) || 0;
      const basePay = newPayMode === "hourly" ? h * newRate : newRate;
      s.totalPay = Math.round(basePay + bonus);
      updatedShifts[key] = s;
      count++;
    }
  });

  return { count, updatedShifts };
}

/**
 * Оценка необходимого числа смен для достижения финансовой цели
 * @param {number} goal
 * @param {number} totalIncome
 * @param {number} totalShifts
 * @param {Object} settings
 * @returns {{ percent: number, remaining: number, surplus: number, neededShifts: number }}
 */
export function calcGoalProgress(goal, totalIncome, totalShifts, settings) {
  if (goal <= 0) {
    return { percent: 0, remaining: 0, surplus: 0, neededShifts: 0 };
  }

  const percent = Math.round((totalIncome / goal) * 100);
  const surplus = Math.max(0, totalIncome - goal);
  const remaining = Math.max(0, goal - totalIncome);

  let avgShiftPay = 0;
  if (totalShifts > 0 && totalIncome > 0) {
    avgShiftPay = totalIncome / totalShifts;
  } else {
    if (settings.payMode === "hourly") {
      const dayPreset = settings.presets?.day || { start: "09:00", end: "21:00", breakMins: 60 };
      const h = calcHoursDiff(dayPreset.start, dayPreset.end, dayPreset.breakMins) || 11;
      avgShiftPay = h * (settings.rate || 300);
    } else {
      avgShiftPay = settings.rate || 3000;
    }
  }

  const neededShifts = avgShiftPay > 0 ? Math.max(1, Math.ceil(remaining / avgShiftPay)) : 0;

  return { percent, remaining, surplus, neededShifts };
}
