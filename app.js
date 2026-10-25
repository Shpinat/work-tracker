// ============================================================
// Константы
// ============================================================
const STORAGE_KEY = "my_work_shifts_v1";
const SETTINGS_KEY = "my_work_settings_v1";
const THEME_KEY = "my_work_theme_v1";

const DEFAULT_PRESETS = {
  day: {
    start: "09:00",
    end: "21:00",
    breakMins: 60,
  },
  night: {
    start: "21:00",
    end: "09:00",
    breakMins: 60,
  },
  extra: {
    start: "10:00",
    end: "16:00",
    breakMins: 0,
  },
};

const DEFAULT_SETTINGS = {
  start: "09:00",
  end: "21:00",
  breakMins: 60,
  payMode: "hourly",
  rate: 300,
  currency: "₽",
  advanceCutoffDay: 15,
  monthlyGoal: 0,
  presets: DEFAULT_PRESETS,
};

const MONTH_NAMES = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
];

const MONTH_NAMES_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

const SHIFT_ICONS = {
  day: '<svg class="shift-svg-icon shift-svg-icon--day" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
  night: '<svg class="shift-svg-icon shift-svg-icon--night" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
  extra: '<svg class="shift-svg-icon shift-svg-icon--extra" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>',
};

function getShiftIconSvg(type) {
  return SHIFT_ICONS[type] || SHIFT_ICONS.day;
}

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    const parsed = JSON.parse(raw);
    const presets = {
      day: {
        start: parsed.presets?.day?.start || parsed.start || DEFAULT_PRESETS.day.start,
        end: parsed.presets?.day?.end || parsed.end || DEFAULT_PRESETS.day.end,
        breakMins: parsed.presets?.day?.breakMins ?? parsed.breakMins ?? DEFAULT_PRESETS.day.breakMins,
      },
      night: {
        start: parsed.presets?.night?.start || DEFAULT_PRESETS.night.start,
        end: parsed.presets?.night?.end || DEFAULT_PRESETS.night.end,
        breakMins: parsed.presets?.night?.breakMins ?? DEFAULT_PRESETS.night.breakMins,
      },
      extra: {
        start: parsed.presets?.extra?.start || DEFAULT_PRESETS.extra.start,
        end: parsed.presets?.extra?.end || DEFAULT_PRESETS.extra.end,
        breakMins: parsed.presets?.extra?.breakMins ?? DEFAULT_PRESETS.extra.breakMins,
      },
    };
    return {
      start: presets.day.start,
      end: presets.day.end,
      breakMins: presets.day.breakMins,
      payMode: ["hourly", "fixed"].includes(parsed.payMode) ? parsed.payMode : DEFAULT_SETTINGS.payMode,
      rate: typeof parsed.rate === "number" ? parsed.rate : DEFAULT_SETTINGS.rate,
      currency: typeof parsed.currency === "string" ? parsed.currency : DEFAULT_SETTINGS.currency,
      advanceCutoffDay: typeof parsed.advanceCutoffDay === "number" ? parsed.advanceCutoffDay : DEFAULT_SETTINGS.advanceCutoffDay,
      monthlyGoal: typeof parsed.monthlyGoal === "number" ? Math.max(0, parsed.monthlyGoal) : DEFAULT_SETTINGS.monthlyGoal,
      presets,
    };
  } catch (_) {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }
}

// ============================================================
// Состояние
// ============================================================
let currentDate = new Date();
let shifts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
let settings = loadSettings();
let currentTheme = localStorage.getItem(THEME_KEY) || "dark";

