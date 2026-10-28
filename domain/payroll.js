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
  if (endMins < startMins) {
    endMins += 24 * 60; // Переход через полночь
  }
  const netMins = Math.max(0, endMins - startMins - (Number(breakMins) || 0));
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
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let sMins = sh * 60 + sm;
  let eMins = eh * 60 + em;
  if (eMins < sMins) {
    eMins += 24 * 60; // Переход через полночь
  }
  const grossShiftMins = eMins - sMins;
  if (grossShiftMins <= 0) return 0;

  const [nsh, nsm] = (nightStart || "22:00").split(":").map(Number);
  const [neh, nem] = (nightEnd || "06:00").split(":").map(Number);
  const ns = nsh * 60 + nsm;
  const ne = neh * 60 + nem;

  // Формируем ночные интервалы для временной оси [0, 2880] (до 48 часов)
  // Окно 1: утро текущего дня [0, ne]
  // Окно 2: ночь текущего дня [ns, ne + 1440]
  // Окно 3: ночь следующего дня [ns + 1440, 2880]
  const intervals = [
    [0, ne],
    [ns, ne + 1440],
    [ns + 1440, 2880],
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
  const bMins = Math.max(0, Number(breakMins) || 0);
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
  const h = Number(hours) || 0;
  const r = Number(rate) || 0;
  const b = Number(bonus) || 0;
  const nb = Number(nightBonus) || 0;
  const basePay = payMode === "hourly" ? h * r : r;
  return Math.round(basePay + b + nb);
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
export function calcMonthSummary(shifts, year, month, cutoffDay = 15) {
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

  // Bolt Оптимизация: Прямая выборка из хэш-мапы (Object lookup)
  // Вместо Object.keys(shifts).sort() за O(N log N) мы итерируемся только по дням месяца O(1) (максимум 31 день).
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(year, month, day);
    const shift = shifts[dateKey];
    if (shift) {
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
  }

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
  let count = 0;

  // Bolt Оптимизация: Прямая выборка из хэш-мапы по дням месяца (О(1)) вместо полного обхода ключей (O(N))
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const key = formatDateKey(year, month, day);
    if (updatedShifts[key]) {
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
