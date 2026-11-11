/**
 * domain/schedule.js
 * Алгоритмы генерации циклов графиков смен (2/2, 3/3, 5/2, День-Ночь-48, кастомные).
 * Чистые функции без привязки к DOM.
 */

import { formatDateKey, calcHoursDiff, calcShiftPay } from "./payroll.js";

export const SCHEDULE_PATTERNS = {
  "2-2-day": {
    name: "2/2 День",
    cycle: ["day", "day", "off", "off"],
  },
  "2-2-mixed": {
    name: "2/2 Смешанный",
    cycle: ["day", "night", "off", "off"],
  },
  "3-3-day": {
    name: "3/3 День",
    cycle: ["day", "day", "day", "off", "off", "off"],
  },
  "1-3-day": {
    name: "Сутки через трое (1/3)",
    cycle: ["day", "off", "off", "off"],
  },
  "4-4-day": {
    name: "4/4 День",
    cycle: ["day", "day", "day", "day", "off", "off", "off", "off"],
  },
  "2-2-3-pitman": {
    name: "2-2-3 Питман",
    cycle: ["day", "day", "off", "off", "day", "day", "day", "off", "off", "day", "day", "off", "off", "off"],
  },
  "1-3-mixed": {
    name: "День-Ночь-48",
    cycle: ["day", "night", "off", "off"],
  },
  "5-2-weekdays": {
    name: "5/2 Будни",
    isWeekdays: true,
  },
  custom: {
    name: "Свой цикл",
    cycle: ["day", "off"],
  },
};

/**
 * Расчет списка дат и типов смен для автозаполнения графика
 * @param {Object} options
 * @param {string} options.startDateStr "YYYY-MM-DD"
 * @param {string} options.patternKey
 * @param {string[]} [options.customCycle=[]]
 * @param {number} [options.durationMonths=1]
 * @param {boolean} [options.skipExisting=true]
 * @param {Record<string, any>} [options.shifts={}]
 * @returns {Array<{ dateKey: string, type: string, day: number, month: number, year: number, willOverwrite: boolean }>}
 */
export function calculateScheduleDates({
  startDateStr,
  patternKey,
  customCycle = [],
  durationMonths = 1,
  skipExisting = true,
  shifts = {},
}) {
  if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) return [];

  const [sy, sm, sd] = startDateStr.split("-").map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  if (
    startDate.getFullYear() !== sy ||
    startDate.getMonth() !== sm - 1 ||
    startDate.getDate() !== sd
  ) {
    return [];
  }

  const pattern = SCHEDULE_PATTERNS[patternKey] || SCHEDULE_PATTERNS["2-2-day"];
  const safeDuration = Math.max(1, parseInt(durationMonths, 10) || 1);

  const targetMonthIndex = (sm - 1) + safeDuration;
  const targetYear = sy + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const endDate = new Date(targetYear, targetMonth, Math.min(sd, daysInTargetMonth));
  endDate.setDate(endDate.getDate() - 1);

  const cycle = patternKey === "custom" ? customCycle : (pattern.cycle || []);
  if (!pattern.isWeekdays && cycle.length === 0) return [];

  const plannedShifts = [];
  const cur = new Date(startDate);

  let dayIndex = 0;
  while (cur <= endDate) {
    const y = cur.getFullYear();
    const m = cur.getMonth();
    const d = cur.getDate();
    const dateKey = formatDateKey(y, m, d);

    let type = "off";
    if (pattern.isWeekdays) {
      const dayOfWeek = cur.getDay(); // 0 = Вс, 6 = Сб
      type = dayOfWeek >= 1 && dayOfWeek <= 5 ? "day" : "off";
    } else {
      type = cycle[dayIndex % cycle.length];
    }

    if (type !== "off") {
      const alreadyExists = !!shifts[dateKey];
      if (!alreadyExists || !skipExisting) {
        plannedShifts.push({
          dateKey,
          type,
          day: d,
          month: m,
          year: y,
          willOverwrite: alreadyExists,
        });
      }
    }

    cur.setDate(cur.getDate() + 1);
    dayIndex++;
  }

  return plannedShifts;
}

/**
 * Создание объекта смены на основе шаблона (пресета) и текущих настроек
 * @param {string} type "day" | "night" | "extra"
 * @param {Object} settings
 * @returns {Object}
 */
export function buildShiftFromPreset(type, settings) {
  const preset = settings?.presets?.[type] || { start: "09:00", end: "21:00" };
  const hours = calcHoursDiff(preset.start, preset.end, 0);
  const payMode = preset.payMode || settings?.payMode || "hourly";
  const rawRate = preset.rate !== undefined && preset.rate !== ""
    ? Number(preset.rate)
    : Number(settings?.rate ?? settings?.defaultRate ?? 0);
  const rate = Number.isFinite(rawRate) && rawRate >= 0 ? rawRate : 0;
  const totalPay = calcShiftPay(hours, rate, payMode, 0);

  return {
    type,
    start: preset.start,
    end: preset.end,
    breakMins: 0,
    hours,
    payMode,
    rate,
    bonus: 0,
    totalPay,
    note: "",
    tags: [],
  };
}