// ============================================================
// Кэширование DOM-элементов
// ============================================================
const elements = {
  // Навигация и заголовок
  monthTitle: document.getElementById("monthTitle"),
  prevMonthBtn: document.getElementById("prevMonthBtn"),
  nextMonthBtn: document.getElementById("nextMonthBtn"),
  todayBtn: document.getElementById("todayBtn"),
  autoScheduleBtn: document.getElementById("autoScheduleBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeIcon: document.getElementById("themeIcon"),
  settingsBtn: document.getElementById("settingsBtn"),
  metaThemeColor: document.querySelector('meta[name="theme-color"]'),

  // Статистика
  statShifts: document.getElementById("statShifts"),
  statHours: document.getElementById("statHours"),
  statIncome: document.getElementById("statIncome"),

  // Финансовая цель на месяц ("Копилка")
  goalTracker: document.getElementById("goalTracker"),
  goalProgressText: document.getElementById("goalProgressText"),
  goalPercentage: document.getElementById("goalPercentage"),
  goalProgressBar: document.getElementById("goalProgressBar"),
  goalStatusText: document.getElementById("goalStatusText"),
  goalActionHint: document.getElementById("goalActionHint"),

  // Выплаты: Аванс и Расчёт
  payoutSplit: document.getElementById("payoutSplit"),
  payoutAdvanceCard: document.getElementById("payoutAdvanceCard"),
  payoutSalaryCard: document.getElementById("payoutSalaryCard"),
  advanceLabel: document.getElementById("advanceLabel"),
  salaryLabel: document.getElementById("salaryLabel"),
  statAdvanceIncome: document.getElementById("statAdvanceIncome"),
  statAdvanceMeta: document.getElementById("statAdvanceMeta"),
  statSalaryIncome: document.getElementById("statSalaryIncome"),
  statSalaryMeta: document.getElementById("statSalaryMeta"),

  // Календарь и триггер смен
  calendarGrid: document.getElementById("calendarGrid"),
  openShiftsBtn: document.getElementById("openShiftsBtn"),
  statShiftsBadge: document.getElementById("statShiftsBadge"),

  // Модальное окно деталей смен (Шторка)
  shiftsModal: document.getElementById("shiftsModal"),
  shiftsModalTitle: document.getElementById("shiftsModalTitle"),
  shiftsModalMonth: document.getElementById("shiftsModalMonth"),
  shiftsModalCloseBtn: document.getElementById("shiftsModalCloseBtn"),
  shiftsFilterSegmented: document.getElementById("shiftsFilterSegmented"),
  shiftsFilterInput: document.getElementById("shiftsFilterInput"),
  filterAdvanceBtn: document.getElementById("filterAdvanceBtn"),
  filterSalaryBtn: document.getElementById("filterSalaryBtn"),
  shiftList: document.getElementById("shiftList"),

  // Экспорт
  exportMonthBtn: document.getElementById("exportMonthBtn"),
  exportAllBtn: document.getElementById("exportAllBtn"),

  // Модальное окно смены
  shiftModal: document.getElementById("shiftModal"),
  shiftModalTitle: document.getElementById("shiftModalTitle"),
  shiftModalCloseBtn: document.getElementById("shiftModalCloseBtn"),
  shiftForm: document.getElementById("shiftForm"),
  shiftDate: document.getElementById("shiftDate"),
  shiftType: document.getElementById("shiftType"),
  shiftTypeSegmented: document.getElementById("shiftTypeSegmented"),
  presetTimeDay: document.getElementById("presetTimeDay"),
  presetTimeNight: document.getElementById("presetTimeNight"),
  presetTimeExtra: document.getElementById("presetTimeExtra"),
  startTime: document.getElementById("startTime"),
  endTime: document.getElementById("endTime"),
  breakMins: document.getElementById("breakMins"),
  totalHours: document.getElementById("totalHours"),
  payMode: document.getElementById("payMode"),
  payModeSegmented: document.getElementById("payModeSegmented"),
  rateLabel: document.getElementById("rateLabel"),
  rate: document.getElementById("rate"),
  bonus: document.getElementById("bonus"),
  totalPay: document.getElementById("totalPay"),
  note: document.getElementById("note"),
  deleteBtn: document.getElementById("deleteBtn"),

  // Модальное окно настроек
  settingsModal: document.getElementById("settingsModal"),
  settingsModalCloseBtn: document.getElementById("settingsModalCloseBtn"),
  settingsForm: document.getElementById("settingsForm"),
  settingsPresetSegmented: document.getElementById("settingsPresetSegmented"),
  settingsActivePreset: document.getElementById("settingsActivePreset"),
  defStart: document.getElementById("defStart"),
  defEnd: document.getElementById("defEnd"),
  defBreak: document.getElementById("defBreak"),
  defPayMode: document.getElementById("defPayMode"),
  defPayModeSegmented: document.getElementById("defPayModeSegmented"),
  defRate: document.getElementById("defRate"),
  defCurrency: document.getElementById("defCurrency"),
  defCutoffDay: document.getElementById("defCutoffDay"),
  defMonthlyGoal: document.getElementById("defMonthlyGoal"),

  // Модальное окно автозаполнения графика
  scheduleModal: document.getElementById("scheduleModal"),
  scheduleModalTitle: document.getElementById("scheduleModalTitle"),
  scheduleModalCloseBtn: document.getElementById("scheduleModalCloseBtn"),
  scheduleForm: document.getElementById("scheduleForm"),
  scheduleStartDate: document.getElementById("scheduleStartDate"),
  schedulePatternGrid: document.getElementById("schedulePatternGrid"),
  selectedPattern: document.getElementById("selectedPattern"),
  customPatternGroup: document.getElementById("customPatternGroup"),
  customPatternBuilder: document.getElementById("customPatternBuilder"),
  customPatternLabel: document.getElementById("customPatternLabel"),
  customResetBtn: document.getElementById("customResetBtn"),
  scheduleDurationSegmented: document.getElementById("scheduleDurationSegmented"),
  scheduleDuration: document.getElementById("scheduleDuration"),
  scheduleSkipExisting: document.getElementById("scheduleSkipExisting"),
  schedulePreviewText: document.getElementById("schedulePreviewText"),
  applyScheduleBtn: document.getElementById("applyScheduleBtn"),

  // Бэкап
  backupDownloadBtn: document.getElementById("backupDownloadBtn"),
  backupRestoreBtn: document.getElementById("backupRestoreBtn"),
  importFile: document.getElementById("importFile"),

  // Кастомный диалог подтверждения и тосты
  confirmModal: document.getElementById("confirmModal"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmIcon: document.getElementById("confirmIcon"),
  confirmOkBtn: document.getElementById("confirmOkBtn"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  appToast: document.getElementById("appToast"),
};

// ============================================================
// Утилиты
// ============================================================

/** Экранирование HTML-спецсимволов для защиты от XSS */
function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function calcHoursDiff(start, end, breakMins) {
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

/** Склонение русских числительных (1 смена, 2 смены, 5 смен) */
function getRussianDeclension(number, forms) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

/** Скачать blob-файл и освободить ObjectURL */
function triggerDownload(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Тактильный виброотклик (Haptic Feedback) для PWA */
function triggerHaptic(pattern = 10) {
  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (_) {}
  }
}

// ============================================================
// Сегментированные переключатели (Pill Switchers)
// ============================================================
function updateSegmentedUI(container, value) {
  if (!container) return;
  container.querySelectorAll(".segmented-control__btn, .shift-preset-btn").forEach((btn) => {
    const isActive = btn.dataset.value === value;
    btn.classList.toggle("is-active", isActive);
    btn.setAttribute("aria-checked", isActive ? "true" : "false");
  });
}

function setSegmentedValue(containerId, inputId, value, triggerChange = false) {
  const container = document.getElementById(containerId);
  const input = document.getElementById(inputId);
  if (input) input.value = value;
  if (container) updateSegmentedUI(container, value);
  if (triggerChange && input) {
    input.dispatchEvent(new Event("change"));
  }
}

function updatePresetTimesUI() {
  const p = settings.presets || DEFAULT_PRESETS;
  if (elements.presetTimeDay) {
    elements.presetTimeDay.textContent = `${p.day.start}–${p.day.end}`;
  }
  if (elements.presetTimeNight) {
    elements.presetTimeNight.textContent = `${p.night.start}–${p.night.end}`;
  }
  if (elements.presetTimeExtra) {
    elements.presetTimeExtra.textContent = `${p.extra.start}–${p.extra.end}`;
  }
}

function applyPresetToModal(type) {
  const p = settings.presets?.[type] || DEFAULT_PRESETS[type] || DEFAULT_PRESETS.day;
  elements.startTime.value = p.start;
  elements.endTime.value = p.end;
  elements.breakMins.value = p.breakMins;
  recalcModal();
}

function updatePayModeLabels() {
  const curr = settings.currency || "₽";
  const hourlyBtn = document.getElementById("payModeHourlyBtn");
  const fixedBtn = document.getElementById("payModeFixedBtn");
  if (hourlyBtn) hourlyBtn.textContent = `${curr}/час`;
  if (fixedBtn) fixedBtn.textContent = `${curr}/смена`;

  const defHourlyBtn = document.getElementById("defPayModeHourlyBtn");
  const defFixedBtn = document.getElementById("defPayModeFixedBtn");
  if (defHourlyBtn) defHourlyBtn.textContent = `${curr}/час`;
  if (defFixedBtn) defFixedBtn.textContent = `${curr}/смена`;
}

let currentShiftsFilter = "all"; // "all" | "advance" | "salary"
let currentMonthShiftsCache = [];

function initSegmentedControls() {
  const configs = [
    {
      containerId: "shiftTypeSegmented",
      inputId: "shiftType",
      onChange: (val) => {
        applyPresetToModal(val);
        triggerHaptic(12);
      },
    },
    {
      containerId: "payModeSegmented",
      inputId: "payMode",
      onChange: () => recalcModal(),
    },
    {
      containerId: "shiftsFilterSegmented",
      inputId: "shiftsFilterInput",
      onChange: (val) => {
        currentShiftsFilter = val;
        renderShiftList(currentMonthShiftsCache, currentDate.getMonth());
        triggerHaptic(10);
      },
    },
    {
      containerId: "settingsPresetSegmented",
      inputId: "settingsActivePreset",
      onChange: (newPreset) => {
        saveCurrentSettingsInputsToTemp();
        currentSettingsPreset = newPreset;
        loadPresetIntoSettingsInputs(newPreset);
        triggerHaptic(12);
      },
    },
    {
      containerId: "defPayModeSegmented",
      inputId: "defPayMode",
      onChange: null,
    },
    {
      containerId: "scheduleDurationSegmented",
      inputId: "scheduleDuration",
      onChange: () => {
        updateSchedulePreview();
        triggerHaptic(10);
      },
    },
  ];

  configs.forEach(({ containerId, inputId, onChange }) => {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (!container || !input) return;

    container.querySelectorAll(".segmented-control__btn, .shift-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.value;
        input.value = val;
        updateSegmentedUI(container, val);
        if (onChange) onChange(val);
      });
    });
  });

  updatePayModeLabels();
  updatePresetTimesUI();
}

// ============================================================
// Навигация по месяцам
// ============================================================
function changeMonth(delta) {
  animateMonthSwipe(delta);
}

function goToToday() {
  const today = new Date();
  const isCurrent =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();

  if (isCurrent) {
    const todayCell = document.querySelector(".calendar__day-cell--today");
    if (todayCell) {
      todayCell.classList.remove("calendar__day-cell--pulse");
      void todayCell.offsetWidth;
      todayCell.classList.add("calendar__day-cell--pulse");
    }
    return;
  }

  const delta =
    today.getFullYear() > currentDate.getFullYear() ||
    (today.getFullYear() === currentDate.getFullYear() &&
      today.getMonth() > currentDate.getMonth())
      ? 1
      : -1;

  animateMonthSwipe(delta, today);
  setTimeout(() => {
    const todayCell = document.querySelector(".calendar__day-cell--today");
    if (todayCell) {
      todayCell.classList.add("calendar__day-cell--pulse");
    }
  }, 220);
}

// ============================================================
// Пересчёт модалки смены
// ============================================================
function recalcModal() {
  const start = elements.startTime.value;
  const end = elements.endTime.value;
  const breakMins = elements.breakMins.value;
  const payMode = elements.payMode.value;
  const rate = parseFloat(elements.rate.value) || 0;
  const bonus = parseFloat(elements.bonus.value) || 0;

  elements.rateLabel.textContent =
    payMode === "hourly"
      ? `Ставка в час (${settings.currency})`
      : `За смену (${settings.currency})`;

  const hours = calcHoursDiff(start, end, breakMins);
  elements.totalHours.value = hours;

  const basePay = payMode === "hourly" ? hours * rate : rate;
  elements.totalPay.value = Math.round(basePay + bonus);
}

// ============================================================
// Модальные окна
// ============================================================
function openModal(id) {
  const modal = elements[id] || document.getElementById(id);
  if (modal) {
    const content = modal.querySelector(".modal-overlay__content");
    if (content) {
      content.style.transform = "";
      content.style.transition = "";
    }
    modal.style.backgroundColor = "";
    modal.classList.add("active");
    document.body.classList.add("modal-open");
  }
}

function closeModal(id) {
  const modal = elements[id] || document.getElementById(id);
  if (modal) {
    const content = modal.querySelector(".modal-overlay__content");
    if (content) {
      content.style.transform = "";
      content.style.transition = "";
    }
    modal.style.backgroundColor = "";
    modal.classList.remove("active");
  }
  const hasActiveModal = document.querySelector(".modal-overlay.active");
  if (!hasActiveModal) {
    document.body.classList.remove("modal-open");
  }
}

// ============================================================
// Всплывающие уведомления (Тосты) и диалог подтверждения
// ============================================================
let toastTimer = null;

function showToast(message, type = "info", action = null) {
  const toast = elements.appToast;
  if (!toast) return;

  const iconEl = toast.querySelector(".app-toast__icon");
  const msgEl = toast.querySelector(".app-toast__message");

  msgEl.textContent = message;

  // Очищаем старую кнопку действия
  const oldAction = toast.querySelector(".app-toast__action");
  if (oldAction) oldAction.remove();

  if (action && typeof action.onClick === "function") {
    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "app-toast__action";
    actionBtn.textContent = action.label || "Отменить";
    actionBtn.addEventListener("click", () => {
      toast.classList.remove("active");
      action.onClick();
    });
    toast.appendChild(actionBtn);
  }

  toast.className = `app-toast app-toast--${type} active`;

  if (type === "success") {
    iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  } else if (type === "error") {
    iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  } else {
    iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
  }

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, action ? 5000 : 3000);
}

