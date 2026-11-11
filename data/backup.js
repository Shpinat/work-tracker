/**
 * data/backup.js
 * Экспорт и импорт резервных копий (JSON) и выгрузка отчетов (CSV).
 */

import { APP_VERSION, SCHEMA_VERSION, sanitizeSettings, sanitizePaidPayouts } from "./storage.js";

export const MAX_BACKUP_FILE_SIZE = 5 * 1024 * 1024; // 5 МБ

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const VALID_SHIFT_TYPES = new Set(["day", "night", "extra"]);

function isPlainObject(val) {
  return val !== null && typeof val === "object" && !Array.isArray(val);
}

function isValidRealDateKey(key) {
  if (typeof key !== "string" || !DATE_KEY_RE.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

function toFiniteNonNeg(val, fallback = 0) {
  if (val === "" || val === null || val === undefined || typeof val === "boolean") {
    return fallback;
  }
  const n = Number(val);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sanitizeTimeHHMM(val, fallback) {
  if (typeof val === "string" && TIME_HHMM_RE.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

function sanitizeCsvCell(val) {
  let str = val === null || val === undefined ? "" : String(val);
  if (/^\s*[=+\-@\t\r]/.test(str)) {
    str = "'" + str;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

function escapeIcsText(val) {
  return String(val ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function formatIcsDateTime(dateKey, timeStr) {
  const [y, m, d] = dateKey.split("-");
  const [hh, mm] = timeStr.split(":");
  return `${y}${m}${d}T${hh}${mm}00`;
}

function getNextDateKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

/**
 * Инициация скачивания Blob-файла через динамическую ссылку
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerDownload(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Формирование структуры резервной копии JSON
 * @param {Record<string, any>} shifts
 * @param {Object} settings
 * @param {Record<string, any>|null} [paidPayouts=null]
 * @returns {Object}
 */
export function createBackupPayload(shifts, settings, paidPayouts = null) {
  const safeShifts = isPlainObject(shifts) ? shifts : {};
  const shiftKeys = Object.keys(safeShifts).sort();
  const shiftsCount = shiftKeys.length;
  let totalIncome = 0;
  for (const k of shiftKeys) {
    const s = safeShifts[k];
    totalIncome += toFiniteNonNeg(s?.totalPay !== undefined ? s.totalPay : s?.pay, 0);
  }

  const payload = {
    app: "WorkTrack",
    schemaVersion: SCHEMA_VERSION,
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    stats: {
      shiftsCount,
      firstDate: shiftKeys.length > 0 ? shiftKeys[0] : null,
      lastDate: shiftKeys.length > 0 ? shiftKeys[shiftKeys.length - 1] : null,
      totalIncome: Math.round(totalIncome),
    },
    shifts: safeShifts,
    settings: settings || {},
  };

  if (isPlainObject(paidPayouts)) {
    payload.paidPayouts = sanitizePaidPayouts(paidPayouts);
  }

  return payload;
}

/**
 * Экспорт резервной копии данных в формате JSON с поддержкой Web Share API
 * @param {Record<string, any>} shifts
 * @param {Object} settings
 * @param {Record<string, any>|null} [paidPayouts=null]
 * @returns {Promise<{ success: boolean, shared: boolean, aborted?: boolean }>}
 */
export async function downloadBackup(shifts, settings, paidPayouts = null) {
  const payload = createBackupPayload(shifts, settings, paidPayouts);
  const shiftsCount = payload.stats.shiftsCount;
  const filename = `worktrack_backup_${new Date().toISOString().slice(0, 10)}.json`;
  const jsonStr = JSON.stringify(payload, null, 2);

  // Web Share API для удобного сохранения на смартфонах
  if (typeof navigator !== "undefined" && navigator.canShare) {
    try {
      const file = new File([jsonStr], filename, { type: "application/json" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Резервная копия WorkTrack",
          text: `Резервная копия WorkTrack (${shiftsCount} смен) от ${new Date().toLocaleDateString("ru-RU")}`,
          files: [file],
        });
        return { success: true, shared: true };
      }
    } catch (err) {
      if (err.name === "AbortError") {
        return { success: false, shared: false, aborted: true };
      }
      // При ошибке шаринга откатываемся на стандартное скачивание
    }
  }

  // Фоллбэк: стандартное скачивание файла браузером
  const blob = new Blob([jsonStr], { type: "application/json" });
  triggerDownload(blob, filename);
  return { success: true, shared: false };
}

/**
 * Асинхронное чтение, проверка целостности и валидация файла резервной копии JSON
 * @param {File} file
 * @returns {Promise<{ isValid: boolean, schemaVersion: number, exportedAt: string|null, appVersion: string|null, stats: Object, shifts: Record<string, any>, settings: Object }>}
 */
export function parseBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("Файл не выбран"));
    }
    if (typeof file.size === "number" && file.size > MAX_BACKUP_FILE_SIZE) {
      return reject(new Error("Файл резервной копии слишком большой (максимум 5 МБ)"));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        if (!text || typeof text !== "string") {
          throw new Error("Файл пуст или поврежден");
        }

        let parsed;
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr) {
          throw new Error("Файл не является корректным JSON-документом");
        }

        if (!isPlainObject(parsed)) {
          throw new Error("Неверная корневая структура файла");
        }

        // Проверка принадлежности к приложению
        const hasShiftsObj = isPlainObject(parsed.shifts);
        const hasSettingsObj = isPlainObject(parsed.settings);
        const isKnownApp =
          parsed.app === "WorkTrack" ||
          parsed.app === "work-tracker" ||
          (hasShiftsObj && hasSettingsObj);

        if (!isKnownApp) {
          throw new Error("Файл не является резервной копией WorkTrack");
        }

        const rawShifts = hasShiftsObj ? parsed.shifts : {};
        const cleanShifts = {};

        for (const [key, shift] of Object.entries(rawShifts)) {
          if (isValidRealDateKey(key) && isPlainObject(shift)) {
            const type = VALID_SHIFT_TYPES.has(shift.type) ? shift.type : "day";
            const rawPay = shift.totalPay !== undefined ? shift.totalPay : shift.pay;
            const cleanShift = {
              type,
              start: sanitizeTimeHHMM(shift.start, "09:00"),
              end: sanitizeTimeHHMM(shift.end, "21:00"),
              breakMins: toFiniteNonNeg(shift.breakMins, 0),
              hours: toFiniteNonNeg(shift.hours, 0),
              payMode: shift.payMode === "fixed" ? "fixed" : "hourly",
              rate: toFiniteNonNeg(shift.rate, 0),
              bonus: toFiniteNonNeg(shift.bonus, 0),
              totalPay: toFiniteNonNeg(rawPay, 0),
              note: typeof shift.note === "string" ? shift.note : "",
              tags: Array.isArray(shift.tags)
                ? shift.tags.filter((t) => typeof t === "string" || typeof t === "number").map(String)
                : [],
            };
            if (shift.nightBonus !== undefined) {
              cleanShift.nightBonus = toFiniteNonNeg(shift.nightBonus, 0);
            }
            cleanShifts[key] = cleanShift;
          }
        }

        const shiftKeys = Object.keys(cleanShifts).sort();
        const shiftsCount = shiftKeys.length;
        const hasSettingsData = hasSettingsObj && Object.keys(parsed.settings).length > 0;
        if (shiftsCount === 0 && !hasSettingsData) {
          throw new Error("Резервная копия не содержит данных смен или настроек");
        }

        const cleanSettings = sanitizeSettings(hasSettingsObj ? parsed.settings : {});
        const paidPayouts = isPlainObject(parsed.paidPayouts)
          ? sanitizePaidPayouts(parsed.paidPayouts)
          : {};

        let totalIncome = 0;
        for (const k of shiftKeys) {
          totalIncome += toFiniteNonNeg(cleanShifts[k].totalPay, 0);
        }

        resolve({
          isValid: true,
          schemaVersion: parsed.schemaVersion || 1,
          app: parsed.app || "WorkTrack",
          exportedAt: parsed.exportedAt || null,
          appVersion: parsed.version || null,
          stats: {
            shiftsCount,
            firstDate: shiftKeys.length > 0 ? shiftKeys[0] : null,
            lastDate: shiftKeys.length > 0 ? shiftKeys[shiftKeys.length - 1] : null,
            totalIncome: Math.round(totalIncome),
          },
          shifts: cleanShifts,
          settings: cleanSettings,
          paidPayouts,
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла с диска"));
    reader.readAsText(file);
  });
}

/**
 * Генерация и выгрузка CSV-отчета по сменам
 * @param {Object} options
 * @param {Record<string, any>} options.shifts
 * @param {Object} options.settings
 * @param {boolean} [options.allTime=false]
 * @param {Date} options.currentDate
 * @param {string} options.monthName
 * @returns {Promise<{ count: number, shared: boolean }>}
 */
export async function exportCSV({
  shifts,
  settings,
  allTime = false,
  currentDate,
  monthName = "",
}) {
  const year = currentDate.getFullYear();
  const monthStr = String(currentDate.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `${year}-${monthStr}`;
  const datePrefix = `${monthPrefix}-`;

  const rows = [
    [
      "Дата",
      "Тип",
      "Начало",
      "Конец",
      "Часы",
      "Итого",
      "Заметка",
    ],
  ];

  // Keep the CSV header aligned with the tags and note columns below.
  rows[0].splice(6, 0, "Tags");

  let count = 0;
  Object.keys(shifts || {})
    .sort()
    .forEach((key) => {
      if (allTime || key.startsWith(datePrefix)) {
        const s = shifts[key];
        if (!s || typeof s !== "object") return;
        count++;
        const tagsStr = Array.isArray(s.tags) ? s.tags.map(String).join("; ") : "";
        const noteStr = s.note || "";
        const typeLabel = settings?.presets?.[s.type]?.name || (s.type === "night" ? "Ночь" : s.type === "extra" ? "Подработка" : "День");
        const safeHours = toFiniteNonNeg(s.hours, 0);
        const safePay = toFiniteNonNeg(s.totalPay !== undefined ? s.totalPay : s.pay, 0);

        rows.push([
          sanitizeCsvCell(key),
          sanitizeCsvCell(typeLabel),
          sanitizeCsvCell(s.start || ""),
          sanitizeCsvCell(s.end || ""),
          safeHours,
          safePay,
          sanitizeCsvCell(tagsStr),
          sanitizeCsvCell(noteStr),
        ]);
      }
    });

  if (count === 0) {
    return { count: 0, shared: false };
  }

  const csvContent = "\uFEFF" + rows.map((e) => e.join(";")).join("\n");
  const filename = allTime ? "shifts_all.csv" : `shifts_${monthPrefix}.csv`;
  const file = new File([csvContent], filename, { type: "text/csv;charset=utf-8" });

  // Web Share API для прямой отправки в мессенджеры на мобильных устройствах
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: allTime ? "Все смены" : `Смены за ${monthName} ${year}`,
        text: `Отчёт по сменам (${count} смен)`,
        files: [file],
      });
      return { count, shared: true };
    } catch (err) {
      if (err.name === "AbortError") {
        return { count, shared: false, aborted: true };
      }
    }
  }

  // Фоллбэк: стандартное скачивание файла браузером
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
  return { count, shared: false };
}

/**
 * Генерация и скачивание календарного файла .ics (iCalendar RFC 5545)
 * @param {Object} options
 * @param {Record<string, any>} options.shifts
 * @param {Object} options.settings
 * @param {number} [options.year]
 * @param {number} [options.month] 0-indexed
 * @returns {{ count: number, filename: string|null, icsContent: string }}
 */
export function exportICS({ shifts, settings, year, month }) {
  const hasMonthFilter = Number.isInteger(year) && Number.isInteger(month);
  const monthPrefix = hasMonthFilter
    ? `${year}-${String(month + 1).padStart(2, "0")}`
    : null;
  const datePrefix = monthPrefix ? `${monthPrefix}-` : null;

  const dtStamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const curr = settings?.currency || "₽";
  const events = [];

  Object.keys(shifts || {})
    .sort()
    .forEach((key) => {
      if (!isValidRealDateKey(key)) return;
      if (datePrefix && !key.startsWith(datePrefix)) return;
      const s = shifts[key];
      if (!s || typeof s !== "object") return;

      const start = sanitizeTimeHHMM(s.start, "09:00");
      const end = sanitizeTimeHHMM(s.end, "21:00");
      const [sh, sm] = start.split(":").map(Number);
      const [eh, em] = end.split(":").map(Number);
      const crossesMidnight = (eh * 60 + em) < (sh * 60 + sm);
      const endDateKey = crossesMidnight ? getNextDateKey(key) : key;

      const typeLabel = settings?.presets?.[s.type]?.name || (s.type === "night" ? "Ночь" : s.type === "extra" ? "Подработка" : "День");
      const hours = toFiniteNonNeg(s.hours, 0);
      const totalPay = toFiniteNonNeg(s.totalPay !== undefined ? s.totalPay : s.pay, 0);

      const summary = `${typeLabel} (${hours} ч)`;
      const descParts = [`Время: ${start}–${end}`, `Оплата: ${totalPay} ${curr}`];
      if (typeof s.note === "string" && s.note.trim()) {
        descParts.push(`Заметка: ${s.note.trim()}`);
      }

      events.push([
        "BEGIN:VEVENT",
        `UID:${key}-${s.type || "day"}@worktrack.local`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${formatIcsDateTime(key, start)}`,
        `DTEND:${formatIcsDateTime(endDateKey, end)}`,
        `SUMMARY:${escapeIcsText(summary)}`,
        `DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`,
        "END:VEVENT",
      ].join("\r\n"));
    });

  if (events.length === 0) {
    return { count: 0, filename: null, icsContent: "" };
  }

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WorkTrack//Shift Calendar//RU",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");

  const filename = monthPrefix ? `shifts_${monthPrefix}.ics` : "shifts_all.ics";
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8;" });
  triggerDownload(blob, filename);
  return { count: events.length, filename, icsContent };
}
