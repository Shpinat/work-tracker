/**
 * data/storage.js
 * Слой постоянного хранения данных (localStorage), схемы по умолчанию и валидация.
 */

export const STORAGE_KEY = "my_work_shifts_v1";
export const SETTINGS_KEY = "my_work_settings_v1";
export const THEME_KEY = "my_work_theme_v1";
export const APP_VERSION = "2.0";

export const DEFAULT_PRESETS = {
  day: {
    name: "День",
    start: "09:00",
    end: "21:00",
    breakMins: 60,
  },
  night: {
    name: "Ночь",
    start: "21:00",
    end: "09:00",
    breakMins: 60,
  },
  extra: {
    name: "Подработка",
    start: "10:00",
    end: "16:00",
    breakMins: 0,
  },
};

export const DEFAULT_SETTINGS = {
  start: "09:00",
  end: "21:00",
  breakMins: 60,
  payMode: "hourly",
  rate: 300,
  currency: "₽",
  advanceCutoffDay: 15,
  payoutSplitEnabled: false,
  monthlyGoal: 0,
  monthlyGoalEnabled: false,
  presets: DEFAULT_PRESETS,
};

/**
 * Валидация и нормализация объекта настроек
 * @param {Object} raw
 * @returns {Object}
 */
export function sanitizeSettings(raw) {
  if (!raw || typeof raw !== "object") {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  const presets = raw.presets && typeof raw.presets === "object" ? {
    day: {
      name: typeof raw.presets.day?.name === "string" && raw.presets.day.name.trim() ? raw.presets.day.name.trim() : DEFAULT_PRESETS.day.name,
      start: raw.presets.day?.start || raw.start || DEFAULT_PRESETS.day.start,
      end: raw.presets.day?.end || raw.end || DEFAULT_PRESETS.day.end,
      breakMins: raw.presets.day?.breakMins ?? raw.breakMins ?? DEFAULT_PRESETS.day.breakMins,
    },
    night: {
      name: typeof raw.presets.night?.name === "string" && raw.presets.night.name.trim() ? raw.presets.night.name.trim() : DEFAULT_PRESETS.night.name,
      start: raw.presets.night?.start || DEFAULT_PRESETS.night.start,
      end: raw.presets.night?.end || DEFAULT_PRESETS.night.end,
      breakMins: raw.presets.night?.breakMins ?? DEFAULT_PRESETS.night.breakMins,
    },
    extra: {
      name: typeof raw.presets.extra?.name === "string" && raw.presets.extra.name.trim() ? raw.presets.extra.name.trim() : DEFAULT_PRESETS.extra.name,
      start: raw.presets.extra?.start || DEFAULT_PRESETS.extra.start,
      end: raw.presets.extra?.end || DEFAULT_PRESETS.extra.end,
      breakMins: raw.presets.extra?.breakMins ?? DEFAULT_PRESETS.extra.breakMins,
    },
  } : {
    day: {
      name: DEFAULT_PRESETS.day.name,
      start: raw.start || DEFAULT_PRESETS.day.start,
      end: raw.end || DEFAULT_PRESETS.day.end,
      breakMins: raw.breakMins ?? DEFAULT_PRESETS.day.breakMins,
    },
    night: { ...DEFAULT_PRESETS.night },
    extra: { ...DEFAULT_PRESETS.extra },
  };

  return {
    start: presets.day.start,
    end: presets.day.end,
    breakMins: presets.day.breakMins,
    payMode: ["hourly", "fixed"].includes(raw.payMode) ? raw.payMode : DEFAULT_SETTINGS.payMode,
    rate: typeof raw.rate === "number" ? Math.max(0, raw.rate) : DEFAULT_SETTINGS.rate,
    currency: typeof raw.currency === "string" ? raw.currency : DEFAULT_SETTINGS.currency,
    advanceCutoffDay: typeof raw.advanceCutoffDay === "number" ? Math.min(28, Math.max(1, raw.advanceCutoffDay)) : DEFAULT_SETTINGS.advanceCutoffDay,
    payoutSplitEnabled: typeof raw.payoutSplitEnabled === "boolean" ? raw.payoutSplitEnabled : false,
    monthlyGoal: typeof raw.monthlyGoal === "number" ? Math.max(0, raw.monthlyGoal) : DEFAULT_SETTINGS.monthlyGoal,
    monthlyGoalEnabled: typeof raw.monthlyGoalEnabled === "boolean" ? raw.monthlyGoalEnabled : false,
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