function showConfirm({
  title = "Подтверждение",
  message = "Вы уверены?",
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  type = "danger",
} = {}) {
  return new Promise((resolve) => {
    const overlay = elements.confirmModal;
    const titleEl = elements.confirmTitle;
    const messageEl = elements.confirmMessage;
    const iconEl = elements.confirmIcon;
    const okBtn = elements.confirmOkBtn;
    const cancelBtn = elements.confirmCancelBtn;

    titleEl.textContent = title;
    messageEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    okBtn.className = `btn modal__dialog-btn ${type === "danger" ? "btn--danger" : "btn--primary"}`;

    if (type === "danger") {
      iconEl.className = "modal__dialog-icon modal__dialog-icon--danger";
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
    } else {
      iconEl.className = "modal__dialog-icon modal__dialog-icon--info";
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }

    const cleanup = () => {
      overlay.classList.remove("active");
      const hasOtherModal = document.querySelector(".modal-overlay.active:not(#confirmModal)");
      if (!hasOtherModal) {
        document.body.classList.remove("modal-open");
      }
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKeyDown, true);
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onOverlay = (e) => {
      if (e.target === overlay) {
        onCancel();
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onOk();
      }
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKeyDown, true);

    document.body.classList.add("modal-open");
    overlay.classList.add("active");
    cancelBtn.focus();
  });
}

function openShiftModal(dateKey) {
  closeModal("shiftsModal");
  updatePayModeLabels();
  updatePresetTimesUI();
  const existing = shifts[dateKey];
  const [y, m, d] = dateKey.split("-");
  elements.shiftModalTitle.textContent = `Смена ${d}.${m}.${y}`;
  elements.shiftDate.value = dateKey;

  if (existing) {
    setSegmentedValue("shiftTypeSegmented", "shiftType", existing.type || "day");
    elements.startTime.value = existing.start;
    elements.endTime.value = existing.end;
    elements.breakMins.value = existing.breakMins ?? 0;
    elements.totalHours.value = existing.hours;
    setSegmentedValue("payModeSegmented", "payMode", existing.payMode || "hourly");
    elements.rate.value = existing.rate;
    elements.bonus.value = existing.bonus || 0;
    elements.totalPay.value = existing.totalPay;
    elements.note.value = existing.note || "";
    elements.deleteBtn.style.display = "block";
    recalcModal();
  } else {
    setSegmentedValue("shiftTypeSegmented", "shiftType", "day");
    const p = settings.presets?.day || DEFAULT_PRESETS.day;
    elements.startTime.value = p.start;
    elements.endTime.value = p.end;
    elements.breakMins.value = p.breakMins;
    setSegmentedValue("payModeSegmented", "payMode", settings.payMode);
    elements.rate.value = settings.rate;
    elements.bonus.value = 0;
    elements.note.value = "";
    elements.deleteBtn.style.display = "none";
    recalcModal();
  }

  openModal("shiftModal");
}

function saveShift(e) {
  e.preventDefault();
  const dateKey = elements.shiftDate.value;
  shifts[dateKey] = {
    type: elements.shiftType.value,
    start: elements.startTime.value,
    end: elements.endTime.value,
    breakMins: Number(elements.breakMins.value) || 0,
    hours: parseFloat(elements.totalHours.value) || 0,
    payMode: elements.payMode.value,
    rate: parseFloat(elements.rate.value) || 0,
    bonus: parseFloat(elements.bonus.value) || 0,
    totalPay: parseFloat(elements.totalPay.value) || 0,
    note: elements.note.value.trim(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  closeModal("shiftModal");
  render();
  triggerHaptic(15);
  showToast("Смена сохранена", "success");
}

async function deleteShift() {
  const confirmed = await showConfirm({
    title: "Удалить смену?",
    message: "Смена будет удалена без возможности восстановления.",
    confirmText: "Удалить",
    cancelText: "Отмена",
    type: "danger",
  });
  if (!confirmed) return;
  const dateKey = elements.shiftDate.value;
  delete shifts[dateKey];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  closeModal("shiftModal");
  render();
  triggerHaptic(20);
  showToast("Смена удалена", "info");
}

// ============================================================
// Настройки
// ============================================================
let currentSettingsPreset = "day";
let tempPresets = {};

function openSettings() {
  updatePayModeLabels();
  tempPresets = JSON.parse(JSON.stringify(settings.presets || DEFAULT_PRESETS));
  currentSettingsPreset = "day";
  setSegmentedValue("settingsPresetSegmented", "settingsActivePreset", "day");
  loadPresetIntoSettingsInputs("day");

  setSegmentedValue("defPayModeSegmented", "defPayMode", settings.payMode || "hourly");
  elements.defRate.value = settings.rate;
  elements.defCurrency.value = settings.currency || "₽";
  elements.defCutoffDay.value = settings.advanceCutoffDay || 15;
  if (elements.defMonthlyGoal) {
    elements.defMonthlyGoal.value = settings.monthlyGoal ? settings.monthlyGoal : "";
  }
  openModal("settingsModal");
}

function loadPresetIntoSettingsInputs(type) {
  const p = tempPresets[type] || DEFAULT_PRESETS[type];
  elements.defStart.value = p.start;
  elements.defEnd.value = p.end;
  elements.defBreak.value = p.breakMins;
}

function saveCurrentSettingsInputsToTemp() {
  if (!tempPresets[currentSettingsPreset]) {
    tempPresets[currentSettingsPreset] = { ...DEFAULT_PRESETS[currentSettingsPreset] };
  }
  tempPresets[currentSettingsPreset].start = elements.defStart.value || DEFAULT_PRESETS[currentSettingsPreset].start;
  tempPresets[currentSettingsPreset].end = elements.defEnd.value || DEFAULT_PRESETS[currentSettingsPreset].end;
  tempPresets[currentSettingsPreset].breakMins = Number(elements.defBreak.value) || 0;
}

function saveSettings(e) {
  e.preventDefault();
  saveCurrentSettingsInputsToTemp();

  settings.presets = tempPresets;
  settings.start = tempPresets.day.start;
  settings.end = tempPresets.day.end;
  settings.breakMins = tempPresets.day.breakMins;
  settings.payMode = elements.defPayMode.value;
  settings.rate = parseFloat(elements.defRate.value) || 0;
  settings.currency = elements.defCurrency.value.trim() || "₽";
  settings.advanceCutoffDay = Math.min(28, Math.max(1, parseInt(elements.defCutoffDay.value, 10) || 15));
  settings.monthlyGoal = elements.defMonthlyGoal ? Math.max(0, parseFloat(elements.defMonthlyGoal.value) || 0) : (settings.monthlyGoal || 0);

  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  updatePayModeLabels();
  updatePresetTimesUI();
  closeModal("settingsModal");
  render();
  triggerHaptic(15);
  showToast("Настройки и шаблоны сохранены", "success");
}

// ============================================================
// Автозаполнение графиков (Генератор 2/2, 3/3, 5/2 и др.)
// ============================================================
const SCHEDULE_PATTERNS = {
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

let customCycle = ["day", "night", "off", "off"];
let lastScheduleSnapshot = null;

function openScheduleModal() {
  const y = currentDate.getFullYear();
  const m = String(currentDate.getMonth() + 1).padStart(2, "0");
  elements.scheduleStartDate.value = `${y}-${m}-01`;

  elements.selectedPattern.value = "2-2-day";
  if (elements.schedulePatternGrid) {
    elements.schedulePatternGrid.querySelectorAll(".schedule-pattern-btn").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.pattern === "2-2-day");
    });
  }
  if (elements.customPatternGroup) {
    elements.customPatternGroup.style.display = "none";
  }

  setSegmentedValue("scheduleDurationSegmented", "scheduleDuration", "1");
  elements.scheduleSkipExisting.checked = true;

  updateCustomPatternBuilderUI();
  updateSchedulePreview();
  openModal("scheduleModal");
}

