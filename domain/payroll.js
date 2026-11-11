/**
 * domain/payroll.js
 * Бизнес-логика расчета рабочего времени, ставок, оплат, аванса/расчета и целей.
 * Чистые функции без привязки к DOM.
 */

/**
 * Форматирование даты в ключ YYYY-MM-DD
 * Принимает либо объект Date, либо (year, month, day)
 * @param {number|Date} yearOrDate
 * @param {number} [month] 0-indexed (0..11)
 * @param {number} [day] 1..31
 * @returns {string}
 */
export function formatDateKey(yearOrDate, month, day) {
  if (yearOrDate instanceof Date) {
    const y = yearOrDate.getFullYear();
    const m = yearOrDate.getMonth();
    const d = yearOrDate.getDate();
    return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  return `${yearOrDate}-${String(Number(month) + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const TIME_HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isValidTimeHHMM(val) {
  return typeof val === "string" && TIME_HHMM_RE.test(val.trim());
}

function toFiniteNonNeg(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/**
 * Расчет часов к оплате с учетом ночных смен (перехода через полночь) и перерывов.
 * При start === end длительность считается 0 ч (чтобы не искажать ввод новой смены).
 * @param {string} start "HH:MM"
 * @param {string} end "HH:MM"
 * @param {number|string} [breakMins=0]
 * @returns {number} часы с округлением до сотых
 */
export function calcHoursDiff(start, end, breakMins = 0) {
  if (!isValidTimeHHMM(start) || !isValidTimeHHMM(end)) return 0;
  const [sh, sm] = start.trim().split(":").map(Number);
  const [eh, em] = end.trim().split(":").map(Number);
  const startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) {
    endMins += 24 * 60; // Переход через полночь
  }
  const safeBreak = toFiniteNonNeg(breakMins, 0);
  const netMins = Math.max(0, endMins - startMins - safeBreak);
  return Math.round((netMins / 60) * 100) / 100;
}

/**
 * Расчет количества ночных часов смены в пределах ночного окна (по умолчанию 22:00–06:00)
 * С учетом перехода через полночь и пропорционального вычета перерыва.
 * @param {string} start "HH:MM"
 * @param {string} end "HH:MM"
 * @param {number|string} [breakMins=0]
 * @param {string} [nightStart="22:00"]
 * @param {string} [nightEnd="06:00"]
 * @returns {number} ночные часы к доплате с округлением до сотых
 */
export function calcNightHours(start, end, breakMins = 0, nightStart = "22:00", nightEnd = "06:00") {
  if (!isValidTimeHHMM(start) || !isValidTimeHHMM(end)) return 0;
  const [sh, sm] = start.trim().split(":").map(Number);
  const [eh, em] = end.trim().split(":").map(Number);
  const sMins = sh * 60 + sm;
  let eMins = eh * 60 + em;
  if (eMins < sMins) {
    eMins += 24 * 60; // Переход через полночь
  }
  const grossShiftMins = eMins - sMins;
  if (grossShiftMins <= 0) return 0;

  const safeNightStart = isValidTimeHHMM(nightStart) ? nightStart.trim() : "22:00";
  const safeNightEnd = isValidTimeHHMM(nightEnd) ? nightEnd.trim() : "06:00";
  const [nsh, nsm] = safeNightStart.split(":").map(Number);
  const [neh, nem] = safeNightEnd.split(":").map(Number);
  const ns = nsh * 60 + nsm;
  const ne = neh * 60 + nem;

  // Формируем ночные интервалы для временной оси [0, 2880] (до 48 часов)
  const intervals = ns > ne
    ? [
        [0, ne],
        [ns, ne + 1440],
        [ns + 1440, 2880],
      ]
    : [
        [ns, ne],
        [ns + 1440, ne + 1440],
      ];

  let rawNightMins = 0;
  for (const [winStart, winEnd] of intervals) {
    const overlapStart = Math.max(sMins, winStart);
    const overlapEnd = Math.min(eMins, winEnd);
    if (overlapEnd > overlapStart) {
      rawNightMins += (overlapEnd - overlapStart);
    }
  }

  // Пропорциональный вычет перерыва
  const bMins = toFiniteNonNeg(breakMins, 0);
  const breakDeduction = (grossShiftMins > 0 && bMins > 0)
    ? (rawNightMins / grossShiftMins) * bMins
    : 0;

  const netNightMins = Math.max(0, rawNightMins - breakDeduction);
  return Math.round((netNightMins / 60) * 100) / 100;
}

/**
 * Расчет итоговой суммы за смену
 * @param {number} hours
 * @param {number} rate
 * @param {string} payMode "hourly" | "fixed"
 * @param {number} [bonus=0]
 * @param {number} [nightBonus=0]
 * @returns {number}
 */
export function calcShiftPay(hours, rate, payMode = "hourly", bonus = 0, nightBonus = 0) {
  const h = toFiniteNonNeg(hours, 0);
  const r = toFiniteNonNeg(rate, 0);
  const b = toFiniteNonNeg(bonus, 0);
  const nb = toFiniteNonNeg(nightBonus, 0);
  const basePay = payMode === "hourly" ? h * r : r;
  return Math.max(0, Math.round(basePay + b + nb));
}

/**
 * Подсчет сводной финансовой статистики и периодов выплат (Аванс / Расчет / Факт vs План) за месяц
 * @param {Record<string, any>} shifts
 * @param {number} year
 * @param {number} month 0-indexed
 * @param {number} [cutoffDay=15]
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object}
 */
export function calcMonthSummary(shifts, year, month, cutoffDay = 15, referenceDate = new Date()) {
  let totalShifts = 0;
  let totalHours = 0;
  let totalIncome = 0;

  let advanceShiftsCount = 0;
  let advanceHours = 0;
  let advanceIncome = 0;

  let salaryShiftsCount = 0;
  let salaryHours = 0;
  let salaryIncome = 0;

  let earnedShiftsCount = 0;
  let earnedHours = 0;
  let earnedIncome = 0;

  let projectedShiftsCount = 0;
  let projectedHours = 0;
  let projectedIncome = 0;

  const monthShifts = [];

  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth();
  const refDay = referenceDate.getDate();
  const todayKey = formatDateKey(refYear, refMonth, refDay);

  // Оптимизация: Прямая выборка из хэш-мапы по дням месяца O(1) (максимум 31 день).
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(year, month, day);
    const shift = shifts[dateKey];
    if (shift) {
      const h = Number(shift.hours) || 0;
      const p = Number(shift.totalPay !== undefined ? shift.totalPay : shift.pay) || 0;

      totalShifts++;
      totalHours += h;
      totalIncome += p;
      monthShifts.push({ dateKey, day, ...shift });

      // Аванс / Расчет
      if (day <= cutoffDay) {
        advanceShiftsCount++;
        advanceHours += h;
        advanceIncome += p;
      } else {
        salaryShiftsCount++;
        salaryHours += h;
        salaryIncome += p;
      }

      // Факт vs Прогноз (относительно текущей даты)
      if (dateKey <= todayKey) {
        earnedShiftsCount++;
        earnedHours += h;
        earnedIncome += p;
      } else {
        projectedShiftsCount++;
        projectedHours += h;
        projectedIncome += p;
      }
    }
  }

  const effectiveHourlyRate = totalHours > 0 ? Math.round(totalIncome / totalHours) : 0;

  return {
    totalShifts,
    totalHours: Math.round(totalHours * 100) / 100,
    totalIncome: Math.round(totalIncome),
    effectiveHourlyRate,
    advanceShiftsCount,
    advanceHours: Math.round(advanceHours * 10) / 10,
    advanceIncome: Math.round(advanceIncome),
    salaryShiftsCount,
    salaryHours: Math.round(salaryHours * 10) / 10,
    salaryIncome: Math.round(salaryIncome),
    earnedShiftsCount,
    earnedHours: Math.round(earnedHours * 10) / 10,
    earnedIncome: Math.round(earnedIncome),
    projectedShiftsCount,
    projectedHours: Math.round(projectedHours * 10) / 10,
    projectedIncome: Math.round(projectedIncome),
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
  const updatedShifts = { ...shifts };
  const safeRate = toFiniteNonNeg(newRate, 0);
  const safePayMode = newPayMode === "fixed" ? "fixed" : "hourly";
  let count = 0;

  // Bolt Оптимизация: Прямая выборка из хэш-мапы по дням месяца (О(1)) вместо полного обхода ключей (O(N))
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const key = formatDateKey(year, month, day);
    if (updatedShifts[key]) {
      const s = { ...updatedShifts[key] };
      s.rate = safeRate;
      s.payMode = safePayMode;
      const h = toFiniteNonNeg(s.hours, 0);
      const bonus = toFiniteNonNeg(s.bonus, 0);
      const nightBonus = toFiniteNonNeg(s.nightBonus, 0);
      s.totalPay = calcShiftPay(h, safeRate, safePayMode, bonus, nightBonus);
      updatedShifts[key] = s;
      count++;
    }
  }

  return { count, updatedShifts };
}

/**
 * Оценка прогресса и необходимого числа смен для достижения финансовой цели
 * @param {number} totalIncome
 * @param {number} goal
 * @param {number} [totalShifts=0]
 * @param {Object|null} [settings=null]
 * @returns {{ isZeroGoal: boolean, isCompleted: boolean, percent: number, clampedWidth: number, remaining: number, surplus: number, neededShifts: number }}
 */
export function calcGoalProgress(totalIncome, goal, totalShifts = 0, settings = null) {
  const goalNum = Number(goal) || 0;
  const incomeNum = Number(totalIncome) || 0;

  if (goalNum <= 0) {
    return {
      isZeroGoal: true,
      isCompleted: false,
      percent: 0,
      clampedWidth: 0,
      remaining: 0,
      surplus: 0,
      neededShifts: 0,
    };
  }

  const percent = Math.round((incomeNum / goalNum) * 100);
  const clampedWidth = Math.min(100, Math.max(0, percent));
  const isCompleted = percent >= 100;
  const surplus = Math.max(0, incomeNum - goalNum);
  const remaining = Math.max(0, goalNum - incomeNum);

  let avgShiftPay = 0;
  if (totalShifts > 0 && incomeNum > 0) {
    avgShiftPay = incomeNum / totalShifts;
  } else if (settings && typeof settings === "object") {
    if (settings.payMode === "hourly") {
      const dayPreset = settings.presets?.day || { start: "09:00", end: "21:00", breakMins: 60 };
      const h = calcHoursDiff(dayPreset.start, dayPreset.end, dayPreset.breakMins) || 11;
      avgShiftPay = h * (settings.rate || 300);
    } else {
      avgShiftPay = settings.rate || 3000;
    }
  }

  const neededShifts = (avgShiftPay > 0 && remaining > 0) ? Math.max(1, Math.ceil(remaining / avgShiftPay)) : 0;

  return {
    isZeroGoal: false,
    isCompleted,
    percent,
    clampedWidth,
    remaining,
    surplus,
    neededShifts,
  };
}

/**
 * Сверка ожидаемой суммы начислений со значением из расчетного листка
 * @param {number|string} actualPay Начислено по листку работодателя
 * @param {number|string} expectedIncome Начислено по сменам в приложении
 * @returns {{ actual: number, expected: number, diff: number, isMatch: boolean, isUnderpaid: boolean, isOverpaid: boolean, absDiff: number }}
 */
export function verifyPayslip(actualPay, expectedIncome) {
  const actual = Math.round(Number(actualPay) || 0);
  const expected = Math.round(Number(expectedIncome) || 0);
  const diff = actual - expected;
  const isMatch = diff === 0;
  const isUnderpaid = diff < 0;
  const isOverpaid = diff > 0;
  const status = isMatch ? "match" : isUnderpaid ? "underpaid" : "overpaid";
  return {
    actual,
    expected,
    diff,
    status,
    isMatch,
    isUnderpaid,
    isOverpaid,
    absDiff: Math.abs(diff),
  };
}

/**
 * Расчет графика выплат:
 * - Аванс: за смены с 1 по cutoffDay (по умолчанию 15) текущего месяца
 * - ЗП (расчет): выплачивается salaryPayDay (по умолчанию 12) числа следующего месяца за вторую половину предыдущего месяца
 * @param {Record<string, any>} shifts
 * @param {number} year
 * @param {number} month 0-indexed
 * @param {{ cutoffDay?: number, advancePayDay?: number, salaryPayDay?: number }} [options={}]
 * @param {Date} [referenceDate=new Date()]
 * @returns {Object}
 */
export function calcPayoutSchedule(
  shifts,
  year,
  month,
  { cutoffDay = 15, advancePayDay = 27, salaryPayDay = 12 } = {},
  referenceDate = new Date()
) {
  const safeCutoff = Math.min(28, Math.max(1, parseInt(cutoffDay, 10) || 15));
  const safeAdvancePayDay = Math.min(31, Math.max(1, parseInt(advancePayDay, 10) || 27));
  const safeSalaryPayDay = Math.min(31, Math.max(1, parseInt(salaryPayDay, 10) || 12));

  const currentSummary = calcMonthSummary(shifts, year, month, safeCutoff, referenceDate);

  const prevDate = new Date(year, month - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();
  const prevDaysInMonth = new Date(prevYear, prevMonth + 1, 0).getDate();
  const prevSummary = calcMonthSummary(shifts, prevYear, prevMonth, safeCutoff, referenceDate);

  const nextDate = new Date(year, month + 1, 1);
  const nextYear = nextDate.getFullYear();
  const nextMonth = nextDate.getMonth();
  const nextDaysInMonth = new Date(nextYear, nextMonth + 1, 0).getDate();
  const curDaysInMonth = new Date(year, month + 1, 0).getDate();

  const hasCurSecondHalf = safeCutoff < curDaysInMonth;
  const hasPrevSecondHalf = safeCutoff < prevDaysInMonth;

  return {
    cutoffDay: safeCutoff,
    advancePayDay: safeAdvancePayDay,
    salaryPayDay: safeSalaryPayDay,
    // Начисления за выбранный месяц
    advance: {
      amount: currentSummary.advanceIncome,
      hours: currentSummary.advanceHours,
      shiftsCount: currentSummary.advanceShiftsCount,
      fromDay: 1,
      toDay: Math.min(safeCutoff, curDaysInMonth),
      payDay: Math.min(safeAdvancePayDay, curDaysInMonth),
      payMonth: month,
      payYear: year,
    },
    nextMonthSalary: {
      amount: currentSummary.salaryIncome,
      hours: currentSummary.salaryHours,
      shiftsCount: currentSummary.salaryShiftsCount,
      hasRange: hasCurSecondHalf,
      fromDay: hasCurSecondHalf ? safeCutoff + 1 : null,
      toDay: hasCurSecondHalf ? curDaysInMonth : null,
      payDay: Math.min(safeSalaryPayDay, nextDaysInMonth),
      payMonth: nextMonth,
      payYear: nextYear,
    },
    // Поступления в выбранном месяце: 12-го за прошлый месяц + аванс текущего месяца
    incomingPrevSalary: {
      amount: prevSummary.salaryIncome,
      hours: prevSummary.salaryHours,
      shiftsCount: prevSummary.salaryShiftsCount,
      hasRange: hasPrevSecondHalf,
      fromDay: hasPrevSecondHalf ? safeCutoff + 1 : null,
      toDay: hasPrevSecondHalf ? prevDaysInMonth : null,
      sourceMonth: prevMonth,
      sourceYear: prevYear,
      payDay: Math.min(safeSalaryPayDay, curDaysInMonth),
    },
    totalIncomingInMonth: Math.round(prevSummary.salaryIncome + currentSummary.advanceIncome),
  };
}
