/**
 * data/backup.js
 * Экспорт и импорт резервных копий (JSON) и выгрузка отчетов (CSV).
 */

import { APP_VERSION, sanitizeSettings } from "./storage.js";

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
 * Скачивание резервной копии данных в формате JSON
 * @param {Record<string, any>} shifts
 * @param {Object} settings
 */
export function downloadBackup(shifts, settings) {
  const payload = {
    app: "work-tracker",
    version: APP_VERSION,
    exportedAt: new Date().toISOString(),
    shifts,
    settings,
  };
  const data = JSON.stringify(payload, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  triggerDownload(
    blob,
    `shifts_backup_${new Date().toISOString().slice(0, 10)}.json`,
  );
}

/**
 * Асинхронное чтение и валидация файла резервной копии JSON
 * @param {File} file
 * @returns {Promise<{ shifts: Record<string, any>, settings: Object }>}
 */
export function parseBackupFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      return reject(new Error("Файл не выбран"));
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = JSON.parse(e.target.result);
        if (!parsed || typeof parsed !== "object") {
          throw new Error("Неверная структура данных");
        }

        const shifts = parsed.shifts && typeof parsed.shifts === "object" ? parsed.shifts : {};
        const settings = sanitizeSettings(parsed.settings || {});

        resolve({ shifts, settings });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Ошибка чтения файла"));
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
        rows.push([
          key,
          s.type || "day",
          s.start || "",
          s.end || "",
          s.breakMins ?? 0,
          s.hours ?? 0,
          s.bonus ?? 0,
          s.totalPay ?? 0,
          `"${(s.note || "").replace(/"/g, '""')}"`,
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