function updateCustomPatternBuilderUI() {
  const container = elements.customPatternBuilder;
  if (!container) return;

  if (customCycle.length === 0) {
    container.innerHTML = '<span style="color: var(--text-muted); font-size: 0.8rem;">Нажмите кнопки ниже, чтобы составить цикл</span>';
    return;
  }

  container.innerHTML = "";
  customCycle.forEach((type, idx) => {
    const chip = document.createElement("span");
    chip.className = `custom-pattern-chip custom-pattern-chip--${type}`;
    let icon = "⚪";
    let title = "Вых";
    if (type === "day") {
      icon = "☀️";
      title = "День";
    } else if (type === "night") {
      icon = "🌙";
      title = "Ночь";
    }

    chip.innerHTML = `${icon} ${title} <span style="font-size: 0.7rem; opacity: 0.6; margin-left: 2px;">✕</span>`;
    chip.title = "Нажмите, чтобы удалить день из цикла";
    chip.addEventListener("click", () => {
      customCycle.splice(idx, 1);
      updateCustomPatternBuilderUI();
      updateSchedulePreview();
      triggerHaptic(8);
    });
    container.appendChild(chip);
  });
}

function calculateScheduleDates() {
  const startStr = elements.scheduleStartDate.value;
  if (!startStr) return [];

  const [sy, sm, sd] = startStr.split("-").map(Number);
  const startDate = new Date(sy, sm - 1, sd);
  const durationMonths = parseInt(elements.scheduleDuration.value, 10) || 1;
  const skipExisting = elements.scheduleSkipExisting.checked;
  const patternKey = elements.selectedPattern.value;
  const pattern = SCHEDULE_PATTERNS[patternKey] || SCHEDULE_PATTERNS["2-2-day"];

  const endDate = new Date(startDate);
  endDate.setMonth(endDate.getMonth() + durationMonths);
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
      type = (dayOfWeek >= 1 && dayOfWeek <= 5) ? "day" : "off";
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

function updateSchedulePreview() {
  const previewEl = elements.schedulePreviewText;
  if (!previewEl) return;

  const planned = calculateScheduleDates();
  if (planned.length === 0) {
    previewEl.innerHTML = "Нет смен для добавления в выбранном периоде.";
    return;
  }

  const durationMonths = parseInt(elements.scheduleDuration.value, 10) || 1;
  const dayCount = planned.filter((s) => s.type === "day").length;
  const nightCount = planned.filter((s) => s.type === "night").length;

  const presets = settings.presets || DEFAULT_PRESETS;
  const rate = parseFloat(settings.rate) || 0;
  const payMode = settings.payMode || "hourly";

  let estTotal = 0;
  planned.forEach((s) => {
    const p = presets[s.type] || presets.day;
    const hours = calcHoursDiff(p.start, p.end, p.breakMins);
    const pay = payMode === "hourly" ? hours * rate : rate;
    estTotal += Math.round(pay);
  });

  const durationStr = durationMonths === 1 ? "1 месяц" : `${durationMonths} месяца`;
  let breakdown = [];
  if (dayCount > 0) breakdown.push(`${dayCount} дневных`);
  if (nightCount > 0) breakdown.push(`${nightCount} ночных`);

  previewEl.innerHTML = `Будет добавлено <strong>${planned.length} смен</strong> (${breakdown.join(", ")}) на <strong>${durationStr}</strong>.<br>Прогнозируемый доход: ~<strong>${estTotal.toLocaleString("ru-RU")} ${settings.currency}</strong>.`;
}

function applySchedule(e) {
  e.preventDefault();
  const planned = calculateScheduleDates();
  if (planned.length === 0) {
    showToast("Нет смен для добавления", "info");
    return;
  }

  // Снимок для функции "Отменить"
  lastScheduleSnapshot = JSON.parse(JSON.stringify(shifts));

  const presets = settings.presets || DEFAULT_PRESETS;
  const rate = parseFloat(settings.rate) || 0;
  const payMode = settings.payMode || "hourly";

  planned.forEach((s) => {
    const p = presets[s.type] || presets.day;
    const hours = calcHoursDiff(p.start, p.end, p.breakMins);
    const basePay = payMode === "hourly" ? hours * rate : rate;

    shifts[s.dateKey] = {
      type: s.type,
      start: p.start,
      end: p.end,
      breakMins: p.breakMins,
      hours: hours,
      payMode: payMode,
      rate: rate,
      bonus: 0,
      totalPay: Math.round(basePay),
      note: "",
    };
  });

  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  closeModal("scheduleModal");
  render();
  triggerHaptic([30, 40, 50]);

  showToast(`График заполнен (+${planned.length} смен)!`, "success", {
    label: "Отменить",
    onClick: () => {
      if (lastScheduleSnapshot) {
        shifts = lastScheduleSnapshot;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
        render();
        triggerHaptic(15);
        showToast("Автозаполнение отменено", "info");
      }
    },
  });
}

function quickAddDefaultShift(dateKey) {
  if (shifts[dateKey]) return;

  const preset = settings.presets?.day || DEFAULT_PRESETS.day;
  const hours = calcHoursDiff(preset.start, preset.end, preset.breakMins);
  const rate = parseFloat(settings.rate) || 0;
  const basePay = settings.payMode === "hourly" ? hours * rate : rate;

  shifts[dateKey] = {
    type: "day",
    start: preset.start,
    end: preset.end,
    breakMins: preset.breakMins,
    hours: hours,
    payMode: settings.payMode || "hourly",
    rate: rate,
    bonus: 0,
    totalPay: Math.round(basePay),
    note: "",
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  triggerHaptic([30, 40, 30]);
  render();

  setTimeout(() => {
    const updatedCell = document.querySelector(`.calendar__day-cell[data-date-key="${dateKey}"]`);
    if (updatedCell) {
      updatedCell.classList.add("calendar__day-cell--pulse");
    }
  }, 40);

  const [y, m, d] = dateKey.split("-");
  const monthName = MONTH_NAMES_GENITIVE[parseInt(m, 10) - 1];
  showToast(`Смена добавлена: ${parseInt(d, 10)} ${monthName} (${preset.start}–${preset.end})`, "success");
}

// ============================================================
// Рендер
// ============================================================
function render() {
  if (window.scrollX !== 0) {
    window.scrollTo(0, window.scrollY);
  }
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  elements.monthTitle.textContent = `${MONTH_NAMES[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Пн = 0

  const today = new Date();
  const todayKey = formatDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const cutoffDay = settings.advanceCutoffDay || 15;
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

  // Собираем ячейки через DocumentFragment для одной вставки в DOM
  const fragment = document.createDocumentFragment();

  function createDayCell({
    day,
    dateKey,
    isOtherMonth = false,
    isWeekend = false,
    isToday = false,
    ariaLabel = "",
    onShift = null,
  }) {
    const shift = shifts[dateKey];
    const cell = document.createElement("div");
    cell.className = "calendar__day-cell";
    cell.dataset.dateKey = dateKey;
    if (isOtherMonth) cell.classList.add("calendar__day-cell--other-month");
    if (isToday) cell.classList.add("calendar__day-cell--today");
    if (isWeekend) cell.classList.add("calendar__day-cell--weekend");

    const dayHeader = document.createElement("div");
    dayHeader.className = "calendar__day-header";

    const dayNum = document.createElement("div");
    dayNum.className = "calendar__day-number";
    dayNum.textContent = day;
    dayHeader.appendChild(dayNum);

    if (shift) {
      cell.classList.add("calendar__day-cell--has-shift");
      if (shift.type === "night")
        cell.classList.add("calendar__day-cell--night");
      if (shift.type === "extra")
        cell.classList.add("calendar__day-cell--extra");

      const iconSpan = document.createElement("span");
      iconSpan.className = "calendar__shift-icon";
      iconSpan.setAttribute("aria-hidden", "true");
      iconSpan.innerHTML = getShiftIconSvg(shift.type);
      dayHeader.appendChild(iconSpan);

      const badge = document.createElement("div");
      badge.className = "calendar__shift-badge";
      badge.textContent = `${shift.hours}ч`;
      cell.appendChild(dayHeader);
      cell.appendChild(badge);

      if (onShift) {
        onShift(shift);
      }
    } else {
      cell.appendChild(dayHeader);
    }

    cell.setAttribute("role", "button");
    cell.setAttribute("tabindex", "0");
    if (ariaLabel) cell.setAttribute("aria-label", ariaLabel);

    let touchStartX = 0;
    let touchStartY = 0;
    let longPressTimeout = null;
    let isLongPressTriggered = false;

    const startLongPress = (e) => {
      if (shifts[dateKey]) return;
      isLongPressTriggered = false;
      const touch = e.touches ? e.touches[0] : e;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;

      longPressTimeout = setTimeout(() => {
        isLongPressTriggered = true;
        quickAddDefaultShift(dateKey);
      }, 420);
    };

    const cancelLongPress = () => {
      if (longPressTimeout) {
        clearTimeout(longPressTimeout);
        longPressTimeout = null;
      }
    };

    const moveLongPress = (e) => {
      if (!longPressTimeout) return;
      const touch = e.touches ? e.touches[0] : e;
      const dx = Math.abs(touch.clientX - touchStartX);
      const dy = Math.abs(touch.clientY - touchStartY);
      if (dx > 10 || dy > 10) {
        cancelLongPress();
      }
    };

    cell.addEventListener("touchstart", startLongPress, { passive: true });
    cell.addEventListener("touchmove", moveLongPress, { passive: true });
    cell.addEventListener("touchend", cancelLongPress, { passive: true });
    cell.addEventListener("touchcancel", cancelLongPress, { passive: true });

    cell.addEventListener("contextmenu", (e) => {
      if (!shifts[dateKey]) {
        e.preventDefault();
        quickAddDefaultShift(dateKey);
      }
    });

    cell.addEventListener("click", () => {
      if (isLongPressTriggered) {
        isLongPressTriggered = false;
        return;
      }
      openShiftModal(dateKey);
    });

    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openShiftModal(dateKey);
      }
    });

    return cell;
  }

  // Дни предыдущего месяца для заполнения пустых мест
  const prevMonthDate = new Date(year, month - 1, 1);
  const prevMonthYear = prevMonthDate.getFullYear();
  const prevMonthIdx = prevMonthDate.getMonth();
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i--) {
    const prevDay = prevMonthLastDate - i;
    const dateKey = formatDateKey(prevMonthYear, prevMonthIdx, prevDay);
    const colIndex = startOffset - 1 - i;
    const isWeekend = colIndex === 5 || colIndex === 6;

    fragment.appendChild(
      createDayCell({
        day: prevDay,
        dateKey,
        isOtherMonth: true,
        isWeekend,
        isToday: dateKey === todayKey,
        ariaLabel: `Предыдущий месяц, ${prevDay}`,
      })
    );
  }

  // Дни текущего месяца
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(year, month, day);
    const dayOfWeek = (startOffset + day - 1) % 7;
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    fragment.appendChild(
      createDayCell({
        day,
        dateKey,
        isOtherMonth: false,
        isWeekend,
        isToday: dateKey === todayKey,
        onShift: (shift) => {
          totalShifts++;
          const h = Number(shift.hours) || 0;
          const p = Number(shift.totalPay) || 0;
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
        },
      })
    );
  }

  // Дни следующего месяца для завершения сетки
  const totalCells = startOffset + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  const nextMonthDate = new Date(year, month + 1, 1);
  const nextMonthYear = nextMonthDate.getFullYear();
  const nextMonthIdx = nextMonthDate.getMonth();

  for (let d = 1; d <= remainingCells; d++) {
    const dateKey = formatDateKey(nextMonthYear, nextMonthIdx, d);
    const colIndex = (totalCells + d - 1) % 7;
    const isWeekend = colIndex === 5 || colIndex === 6;

    fragment.appendChild(
      createDayCell({
        day: d,
        dateKey,
        isOtherMonth: true,
        isWeekend,
        isToday: dateKey === todayKey,
        ariaLabel: `Следующий месяц, ${d}`,
      })
    );
  }

  const grid = elements.calendarGrid;
  grid.innerHTML = "";
  grid.appendChild(fragment);

  elements.statShifts.textContent = totalShifts;
  elements.statHours.textContent = Math.round(totalHours * 100) / 100;
  elements.statIncome.textContent = `${totalIncome.toLocaleString("ru-RU")} ${settings.currency}`;
  elements.statIncome.title = elements.statIncome.textContent;

  // Обновление карточек выплат (Аванс и Расчёт)
  const curr = settings.currency || "₽";
  if (elements.advanceLabel) {
    elements.advanceLabel.textContent = `Аванс (1–${cutoffDay})`;
  }
  if (elements.salaryLabel) {
    elements.salaryLabel.textContent = `Расчёт (${cutoffDay + 1}–${daysInMonth})`;
  }
  if (elements.statAdvanceIncome) {
    elements.statAdvanceIncome.textContent = `${advanceIncome.toLocaleString("ru-RU")} ${curr}`;
    elements.statAdvanceIncome.title = elements.statAdvanceIncome.textContent;
  }
  if (elements.statAdvanceMeta) {
    elements.statAdvanceMeta.textContent = `${advanceShiftsCount} см • ${Math.round(advanceHours * 10) / 10} ч`;
  }
  if (elements.statSalaryIncome) {
    elements.statSalaryIncome.textContent = `${salaryIncome.toLocaleString("ru-RU")} ${curr}`;
    elements.statSalaryIncome.title = elements.statSalaryIncome.textContent;
  }
  if (elements.statSalaryMeta) {
    elements.statSalaryMeta.textContent = `${salaryShiftsCount} см • ${Math.round(salaryHours * 10) / 10} ч`;
  }
  if (elements.filterAdvanceBtn) {
    elements.filterAdvanceBtn.textContent = `Аванс (1–${cutoffDay})`;
  }
  if (elements.filterSalaryBtn) {
    elements.filterSalaryBtn.textContent = `Расчёт (${cutoffDay + 1}–${daysInMonth})`;
  }

  if (elements.statShiftsBadge) {
    if (totalShifts > 0) {
      const avgPay = Math.round(totalIncome / totalShifts);
      elements.statShiftsBadge.textContent = `~${avgPay.toLocaleString("ru-RU")} ${settings.currency} / смена`;
      elements.statShiftsBadge.style.display = "inline-flex";
    } else {
      elements.statShiftsBadge.style.display = "none";
    }
  }
  if (elements.shiftsModalMonth) {
    elements.shiftsModalMonth.textContent = `${MONTH_NAMES[month]} ${year}`;
  }

  // Индикация на кнопке «Сегодня», если просматривается не текущий месяц
  const isCurrentMonth =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();
  if (elements.todayBtn) {
    elements.todayBtn.classList.toggle("header__today-btn--active", !isCurrentMonth);
    elements.todayBtn.title = isCurrentMonth
      ? "Текущий месяц"
      : `Вернуться к ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
  }

  // Обновление финансовой цели ("Копилка")
  updateGoalTrackerUI(totalIncome, totalShifts);

  currentMonthShiftsCache = monthShifts;
  renderShiftList(monthShifts, month);
}

/** Обновление виджета финансовой цели на месяц ("Копилка") */
function updateGoalTrackerUI(totalIncome, totalShifts) {
  if (!elements.goalTracker) return;

  const goal = settings.monthlyGoal || 0;
  const curr = settings.currency || "₽";

  if (goal <= 0) {
    elements.goalTracker.classList.remove("goal-tracker--completed");
    if (elements.goalProgressText) elements.goalProgressText.textContent = `0 ${curr}`;
    if (elements.goalPercentage) elements.goalPercentage.textContent = "0%";
    if (elements.goalProgressBar) {
      elements.goalProgressBar.style.width = "0%";
      elements.goalProgressBar.classList.remove("goal-tracker__bar--completed");
    }
    if (elements.goalStatusText) {
      elements.goalStatusText.textContent = "🎯 Поставьте цель заработка на месяц";
    }
    if (elements.goalActionHint) elements.goalActionHint.textContent = "Включить ⚙️";
    return;
  }

  const percent = Math.round((totalIncome / goal) * 100);
  const clampedWidth = Math.min(100, Math.max(0, percent));

  if (elements.goalProgressText) {
    elements.goalProgressText.textContent = `${totalIncome.toLocaleString("ru-RU")} / ${goal.toLocaleString("ru-RU")} ${curr}`;
  }
  if (elements.goalPercentage) {
    elements.goalPercentage.textContent = `${percent}%`;
  }
  if (elements.goalProgressBar) {
    elements.goalProgressBar.style.width = `${clampedWidth}%`;
  }

  if (percent >= 100) {
    elements.goalTracker.classList.add("goal-tracker--completed");
    if (elements.goalProgressBar) {
      elements.goalProgressBar.classList.add("goal-tracker__bar--completed");
    }
    const surplus = totalIncome - goal;
    if (elements.goalStatusText) {
      if (surplus > 0) {
        elements.goalStatusText.textContent = `🎉 Цель выполнена! Перевыполнение: +${surplus.toLocaleString("ru-RU")} ${curr}`;
      } else {
        elements.goalStatusText.textContent = "🎉 Цель достигнута на 100%! Отличная работа!";
      }
    }
    if (elements.goalActionHint) elements.goalActionHint.textContent = "Изменить ⚙️";
  } else {
    elements.goalTracker.classList.remove("goal-tracker--completed");
    if (elements.goalProgressBar) {
      elements.goalProgressBar.classList.remove("goal-tracker__bar--completed");
    }
    const remaining = goal - totalIncome;

    // Оценка необходимого количества смен
    let avgShiftPay = 0;
    if (totalShifts > 0 && totalIncome > 0) {
      avgShiftPay = totalIncome / totalShifts;
    } else {
      if (settings.payMode === "hourly") {
        const dayPreset = settings.presets?.day || DEFAULT_PRESETS.day;
        const h = calcHoursDiff(dayPreset.start, dayPreset.end, dayPreset.breakMins) || 11;
        avgShiftPay = h * (settings.rate || 300);
      } else {
        avgShiftPay = settings.rate || 3000;
      }
    }

    if (elements.goalStatusText) {
      if (avgShiftPay > 0) {
        const neededShifts = Math.max(1, Math.ceil(remaining / avgShiftPay));
        const shiftWord = getRussianDeclension(neededShifts, ["смена", "смены", "смен"]);
        elements.goalStatusText.textContent = `Осталось: ${remaining.toLocaleString("ru-RU")} ${curr} (~${neededShifts} ${shiftWord})`;
      } else {
        elements.goalStatusText.textContent = `Осталось заработать: ${remaining.toLocaleString("ru-RU")} ${curr}`;
      }
    }
    if (elements.goalActionHint) elements.goalActionHint.textContent = "Изменить ⚙️";
  }
}

function renderShiftList(monthShifts, month) {
  const listEl = elements.shiftList;
  if (!listEl) return;

  const cutoffDay = settings.advanceCutoffDay || 15;
  const daysInMonth = new Date(currentDate.getFullYear(), month + 1, 0).getDate();

  let filteredShifts = monthShifts;
  if (currentShiftsFilter === "advance") {
    filteredShifts = monthShifts.filter((s) => s.day <= cutoffDay);
  } else if (currentShiftsFilter === "salary") {
    filteredShifts = monthShifts.filter((s) => s.day > cutoffDay);
  }

  if (filteredShifts.length === 0) {
    let emptyMsg = "Нажми на любой день в календаре, чтобы добавить смену";
    if (currentShiftsFilter === "advance") {
      emptyMsg = `В периоде аванса (1–${cutoffDay} ${MONTH_NAMES_GENITIVE[month]}) пока нет смен`;
    } else if (currentShiftsFilter === "salary") {
      emptyMsg = `В периоде расчёта (${cutoffDay + 1}–${daysInMonth} ${MONTH_NAMES_GENITIVE[month]}) пока нет смен`;
    }
    listEl.innerHTML = `<div class="shift-list__empty">${emptyMsg}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  const currency = escapeHtml(settings.currency);

  // Безопасный reverse без мутации исходного массива
  [...filteredShifts].reverse().forEach((s) => {
    const noteStr = s.note ? ` • ${escapeHtml(s.note)}` : "";

    const article = document.createElement("article");
    article.className = "shift-list__item";
    article.setAttribute("role", "button");
    article.setAttribute("tabindex", "0");
    article.innerHTML = `
      <div class="shift-list__left">
        <div class="shift-list__date">${getShiftIconSvg(s.type)}<span>${s.day} ${MONTH_NAMES_GENITIVE[month]}</span></div>
        <div class="shift-list__meta">${escapeHtml(s.start)} – ${escapeHtml(s.end)}${noteStr}</div>
      </div>
      <div class="shift-list__right">
        <div class="shift-list__pay">+${Number(s.totalPay).toLocaleString("ru-RU")} ${currency}</div>
        <div class="shift-list__hours">${s.hours} ч.</div>
      </div>
    `;
    article.addEventListener("click", () => openShiftModal(s.dateKey));
    article.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openShiftModal(s.dateKey);
      }
    });
    fragment.appendChild(article);
  });

  listEl.innerHTML = "";
  listEl.appendChild(fragment);
}

// ============================================================
// Экспорт CSV (с поддержкой Web Share API)
// ============================================================
async function exportCSV(allTime = false) {
  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `${year}-${month}`;
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
          s.type,
          s.start,
          s.end,
          s.breakMins,
          s.hours,
          s.bonus,
          s.totalPay,
          `"${(s.note || "").replace(/"/g, '""')}"`,
        ]);
      }
    });

  if (count === 0) {
    showToast("Нет смен для экспорта", "info");
    return;
  }

  const csvContent = "\uFEFF" + rows.map((e) => e.join(";")).join("\n");
  const filename = allTime ? "shifts_all.csv" : `shifts_${monthPrefix}.csv`;
  const file = new File([csvContent], filename, { type: "text/csv;charset=utf-8" });

  // Web Share API для удобной отправки напрямую в Telegram, WhatsApp и др.
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: allTime ? "Все смены" : `Смены за ${MONTH_NAMES[currentDate.getMonth()]} ${year}`,
        text: `Отчёт по сменам (${count} смен)`,
        files: [file],
      });
      triggerHaptic(15);
      showToast("Отчёт успешно отправлен!", "success");
      return;
    } catch (err) {
      if (err.name === "AbortError") {
        // Пользователь отменил шеринг сам
        return;
      }
    }
  }

  // Фоллбэк: стандартное скачивание файла
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, filename);
  triggerHaptic(15);
  showToast("Отчёт CSV скачан", "success");
}

