/**
 * data/storage.js
 * Слой постоянного хранения данных (localStorage), схемы по умолчанию и валидация.
 */

import { TEMPLATE_ICONS, DEFAULT_TEMPLATE_STYLE } from "../ui/icons.js";

export const STORAGE_KEY = "my_work_shifts_v1";
export const SETTINGS_KEY = "my_work_settings_v1";
export const THEME_KEY = "my_work_theme_v1";
export const TIMER_STORAGE_KEY = "my_work_timer_v1";
export const APP_VERSION = "2.0";
export const SCHEMA_VERSION = 2;

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_PRESETS = {
  day: {
    name: "День",
    start: "09:00",
    end: "21:00",
    breakMins: 0,
    icon: DEFAULT_TEMPLATE_STYLE.day.icon,
    color: DEFAULT_TEMPLATE_STYLE.day.color,
  },
  night: {
    name: "Ночь",
    start: "21:00",
    end: "09:00",
    breakMins: 0,
    icon: DEFAULT_TEMPLATE_STYLE.night.icon,
    color: DEFAULT_TEMPLATE_STYLE.night.color,
  },
  extra: {
    name: "Подработка",
    start: "10:00",
    end: "16:00",
    breakMins: 0,
    icon: DEFAULT_TEMPLATE_STYLE.extra.icon,
    color: DEFAULT_TEMPLATE_STYLE.extra.color,
  },
};

export const DEFAULT_SETTINGS = {
  start: "09:00",
  end: "21:00",
  breakMins: 0,
  payMode: "hourly",
  rate: 300,
  currency: "₽",
  payoutMode: "on",
  advanceCutoffDay: 15,
  advancePayDay: 27,
  salaryPayDay: 12,
  presets: DEFAULT_PRESETS,
};

function sanitizePreset(rawPreset, fallbackPreset, legacyStart, legacyEnd) {
  const icon = rawPreset?.icon && TEMPLATE_ICONS[rawPreset.icon] ? rawPreset.icon : fallbackPreset.icon;
  const color = typeof rawPreset?.color === "string" && HEX_COLOR_RE.test(rawPreset.color.trim())
    ? rawPreset.color.trim().toLowerCase()
    : fallbackPreset.color;

  return {
    name: typeof rawPreset?.name === "string" && rawPreset.name.trim()
      ? rawPreset.name.trim()
      : fallbackPreset.name,
    start: rawPreset?.start || legacyStart || fallbackPreset.start,
    end: rawPreset?.end || legacyEnd || fallbackPreset.end,
    breakMins: 0,
    icon,
    color,
  };
}

function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Валидация и нормализация объекта настроек
 * @param {Object} raw
 * @returns {Object}
 */
export function sanitizeSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  const presets = raw.presets && typeof raw.presets === "object"
    ? {
        day: sanitizePreset(raw.presets.day, DEFAULT_PRESETS.day, raw.start, raw.end),
        night: sanitizePreset(raw.presets.night, DEFAULT_PRESETS.night),
        extra: sanitizePreset(raw.presets.extra, DEFAULT_PRESETS.extra),
      }
    : {
        day: sanitizePreset(null, DEFAULT_PRESETS.day, raw.start, raw.end),
        night: { ...DEFAULT_PRESETS.night },
        extra: { ...DEFAULT_PRESETS.extra },
      };

  return {
    start: presets.day.start,
    end: presets.day.end,
    breakMins: 0,
    payMode: ["hourly", "fixed"].includes(raw.payMode) ? raw.payMode : DEFAULT_SETTINGS.payMode,
    rate: typeof raw.rate === "number" ? Math.max(0, raw.rate) : DEFAULT_SETTINGS.rate,
    currency: typeof raw.currency === "string" && raw.currency.trim() ? raw.currency.trim() : DEFAULT_SETTINGS.currency,
    payoutMode: ["on", "off"].includes(raw.payoutMode) ? raw.payoutMode : DEFAULT_SETTINGS.payoutMode,
    advanceCutoffDay: clampInt(raw.advanceCutoffDay, 1, 28, DEFAULT_SETTINGS.advanceCutoffDay),
    advancePayDay: clampInt(raw.advancePayDay, 1, 31, DEFAULT_SETTINGS.advancePayDay),
    salaryPayDay: clampInt(raw.salaryPayDay, 1, 31, DEFAULT_SETTINGS.salaryPayDay),
    presets,
  };
}

/**
 * Чтение смен из localStorage
 * @returns {Record<string, any>}
 */
export function loadShifts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error("Ошибка чтения смен из localStorage:", err);
    return {};
  }
}

/**
 * Запись смен в localStorage
 * @param {Record<string, any>} shifts
 * @returns {boolean} Успешно ли сохранено
 */
export function saveShifts(shifts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
    return true;
  } catch (err) {
    console.error("Ошибка сохранения смен в localStorage:", err);
    return false;
  }
}

/**
 * Чтение настроек из localStorage с валидацией схемы
 * @returns {Object}
 */
export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    return sanitizeSettings(JSON.parse(raw));
  } catch (err) {
    console.error("Ошибка чтения настроек из localStorage:", err);
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

/**
 * Запись настроек в localStorage
 * @param {Object} settings
 * @returns {boolean} Успешно ли сохранено
 */
export function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error("Ошибка сохранения настроек в localStorage:", err);
    return false;
  }
}

/**
 * Чтение темы интерфейса
 * @returns {string} 'dark' | 'light'
 */
export function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "dark";
  } catch (_) {
    return "dark";
  }
}

/**
 * Сохранение темы интерфейса
 * @param {string} theme
 */
export function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {}
}

/**
 * Чтение сохраненного состояния таймера смены
 * @returns {Object|null}
 */
export function loadShiftTimer() {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}

/**
 * Сохранение состояния таймера смены
 * @param {Object} timerState
 */
export function saveShiftTimer(timerState) {
  try {
    if (!timerState) {
      localStorage.removeItem(TIMER_STORAGE_KEY);
    } else {
      localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(timerState));
    }
  } catch (_) {}
}

/**
 * Очистка сохраненного таймера
 */
export function clearShiftTimer() {
  try {
    localStorage.removeItem(TIMER_STORAGE_KEY);
  } catch (_) {}
}

/**
 * Аккуратный запрос постоянного хранения данных у браузера (Storage Persistence)
 * Защищает от сброса кэша Safari на iOS и экономии памяти
 * @returns {Promise<boolean>}
 */
export async function requestPersistentStorage() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persisted();
      if (!isPersisted) {
        return await navigator.storage.persist();
      }
      return true;
    } catch (_) {
      return false;
    }
  }
  return false;
}
