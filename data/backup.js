/**
 * data/backup.js
 * Экспорт и импорт резервных копий (JSON) и выгрузка отчетов (CSV).
 */

import { APP_VERSION, SCHEMA_VERSION, sanitizeSettings } from "./storage.js";

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
  URL.revokeObjectURL(url);
}

/**
 * Экспорт резервной копии данных в формате JSON с поддержкой Web Share API
 * @param {Record<string, any>} shifts
 * @param {Object} settings
 * @returns {Promise<{ success: boolean, shared: boolean, aborted?: boolean }>}
 */
export async function downloadBackup(shifts, settings) {
  const shiftKeys = Object.keys(shifts || {}).sort();
  const shiftsCount = shiftKeys.length;
  let totalIncome = 0;
  for (const k of shiftKeys) {
    totalIncome += Number(shifts[k]?.totalPay) || 0;
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
    shifts: shifts || {},
    settings: settings || {},
  };

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

        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          throw new Error("Неверная корневая структура файла");
        }

        // Проверка принадлежности к приложению
        const isKnownApp =
          parsed.app === "WorkTrack" ||
          parsed.app === "work-tracker" ||
          (parsed.shifts && typeof parsed.shifts === "object" && parsed.settings && typeof parsed.settings === "object");

        if (!isKnownApp) {
          throw new Error("Файл не является резервной копией WorkTrack");
        }

        const rawShifts = parsed.shifts && typeof parsed.shifts === "object" ? parsed.shifts : {};
        const cleanShifts = {};

        // Валидация структуры ключей смен (YYYY-MM-DD)
        const dateKeyRegex = /^\d{4}-\d{2}-\d{2}$/;
        for (const [key, shift] of Object.entries(rawShifts)) {
          if (dateKeyRegex.test(key) && shift && typeof shift === "object") {
            cleanShifts[key] = {
              type: shift.type || "day",
              start: shift.start || "09:00",
              end: shift.end || "21:00",
              breakMins: Number(shift.breakMins) || 0,
              hours: Number(shift.hours) || 0,
              payMode: shift.payMode || "hourly",
              rate: Number(shift.rate) || 0,
              bonus: Number(shift.bonus) || 0,
              totalPay: Number(shift.totalPay) || 0,
              note: typeof shift.note === "string" ? shift.note : "",
              tags: Array.isArray(shift.tags) ? shift.tags : [],
            };
          }
        }

        const cleanSettings = sanitizeSettings(parsed.settings || {});
        const shiftKeys = Object.keys(cleanShifts).sort();
        const shiftsCount = shiftKeys.length;
        let totalIncome = 0;
        for (const k of shiftKeys) {
          totalIncome += Number(cleanShifts[k].totalPay) || 0;
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
 * @param {Record<string, any>} [options.shiftTags={}]
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
      "Перерыв(мин)",
      "Часы",
      "Бонус",
      "Итого",
      "Заметка",
    ],
  ];

  let count = 0;
  Object.keys(shifts)
    .sort()
    .forEach((key) => {
      if (allTime || key.startsWith(datePrefix)) {
        const s = shifts[key];
        count++;
        let tagsStr =
          s.tags && Array.isArray(s.tags) && s.tags.length > 0
            ? s.tags.map((t) => shiftTags[t]?.label || t).join("; ")
            : "";

        let noteStr = s.note || "";

        // Prevent CSV/Formula Injection
        if (/^[=+\-@]/.test(tagsStr)) {
          tagsStr = "'" + tagsStr;
        }
        if (/^[=+\-@]/.test(noteStr)) {
          noteStr = "'" + noteStr;
        }

        const typeLabel = settings?.presets?.[s.type]?.name || (s.type === "night" ? "Ночь" : s.type === "extra" ? "Подработка" : "День");
        rows.push([
          key,
          typeLabel,
          s.start || "",
          s.end || "",
          s.breakMins ?? 0,
          s.hours ?? 0,
          s.bonus ?? 0,
          s.totalPay ?? 0,
          `"${tagsStr.replace(/"/g, '""')}"`,
          `"${noteStr.replace(/"/g, '""')}"`,
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