// ============================================================
// Бэкап
// ============================================================
function downloadBackup() {
  const data = JSON.stringify({ shifts, settings }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  triggerDownload(
    blob,
    `shifts_backup_${new Date().toISOString().slice(0, 10)}.json`,
  );
}

function restoreBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(e.target.result);

      // Валидация структуры бэкапа
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Неверный формат");
      }

      if (parsed.shifts && typeof parsed.shifts === "object") {
        shifts = parsed.shifts;
      }

      if (parsed.settings && typeof parsed.settings === "object") {
        const s = parsed.settings;
        const presets = s.presets && typeof s.presets === "object" ? {
          day: {
            start: s.presets.day?.start || s.start || DEFAULT_PRESETS.day.start,
            end: s.presets.day?.end || s.end || DEFAULT_PRESETS.day.end,
            breakMins: s.presets.day?.breakMins ?? s.breakMins ?? DEFAULT_PRESETS.day.breakMins,
          },
          night: {
            start: s.presets.night?.start || DEFAULT_PRESETS.night.start,
            end: s.presets.night?.end || DEFAULT_PRESETS.night.end,
            breakMins: s.presets.night?.breakMins ?? DEFAULT_PRESETS.night.breakMins,
          },
          extra: {
            start: s.presets.extra?.start || DEFAULT_PRESETS.extra.start,
            end: s.presets.extra?.end || DEFAULT_PRESETS.extra.end,
            breakMins: s.presets.extra?.breakMins ?? DEFAULT_PRESETS.extra.breakMins,
          },
        } : {
          day: {
            start: s.start || DEFAULT_PRESETS.day.start,
            end: s.end || DEFAULT_PRESETS.day.end,
            breakMins: s.breakMins ?? DEFAULT_PRESETS.day.breakMins,
          },
          night: { ...DEFAULT_PRESETS.night },
          extra: { ...DEFAULT_PRESETS.extra },
        };

        settings = {
          start: presets.day.start,
          end: presets.day.end,
          breakMins: presets.day.breakMins,
          payMode: ["hourly", "fixed"].includes(s.payMode) ? s.payMode : DEFAULT_SETTINGS.payMode,
          rate: typeof s.rate === "number" ? s.rate : DEFAULT_SETTINGS.rate,
          currency: typeof s.currency === "string" ? s.currency : DEFAULT_SETTINGS.currency,
          advanceCutoffDay: typeof s.advanceCutoffDay === "number" ? s.advanceCutoffDay : DEFAULT_SETTINGS.advanceCutoffDay,
          monthlyGoal: typeof s.monthlyGoal === "number" ? Math.max(0, s.monthlyGoal) : DEFAULT_SETTINGS.monthlyGoal,
          presets,
        };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      closeModal("settingsModal");
      render();
      showToast("Данные успешно восстановлены!", "success");
    } catch (err) {
      showToast("Ошибка чтения файла бэкапа", "error");
    }
    // Сбрасываем input, чтобы повторная загрузка того же файла сработала
    event.target.value = "";
  };
  reader.readAsText(file);
}

// ============================================================
// Тема (Светлая / Тёмная)
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  const metaThemeColor = elements.metaThemeColor;
  if (metaThemeColor) {
    metaThemeColor.setAttribute(
      "content",
      theme === "light" ? "#f7f4ec" : "#131535",
    );
  }

  const icon = elements.themeIcon;
  if (icon) {
    icon.innerHTML =
      theme === "light"
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
        : '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
  }
}

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
}

// ============================================================
// Свайп по календарю для смены месяца
// ============================================================
let isSwipingMonth = false;

function animateMonthSwipe(delta, targetDate = null) {
  if (isSwipingMonth) return;
  isSwipingMonth = true;

  const grid = elements.calendarGrid;
  if (!grid) {
    if (targetDate) {
      currentDate = targetDate;
    } else {
      currentDate.setMonth(currentDate.getMonth() + delta);
    }
    render();
    isSwipingMonth = false;
    return;
  }

  // При переходе вперед (delta === 1), текущая сетка уходит влево (-100%)
  // При переходе назад (delta === -1), текущая сетка уходит вправо (+100%)
  const outX = delta === 1 ? -100 : 100;
  const inX = delta === 1 ? 100 : -100;

  grid.style.transition = "transform 0.16s ease-out, opacity 0.16s ease-out";
  grid.style.transform = `translateX(${outX}%)`;
  grid.style.opacity = "0";

  setTimeout(() => {
    if (targetDate) {
      currentDate = targetDate;
    } else {
      currentDate.setMonth(currentDate.getMonth() + delta);
    }
    render();

    grid.style.transition = "none";
    grid.style.transform = `translateX(${inX}%)`;
    grid.style.opacity = "0";

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        grid.style.transition = "transform 0.2s ease-out, opacity 0.2s ease-out";
        grid.style.transform = "translateX(0)";
        grid.style.opacity = "1";

        setTimeout(() => {
          grid.style.transition = "";
          grid.style.transform = "";
          grid.style.opacity = "";
          if (window.scrollX !== 0) {
            window.scrollTo(0, window.scrollY);
          }
          isSwipingMonth = false;
        }, 210);
      });
    });
  }, 160);
}

function initSwipe() {
  const calendar = document.querySelector(".calendar");
  const grid = elements.calendarGrid;
  if (!calendar || !grid) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let isTracking = false;
  let isHorizontal = false;

  calendar.addEventListener(
    "touchstart",
    (e) => {
      if (isSwipingMonth) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isTracking = true;
      isHorizontal = false;
    },
    { passive: true },
  );

  calendar.addEventListener(
    "touchmove",
    (e) => {
      if (!isTracking || isSwipingMonth) return;

      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const dx = touchX - touchStartX;
      const dy = touchY - touchStartY;

      if (!isHorizontal) {
        if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
          isHorizontal = true;
          grid.style.transition = "none";
        } else if (Math.abs(dy) > 10) {
          isTracking = false;
          return;
        }
      }

      if (isHorizontal) {
        const damping = 0.45;
        grid.style.transform = `translateX(${dx * damping}px)`;
        grid.style.opacity = `${Math.max(0.4, 1 - Math.abs(dx) / 300)}`;
      }
    },
    { passive: true },
  );

  calendar.addEventListener(
    "touchend",
    (e) => {
      if (!isTracking || isSwipingMonth) return;
      isTracking = false;

      if (!isHorizontal) return;
      isHorizontal = false;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
        animateMonthSwipe(dx > 0 ? -1 : 1);
      } else {
        grid.style.transition = "transform 0.18s ease-out, opacity 0.18s ease-out";
        grid.style.transform = "translateX(0)";
        grid.style.opacity = "1";
        setTimeout(() => {
          grid.style.transition = "";
          grid.style.transform = "";
          grid.style.opacity = "";
        }, 190);
      }
    },
    { passive: true },
  );
}

// ============================================================
// Смахивание шторки на мобильных (Swipe to dismiss)
// ============================================================
function initBottomSheetSwipe() {
  const modalOverlays = [
    elements.shiftModal,
    elements.settingsModal,
    elements.shiftsModal,
  ];

  modalOverlays.forEach((overlay) => {
    if (!overlay) return;
    const content = overlay.querySelector(".modal-overlay__content");
    if (!content) return;

    let startY = 0;
    let currentY = 0;
    let isTracking = false;
    let isDragging = false;
    let isTopDrag = false;

    // Предотвращаем фоновый pull-to-refresh при касании самого фона оверлея
    overlay.addEventListener(
      "touchmove",
      (e) => {
        if (e.target === overlay && e.cancelable) {
          e.preventDefault();
        }
      },
      { passive: false },
    );

    content.addEventListener(
      "touchstart",
      (e) => {
        if (window.innerWidth > 600) return;
        const touch = e.touches[0];
        startY = touch.clientY;
        currentY = startY;

        const target = e.target;
        const isHeader = !!target.closest(".modal__header");
        const rect = content.getBoundingClientRect();
        const isNearTop = touch.clientY - rect.top < 65;
        isTopDrag = isHeader || isNearTop;

        const scrollable = content.querySelector(".shift-list") || content;

        // Разрешаем смахивание, если шторка прокручена к самому верху или тап по шапке/ручке
        if (scrollable.scrollTop <= 0 || isTopDrag) {
          isTracking = true;
          isDragging = false;
        } else {
          isTracking = false;
        }
      },
      { passive: true },
    );

    content.addEventListener(
      "touchmove",
      (e) => {
        if (!isTracking || window.innerWidth > 600) return;
        const touch = e.touches[0];
        currentY = touch.clientY;
        const dy = currentY - startY;

        const scrollable = content.querySelector(".shift-list") || content;

        // Если тянем вниз от верха шторки или за шапку — отменяем нативный жест (pull-to-refresh)
        if (dy > 0 && (scrollable.scrollTop <= 0 || isTopDrag)) {
          if (e.cancelable) {
            e.preventDefault();
          }
        }

        if (dy > 6) {
          isDragging = true;
          content.style.transition = "none";
          content.style.transform = `translateY(${dy}px)`;
          overlay.style.backgroundColor = `rgba(0, 0, 0, ${Math.max(0.15, 0.7 - dy / 600)})`;
        } else if (dy < 0 && isDragging) {
          content.style.transform = "translateY(0)";
          isDragging = false;
        }
      },
      { passive: false },
    );

    const finishDrag = () => {
      if (!isTracking || window.innerWidth > 600) return;
      isTracking = false;

      if (!isDragging) return;
      isDragging = false;

      const dy = currentY - startY;
      content.style.transition = "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";
      overlay.style.backgroundColor = "";

      if (dy > 110) {
        // Смахиваем шторку вниз до конца и закрываем
        content.style.transform = "translateY(100%)";
        setTimeout(() => {
          closeModal(overlay.id);
          content.style.transform = "";
          content.style.transition = "";
        }, 200);
      } else {
        // Возвращаем шторку на место
        content.style.transform = "translateY(0)";
        setTimeout(() => {
          content.style.transform = "";
          content.style.transition = "";
        }, 220);
      }
    };

    content.addEventListener("touchend", finishDrag, { passive: true });
    content.addEventListener("touchcancel", finishDrag, { passive: true });
  });
}

// ============================================================
// PWA: Service Worker и фоновое автообновление
// ============================================================
function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.update();
    });
  });
}

// ============================================================
// Привязка обработчиков событий
// ============================================================
function bindEvents() {
  // Навигация по месяцам
  elements.prevMonthBtn.addEventListener("click", (e) => {
    changeMonth(-1);
    e.currentTarget.blur();
  });
  elements.nextMonthBtn.addEventListener("click", (e) => {
    changeMonth(1);
    e.currentTarget.blur();
  });
  elements.monthTitle.addEventListener("click", (e) => {
    goToToday();
    e.currentTarget.blur();
  });
  elements.monthTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToToday();
    }
  });

  // Кнопка быстрого возврата к сегодняшнему дню
  if (elements.todayBtn) {
    elements.todayBtn.addEventListener("click", (e) => {
      goToToday();
      e.currentTarget.blur();
    });
  }

  // Тема и настройки
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.settingsBtn.addEventListener("click", openSettings);

  // Экспорт
  elements.exportMonthBtn.addEventListener("click", () => exportCSV(false));
  elements.exportAllBtn.addEventListener("click", () => exportCSV(true));

  // Финансовая цель на месяц ("Копилка")
  if (elements.goalTracker) {
    elements.goalTracker.addEventListener("click", () => {
      triggerHaptic(10);
      openSettings();
      setTimeout(() => {
        if (elements.defMonthlyGoal) {
          elements.defMonthlyGoal.focus();
          elements.defMonthlyGoal.select();
        }
      }, 150);
    });
    elements.goalTracker.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.goalTracker.click();
      }
    });
  }

  // Модальное окно детализации смен и карточки выплат
  if (elements.payoutAdvanceCard) {
    elements.payoutAdvanceCard.addEventListener("click", () => {
      currentShiftsFilter = "advance";
      setSegmentedValue("shiftsFilterSegmented", "shiftsFilterInput", "advance");
      renderShiftList(currentMonthShiftsCache, currentDate.getMonth());
      openModal("shiftsModal");
      triggerHaptic(12);
    });
    elements.payoutAdvanceCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.payoutAdvanceCard.click();
      }
    });
  }

  if (elements.payoutSalaryCard) {
    elements.payoutSalaryCard.addEventListener("click", () => {
      currentShiftsFilter = "salary";
      setSegmentedValue("shiftsFilterSegmented", "shiftsFilterInput", "salary");
      renderShiftList(currentMonthShiftsCache, currentDate.getMonth());
      openModal("shiftsModal");
      triggerHaptic(12);
    });
    elements.payoutSalaryCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.payoutSalaryCard.click();
      }
    });
  }

  if (elements.openShiftsBtn) {
    elements.openShiftsBtn.addEventListener("click", () => {
      currentShiftsFilter = "all";
      setSegmentedValue("shiftsFilterSegmented", "shiftsFilterInput", "all");
      renderShiftList(currentMonthShiftsCache, currentDate.getMonth());
      openModal("shiftsModal");
    });
  }
  if (elements.shiftsModalCloseBtn) {
    elements.shiftsModalCloseBtn.addEventListener("click", () => closeModal("shiftsModal"));
  }

  // Форма смены
  elements.shiftForm.addEventListener("submit", saveShift);
  elements.shiftModalCloseBtn.addEventListener("click", () =>
    closeModal("shiftModal"),
  );
  elements.deleteBtn.addEventListener("click", deleteShift);

  // Пересчёт при изменении полей
  elements.startTime.addEventListener("change", recalcModal);
  elements.endTime.addEventListener("change", recalcModal);
  elements.breakMins.addEventListener("change", recalcModal);
  elements.payMode.addEventListener("change", recalcModal);
  elements.rate.addEventListener("input", recalcModal);
  elements.bonus.addEventListener("input", recalcModal);

  // Форма настроек
  elements.settingsForm.addEventListener("submit", saveSettings);
  elements.settingsModalCloseBtn.addEventListener("click", () =>
    closeModal("settingsModal"),
  );

  // Автозаполнение графика
  if (elements.autoScheduleBtn) {
    elements.autoScheduleBtn.addEventListener("click", openScheduleModal);
  }
  if (elements.scheduleModalCloseBtn) {
    elements.scheduleModalCloseBtn.addEventListener("click", () => closeModal("scheduleModal"));
  }
  if (elements.scheduleForm) {
    elements.scheduleForm.addEventListener("submit", applySchedule);
  }
  if (elements.scheduleStartDate) {
    elements.scheduleStartDate.addEventListener("change", updateSchedulePreview);
  }
  if (elements.scheduleSkipExisting) {
    elements.scheduleSkipExisting.addEventListener("change", updateSchedulePreview);
  }

  if (elements.schedulePatternGrid) {
    elements.schedulePatternGrid.querySelectorAll(".schedule-pattern-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const pattern = btn.dataset.pattern;
        elements.selectedPattern.value = pattern;
        elements.schedulePatternGrid.querySelectorAll(".schedule-pattern-btn").forEach((b) => {
          b.classList.toggle("is-active", b === btn);
        });
        if (elements.customPatternGroup) {
          elements.customPatternGroup.style.display = pattern === "custom" ? "block" : "none";
        }
        updateSchedulePreview();
        triggerHaptic(10);
      });
    });
  }

  document.querySelectorAll(".custom-add-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const type = btn.dataset.type;
      customCycle.push(type);
      updateCustomPatternBuilderUI();
      updateSchedulePreview();
      triggerHaptic(8);
    });
  });

  if (elements.customResetBtn) {
    elements.customResetBtn.addEventListener("click", () => {
      customCycle = [];
      updateCustomPatternBuilderUI();
      updateSchedulePreview();
      triggerHaptic(12);
    });
  }

  // Бэкап
  elements.backupDownloadBtn.addEventListener("click", downloadBackup);
  elements.backupRestoreBtn.addEventListener("click", () =>
    elements.importFile.click(),
  );
  elements.importFile.addEventListener("change", restoreBackup);

  // Закрытие модалок по клику на оверлей или по Escape
  [elements.shiftModal, elements.settingsModal, elements.shiftsModal, elements.scheduleModal].forEach((overlay) => {
    if (!overlay) return;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal("shiftModal");
      closeModal("settingsModal");
      closeModal("shiftsModal");
      closeModal("scheduleModal");
    }
  });
}

// ============================================================
// Инициализация
// ============================================================
applyTheme(currentTheme);
initSegmentedControls();
bindEvents();
initSwipe();
initBottomSheetSwipe();
registerSW();
render();
