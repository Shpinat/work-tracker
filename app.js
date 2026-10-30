/**
 * app.js
 * Точка входа приложения WorkTrack.
 * Координация состояния, модулей Domain, Data и UI, и привязка событий.
 */

// ============================================================
// Импорты модулей
// ============================================================
import {
  STORAGE_KEY,
  SETTINGS_KEY,
  THEME_KEY,
  TIMER_STORAGE_KEY,
  DEFAULT_PRESETS,
  DEFAULT_SETTINGS,
  loadShifts,
  saveShifts,
  loadSettings,
  saveSettings,
  loadTheme,
  saveTheme,
  loadShiftTimer,
  saveShiftTimer,
  clearShiftTimer,
  requestPersistentStorage,
} from "./data/storage.js";

import {
  downloadBackup,
  parseBackupFile,
  exportCSV,
} from "./data/backup.js";

import {
  formatDateKey,
  calcHoursDiff,
  calcShiftPay,
  calcMonthSummary,
  recalcMonthShifts,
  verifyPayslip,
} from "./domain/payroll.js";

import {
  calcMomTrends,
} from "./domain/analytics.js";

import {
  SCHEDULE_PATTERNS,
  calculateScheduleDates,
  buildShiftFromPreset,
} from "./domain/schedule.js";

import {
  MONTH_NAMES,
  MONTH_NAMES_GENITIVE,
  SHIFT_ICONS,
  getShiftIconSvg,
} from "./ui/icons.js";

import {
  escapeHtml,
  getRussianDeclension,
  triggerHaptic,
  showToast,
} from "./ui/toast.js";

import {
  openModal,
  closeModal,
  showConfirm,
  initBottomSheetSwipe,
} from "./ui/modals.js";

import {
  renderShiftList,
  updateShiftListScrollGradients,
} from "./ui/shift-list.js";

import {
  renderCalendarGrid,
  animateMonthSwipe,
  initCalendarSwipe,
} from "./ui/calendar.js";

// ============================================================
// Состояние приложения
// ============================================================
let currentDate = new Date();
let shifts = loadShifts();
let settings = loadSettings();
let currentTheme = loadTheme();
let currentMonthShiftsCache = [];
let currentSettingsPreset = "day";
let deferredPrompt = null; // Для установки PWA
let tempPresets = {};
let customCycle = ["day", "night", "off", "off"];
let lastScheduleSnapshot = null;
let lastMonthComparisonSummary = null;
let timerState = null;
let timerInterval = null;
let currentTimerPresetType = "day";

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

  // Таймер текущей смены (Автономный секундомер)
  shiftTimerWidget: document.getElementById("shiftTimerWidget"),
  shiftTimerIdle: document.getElementById("shiftTimerIdle"),
  shiftTimerActive: document.getElementById("shiftTimerActive"),
  shiftTimerStartBtn: document.getElementById("shiftTimerStartBtn"),
  shiftTimerPresetTabs: document.getElementById("shiftTimerPresetTabs"),
  timerTabDay: document.getElementById("timerTabDay"),
  timerTabNight: document.getElementById("timerTabNight"),
  timerTabExtra: document.getElementById("timerTabExtra"),
  timerTabNameDay: document.getElementById("timerTabNameDay"),
  timerTabNameNight: document.getElementById("timerTabNameNight"),
  timerTabNameExtra: document.getElementById("timerTabNameExtra"),
  shiftTimerStatusText: document.getElementById("shiftTimerStatusText"),
  shiftTimerActiveTypeBadge: document.getElementById("shiftTimerActiveTypeBadge"),
  shiftTimerDigits: document.getElementById("shiftTimerDigits"),
  shiftTimerPay: document.getElementById("shiftTimerPay"),
  shiftTimerPauseBtn: document.getElementById("shiftTimerPauseBtn"),
  shiftTimerFinishBtn: document.getElementById("shiftTimerFinishBtn"),
  shiftTimerCancelBtn: document.getElementById("shiftTimerCancelBtn"),
  shiftTimerPulseDot: document.getElementById("shiftTimerPulseDot"),

  // Статистика
  statShifts: document.getElementById("statShifts"),
  statHours: document.getElementById("statHours"),
  statHoursRate: document.getElementById("statHoursRate"),
  statIncome: document.getElementById("statIncome"),
  statIncomeBreakdown: document.getElementById("statIncomeBreakdown"),
  statShiftsCard: document.getElementById("statShiftsCard"),
  statHoursCard: document.getElementById("statHoursCard"),
  statIncomeCard: document.getElementById("statIncomeCard"),
  statShiftsBadge: document.getElementById("statShiftsBadge"),

  // Календарь и триггер смен
  calendarGrid: document.getElementById("calendarGrid"),
  openShiftsBtn: document.getElementById("openShiftsBtn"),

  // Модальное окно деталей смен (Шторка)
  shiftsModal: document.getElementById("shiftsModal"),
  shiftsModalTitle: document.getElementById("shiftsModalTitle"),
  shiftsModalMonth: document.getElementById("shiftsModalMonth"),
  shiftsModalCloseBtn: document.getElementById("shiftsModalCloseBtn"),
  shiftList: document.getElementById("shiftList"),
  shiftListWrapper: document.getElementById("shiftListWrapper"),

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
  presetTitleDay: document.getElementById("presetTitleDay"),
  presetTitleNight: document.getElementById("presetTitleNight"),
  presetTitleExtra: document.getElementById("presetTitleExtra"),
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
  settingsPresetLabelDay: document.getElementById("settingsPresetLabelDay"),
  settingsPresetLabelNight: document.getElementById("settingsPresetLabelNight"),
  settingsPresetLabelExtra: document.getElementById("settingsPresetLabelExtra"),
  settingsActivePreset: document.getElementById("settingsActivePreset"),
  defPresetName: document.getElementById("defPresetName"),
  defStart: document.getElementById("defStart"),
  defEnd: document.getElementById("defEnd"),
  defBreak: document.getElementById("defBreak"),
  defPayMode: document.getElementById("defPayMode"),
  defPayModeSegmented: document.getElementById("defPayModeSegmented"),
  defRate: document.getElementById("defRate"),
  recalcMonthRatesBtn: document.getElementById("recalcMonthRatesBtn"),
  defCurrency: document.getElementById("defCurrency"),

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
  customAddDayBtn: document.getElementById("customAddDayBtn"),
  customAddNightBtn: document.getElementById("customAddNightBtn"),
  customAddExtraBtn: document.getElementById("customAddExtraBtn"),
  scheduleDurationSegmented: document.getElementById("scheduleDurationSegmented"),
  scheduleDuration: document.getElementById("scheduleDuration"),
  scheduleSkipExisting: document.getElementById("scheduleSkipExisting"),
  previewScheduleText: document.getElementById("schedulePreviewText"),
  applyScheduleBtn: document.getElementById("applyScheduleBtn"),

  // Бэкап
  backupDownloadBtn: document.getElementById("backupDownloadBtn"),
  backupRestoreBtn: document.getElementById("backupRestoreBtn"),
  importFile: document.getElementById("importFile"),
  installAppDivider: document.getElementById("installAppDivider"),
  installAppTitle: document.getElementById("installAppTitle"),
  installAppContainer: document.getElementById("installAppContainer"),
  installPwaBtn: document.getElementById("installPwaBtn"),

  // Сверка с расчетным листком
  payslipAuditSection: document.getElementById("payslipAuditSection"),
  payslipToggleBtn: document.getElementById("payslipToggleBtn"),
  payslipToggleArrow: document.getElementById("payslipToggleArrow"),
  payslipAuditBody: document.getElementById("payslipAuditBody"),
  payslipActualInput: document.getElementById("payslipActualInput"),
  payslipCalcBtn: document.getElementById("payslipCalcBtn"),
  payslipAuditResult: document.getElementById("payslipAuditResult"),

  // Кастомный диалог подтверждения и тосты
  confirmModal: document.getElementById("confirmModal"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmIcon: document.getElementById("confirmIcon"),
  confirmOkBtn: document.getElementById("confirmOkBtn"),
  confirmCancelBtn: document.getElementById("confirmCancelBtn"),
  appToast: document.getElementById("appToast"),

  // Безопасное восстановление резервной копии
  restoreModal: document.getElementById("restoreModal"),
  restoreModalTitle: document.getElementById("restoreModalTitle"),
  restoreModalShiftsCount: document.getElementById("restoreModalShiftsCount"),
  restoreModalDateRange: document.getElementById("restoreModalDateRange"),
  restoreModalExportDate: document.getElementById("restoreModalExportDate"),
  restoreModalCurrentCount: document.getElementById("restoreModalCurrentCount"),
  restoreBackupFirstBtn: document.getElementById("restoreBackupFirstBtn"),
  restoreCancelBtn: document.getElementById("restoreCancelBtn"),
  restoreConfirmBtn: document.getElementById("restoreConfirmBtn"),

  // Баннер обновления PWA
  updateBanner: document.getElementById("updateBanner"),
  updateReloadBtn: document.getElementById("updateReloadBtn"),
};

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
  const dayName = p.day?.name || "День";
  const nightName = p.night?.name || "Ночь";
  const extraName = p.extra?.name || "Подработка";

  if (elements.presetTitleDay) elements.presetTitleDay.textContent = dayName;
  if (elements.presetTimeDay) elements.presetTimeDay.textContent = `${p.day.start}–${p.day.end}`;

  if (elements.presetTitleNight) elements.presetTitleNight.textContent = nightName;
  if (elements.presetTimeNight) elements.presetTimeNight.textContent = `${p.night.start}–${p.night.end}`;

  if (elements.presetTitleExtra) elements.presetTitleExtra.textContent = extraName;
  if (elements.presetTimeExtra) elements.presetTimeExtra.textContent = `${p.extra.start}–${p.extra.end}`;

  if (elements.settingsPresetLabelDay) elements.settingsPresetLabelDay.textContent = dayName;
  if (elements.settingsPresetLabelNight) elements.settingsPresetLabelNight.textContent = nightName;
  if (elements.settingsPresetLabelExtra) elements.settingsPresetLabelExtra.textContent = extraName;

  if (elements.breakdownDayLabel) elements.breakdownDayLabel.textContent = dayName;
  if (elements.breakdownNightLabel) elements.breakdownNightLabel.textContent = nightName;
  if (elements.breakdownExtraLabel) elements.breakdownExtraLabel.textContent = extraName;

  if (elements.customAddDayBtn) elements.customAddDayBtn.textContent = `+ ${dayName}`;
  if (elements.customAddNightBtn) elements.customAddNightBtn.textContent = `+ ${nightName}`;
  if (elements.customAddExtraBtn) elements.customAddExtraBtn.textContent = `+ ${extraName}`;

  updateTimerPresetTabsUI();
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
  animateMonthSwipe(elements.calendarGrid, delta, () => {
    currentDate.setDate(1);
    currentDate.setMonth(currentDate.getMonth() + delta);
    render();
  });
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

  animateMonthSwipe(elements.calendarGrid, delta, () => {
    currentDate = today;
    render();
  });

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
  elements.totalPay.value = calcShiftPay(hours, rate, payMode, bonus);
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

  // Перезагрузка перед слиянием, чтобы не стереть изменения из другой вкладки
  shifts = loadShifts();

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
    tags: [],
  };
  if (!saveShifts(shifts)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
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

  // Перезагрузка перед удалением
  shifts = loadShifts();

  delete shifts[dateKey];
  if (!saveShifts(shifts)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
  closeModal("shiftModal");
  render();
  triggerHaptic(20);
  showToast("Смена удалена", "info");
}

function quickAddDefaultShift(dateKey) {
  shifts = loadShifts();
  if (shifts[dateKey]) return;

  shifts[dateKey] = buildShiftFromPreset("day", settings);
  if (!saveShifts(shifts)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
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
  const preset = settings.presets?.day || DEFAULT_PRESETS.day;
  const shiftTitle = preset.name || "Смена";
  showToast(`${shiftTitle} добавлена: ${parseInt(d, 10)} ${monthName} (${preset.start}–${preset.end})`, "success");
}

// ============================================================
// Настройки
// ============================================================
function openSettings() {
  updatePayModeLabels();
  tempPresets = JSON.parse(JSON.stringify(settings.presets || DEFAULT_PRESETS));
  currentSettingsPreset = "day";
  setSegmentedValue("settingsPresetSegmented", "settingsActivePreset", "day");

  if (elements.settingsPresetLabelDay) elements.settingsPresetLabelDay.textContent = tempPresets.day?.name || "День";
  if (elements.settingsPresetLabelNight) elements.settingsPresetLabelNight.textContent = tempPresets.night?.name || "Ночь";
  if (elements.settingsPresetLabelExtra) elements.settingsPresetLabelExtra.textContent = tempPresets.extra?.name || "Подработка";

  loadPresetIntoSettingsInputs("day");

  setSegmentedValue("defPayModeSegmented", "defPayMode", settings.payMode || "hourly");
  elements.defRate.value = settings.rate;
  elements.defCurrency.value = settings.currency || "₽";

  openModal("settingsModal");
}

function loadPresetIntoSettingsInputs(type) {
  const p = tempPresets[type] || DEFAULT_PRESETS[type];
  const fallback = type === "day" ? "День" : type === "night" ? "Ночь" : "Подработка";
  if (elements.defPresetName) {
    elements.defPresetName.value = p.name || fallback;
  }
  elements.defStart.value = p.start;
  elements.defEnd.value = p.end;
  elements.defBreak.value = p.breakMins;
}

function saveCurrentSettingsInputsToTemp() {
  if (!tempPresets[currentSettingsPreset]) {
    tempPresets[currentSettingsPreset] = { ...DEFAULT_PRESETS[currentSettingsPreset] };
  }
  const fallback = currentSettingsPreset === "day" ? "День" : currentSettingsPreset === "night" ? "Ночь" : "Подработка";
  const customName = elements.defPresetName ? elements.defPresetName.value.trim() : "";
  tempPresets[currentSettingsPreset].name = customName || tempPresets[currentSettingsPreset].name || fallback;
  tempPresets[currentSettingsPreset].start = elements.defStart.value || DEFAULT_PRESETS[currentSettingsPreset].start;
  tempPresets[currentSettingsPreset].end = elements.defEnd.value || DEFAULT_PRESETS[currentSettingsPreset].end;
  tempPresets[currentSettingsPreset].breakMins = Number(elements.defBreak.value) || 0;

  const labelEl = currentSettingsPreset === "day"
    ? elements.settingsPresetLabelDay
    : currentSettingsPreset === "night"
    ? elements.settingsPresetLabelNight
    : elements.settingsPresetLabelExtra;
  if (labelEl) {
    labelEl.textContent = tempPresets[currentSettingsPreset].name;
  }
}

function saveSettingsFromModal(e) {
  e.preventDefault();
  saveCurrentSettingsInputsToTemp();

  settings.presets = tempPresets;
  settings.start = tempPresets.day.start;
  settings.end = tempPresets.day.end;
  settings.breakMins = tempPresets.day.breakMins;
  settings.payMode = elements.defPayMode.value;
  settings.rate = parseFloat(elements.defRate.value) || 0;
  settings.currency = elements.defCurrency.value.trim() || "₽";

  if (!saveSettings(settings)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
  updatePayModeLabels();
  updatePresetTimesUI();
  closeModal("settingsModal");
  render();
  triggerHaptic(15);
  showToast("Настройки и шаблоны сохранены", "success");
}

async function recalcCurrentMonthRates() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const newRate = parseFloat(elements.defRate.value) >= 0 ? parseFloat(elements.defRate.value) : (settings.rate || 0);
  const newPayMode = elements.defPayMode ? elements.defPayMode.value : (settings.payMode || "hourly");
  const curr = (elements.defCurrency && elements.defCurrency.value.trim()) || settings.currency || "₽";

  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  const count = Object.keys(shifts).filter((k) => k.startsWith(monthPrefix)).length;

  if (count === 0) {
    showToast("В этом месяце нет смен для пересчета", "info");
    return;
  }

  const countText = `${count} ${getRussianDeclension(count, ["смену", "смены", "смен"])}`;
  const rateLabel = newPayMode === "hourly" ? `${newRate} ${curr}/час` : `${newRate} ${curr}/смена`;

  const confirmed = await showConfirm({
    title: "Пересчитать смены месяца?",
    message: `Применить ставку ${rateLabel} для ${countText} за ${MONTH_NAMES[month]} ${year}? Индивидуальные часы, бонусы и заметки сохранятся.`,
    confirmText: "Пересчитать",
    cancelText: "Отмена",
    type: "primary",
  });

  if (!confirmed) return;

  shifts = loadShifts(); // Load latest state
  const { count: updatedCount, updatedShifts } = recalcMonthShifts(shifts, year, month, newRate, newPayMode);
  shifts = updatedShifts;

  settings.rate = newRate;
  settings.payMode = newPayMode;
  const settingsSaved = saveSettings(settings);
  const shiftsSaved = saveShifts(shifts);

  if (!settingsSaved || !shiftsSaved) {
    showToast("Ошибка сохранения", "error");
    return;
  }

  render();
  triggerHaptic(20);
  showToast(`Пересчитано смен: ${updatedCount}`, "success");
}

// ============================================================
// Автозаполнение графиков (Генератор)
// ============================================================
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
    let iconSvg = '<svg class="tag-svg-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>';
    let title = "Вых";
    if (type === "day") {
      iconSvg = '<svg class="tag-svg-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"></path></svg>';
      title = settings.presets?.day?.name || "День";
    } else if (type === "night") {
      iconSvg = '<svg class="tag-svg-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>';
      title = settings.presets?.night?.name || "Ночь";
    } else if (type === "extra") {
      iconSvg = '<svg class="tag-svg-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>';
      title = settings.presets?.extra?.name || "Подработка";
    }

    chip.innerHTML = `${iconSvg} <span>${escapeHtml(title)}</span> <span style="font-size: 0.7rem; opacity: 0.6; margin-left: 2px;">✕</span>`;
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

function updateSchedulePreview() {
  const previewEl = elements.previewScheduleText;
  if (!previewEl) return;

  const planned = calculateScheduleDates({
    startDateStr: elements.scheduleStartDate.value,
    patternKey: elements.selectedPattern.value,
    customCycle,
    durationMonths: parseInt(elements.scheduleDuration.value, 10) || 1,
    skipExisting: elements.scheduleSkipExisting.checked,
    shifts,
  });

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
    estTotal += calcShiftPay(hours, rate, payMode, 0);
  });

  const durationStr = durationMonths === 1 ? "1 месяц" : `${durationMonths} месяца`;
  let breakdown = [];
  if (dayCount > 0) breakdown.push(`${dayCount} дневных`);
  if (nightCount > 0) breakdown.push(`${nightCount} ночных`);

  const currencyStr = escapeHtml(settings.currency || "₽");

  previewEl.innerHTML = `Будет добавлено <strong>${planned.length} смен</strong> (${breakdown.join(", ")}) на <strong>${durationStr}</strong>.<br>Прогнозируемый доход: ~<strong>${estTotal.toLocaleString("ru-RU")} ${currencyStr}</strong>.`;
}

function applySchedule(e) {
  e.preventDefault();
  const planned = calculateScheduleDates({
    startDateStr: elements.scheduleStartDate.value,
    patternKey: elements.selectedPattern.value,
    customCycle,
    durationMonths: parseInt(elements.scheduleDuration.value, 10) || 1,
    skipExisting: elements.scheduleSkipExisting.checked,
    shifts,
  });

  if (planned.length === 0) {
    showToast("Нет смен для добавления", "info");
    return;
  }

  // Снимок для функции "Отменить"
  lastScheduleSnapshot = JSON.parse(JSON.stringify(shifts));

  shifts = loadShifts();
  planned.forEach((s) => {
    shifts[s.dateKey] = buildShiftFromPreset(s.type, settings);
  });

  if (!saveShifts(shifts)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
  closeModal("scheduleModal");
  render();
  triggerHaptic([30, 40, 50]);

  showToast(`График заполнен (+${planned.length} смен)!`, "success", {
    label: "Отменить",
    onClick: () => {
      if (lastScheduleSnapshot) {
        shifts = lastScheduleSnapshot;
        if (!saveShifts(shifts)) {
          showToast("Ошибка сохранения", "error");
          return;
        }
        render();
        triggerHaptic(15);
        showToast("Автозаполнение отменено", "info");
      }
    },
  });
}

// ============================================================
// Бэкап и Экспорт
// ============================================================
let pendingRestoreData = null;

async function handleBackupDownload() {
  try {
    const res = await downloadBackup(shifts, settings);
    if (res.shared) {
      showToast("Резервная копия отправлена", "success");
    } else if (res.aborted) {
      // Пользователь закрыл системное меню
    } else {
      showToast("Резервная копия скачана", "success");
    }
    triggerHaptic(15);
  } catch (err) {
    showToast("Ошибка создания резервной копии", "error");
  }
}

async function handleBackupRestore(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const restored = await parseBackupFile(file);
    pendingRestoreData = restored;

    const currCount = Object.keys(shifts).length;
    const currCurr = settings.currency || "₽";

    if (elements.restoreModalShiftsCount) {
      elements.restoreModalShiftsCount.textContent = `${restored.stats.shiftsCount} (${restored.stats.totalIncome.toLocaleString("ru-RU")} ${restored.settings.currency || currCurr})`;
    }
    if (elements.restoreModalDateRange) {
      elements.restoreModalDateRange.textContent =
        restored.stats.firstDate && restored.stats.lastDate
          ? `${restored.stats.firstDate} — ${restored.stats.lastDate}`
          : "нет смен";
    }
    if (elements.restoreModalExportDate) {
      elements.restoreModalExportDate.textContent = restored.exportedAt
        ? new Date(restored.exportedAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
        : "не указана";
    }
    if (elements.restoreModalCurrentCount) {
      elements.restoreModalCurrentCount.textContent = currCount;
    }

    openModal("restoreModal");
    triggerHaptic(15);
  } catch (err) {
    showToast(err.message || "Ошибка чтения файла бэкапа", "error");
  }

  event.target.value = "";
}

function confirmRestore() {
  if (!pendingRestoreData) return;
  shifts = pendingRestoreData.shifts;
  settings = pendingRestoreData.settings;
  const shiftsSaved = saveShifts(shifts);
  const settingsSaved = saveSettings(settings);
  if (!shiftsSaved || !settingsSaved) {
    showToast("Ошибка сохранения при восстановлении", "error");
    return;
  }
  closeModal("restoreModal");
  closeModal("settingsModal");
  pendingRestoreData = null;
  updatePayModeLabels();
  updatePresetTimesUI();
  render();
  triggerHaptic([30, 40, 30]);
  showToast("Данные успешно восстановлены!", "success");
}

function cancelRestore() {
  closeModal("restoreModal");
  pendingRestoreData = null;
}

async function handleExportCSV(allTime = false) {
  const result = await exportCSV({
    shifts,
    settings,
    allTime,
    currentDate,
    monthName: MONTH_NAMES[currentDate.getMonth()],
  });

  if (result.count === 0) {
    showToast("Нет смен для экспорта", "info");
    return;
  }

  triggerHaptic(15);
  if (result.shared) {
    showToast("Отчёт успешно отправлен!", "success");
  } else if (!result.aborted) {
    showToast("Отчёт CSV скачан", "success");
  }
}

// ============================================================
// Тема
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  if (elements.metaThemeColor) {
    elements.metaThemeColor.setAttribute(
      "content",
      theme === "light" ? "#f7f4ec" : "#131535",
    );
  }

  if (elements.themeIcon) {
    elements.themeIcon.innerHTML =
      theme === "light"
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>'
        : '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
  }
}

function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  saveTheme(currentTheme);
  applyTheme(currentTheme);
}

// ============================================================
// Рендер и UI-виджеты
// ============================================================
function updateStatsTrends(year, month, currentShifts, currentHours, currentIncome) {
  const trends = calcMomTrends(year, month, shifts, currentShifts, currentHours, currentIncome);

  if (!trends) {
    lastMonthComparisonSummary = null;
    return;
  }

  const prevMonthName = MONTH_NAMES[trends.prevMonth];
  const curMonthName = MONTH_NAMES[month];

  lastMonthComparisonSummary = {
    ...trends,
    prevMonthName,
    curMonthName,
  };
}

function render() {
  if (window.scrollX !== 0) {
    window.scrollTo(0, window.scrollY);
  }
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  elements.monthTitle.textContent = `${MONTH_NAMES[month]} ${year}`;

  // Подсчет сводки по сменам месяца
  const summary = calcMonthSummary(shifts, year, month);

  // Отрисовка календаря
  renderCalendarGrid(elements.calendarGrid, {
    year,
    month,
    shifts,
    onDayClick: openShiftModal,
    onDayLongPress: quickAddDefaultShift,
  });

  // Основная статистика
  elements.statShifts.textContent = summary.totalShifts;
  elements.statHours.textContent = summary.totalHours;
  elements.statIncome.textContent = `${summary.totalIncome.toLocaleString("ru-RU")} ${settings.currency}`;
  elements.statIncome.title = elements.statIncome.textContent;

  // Эффективная ставка в час
  if (elements.statHoursRate) {
    if (summary.totalHours > 0 && summary.effectiveHourlyRate > 0) {
      elements.statHoursRate.style.display = "block";
      elements.statHoursRate.textContent = `~${summary.effectiveHourlyRate.toLocaleString("ru-RU")} ${settings.currency}/ч`;
      elements.statHoursRate.title = `Эффективная ставка: ~${summary.effectiveHourlyRate.toLocaleString("ru-RU")} ${settings.currency} за час`;
    } else {
      elements.statHoursRate.style.display = "none";
    }
  }

  // Разделение Факт vs Прогноз для текущего месяца
  if (elements.statIncomeBreakdown) {
    if (isCurrentMonth && summary.earnedIncome > 0 && summary.projectedIncome > 0) {
      elements.statIncomeBreakdown.style.display = "block";
      elements.statIncomeBreakdown.textContent = `факт: ${summary.earnedIncome.toLocaleString("ru-RU")} • план: ${summary.projectedIncome.toLocaleString("ru-RU")}`;
      elements.statIncomeBreakdown.title = `Уже заработано на сегодня: ${summary.earnedIncome.toLocaleString("ru-RU")} ${settings.currency} (${summary.earnedHours} ч)\nОжидается до конца месяца: ${summary.projectedIncome.toLocaleString("ru-RU")} ${settings.currency} (${summary.projectedHours} ч)`;
    } else {
      elements.statIncomeBreakdown.style.display = "none";
    }
  }

  // Динамика трендов MoM
  updateStatsTrends(year, month, summary.totalShifts, summary.totalHours, summary.totalIncome);

  // Бейдж средней оплаты
  if (elements.statShiftsBadge) {
    if (summary.totalShifts > 0) {
      const avgPay = Math.round(summary.totalIncome / summary.totalShifts);
      elements.statShiftsBadge.textContent = `~${avgPay.toLocaleString("ru-RU")} ${settings.currency} / смена`;
      elements.statShiftsBadge.style.display = "inline-flex";
    } else {
      elements.statShiftsBadge.style.display = "none";
    }
  }

  if (elements.shiftsModalMonth) {
    elements.shiftsModalMonth.textContent = `${MONTH_NAMES[month]} ${year}`;
  }

  // Индикация на кнопке «Сегодня»
  if (elements.todayBtn) {
    elements.todayBtn.classList.toggle("header__today-btn--active", !isCurrentMonth);
    elements.todayBtn.title = isCurrentMonth
      ? "Текущий месяц"
      : `Вернуться к ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
  }

  currentMonthShiftsCache = summary.monthShifts;
  renderShiftList({
    listEl: elements.shiftList,
    wrapperEl: elements.shiftListWrapper,
    monthShifts: summary.monthShifts,
    year,
    month,
    filter: "all",
    settings,
    onShiftClick: openShiftModal,
  });
}

// ============================================================
// Таймер текущей смены (Автономный секундомер)
// ============================================================
function setTimerPreset(type) {
  currentTimerPresetType = type;
  updateTimerPresetTabsUI();
}

function updateTimerPresetTabsUI() {
  const tabs = [
    { el: elements.timerTabDay, nameEl: elements.timerTabNameDay, type: "day" },
    { el: elements.timerTabNight, nameEl: elements.timerTabNameNight, type: "night" },
    { el: elements.timerTabExtra, nameEl: elements.timerTabNameExtra, type: "extra" },
  ];

  tabs.forEach(({ el, nameEl, type }) => {
    if (el) {
      const isActive = currentTimerPresetType === type;
      el.classList.toggle("is-active", isActive);
      el.setAttribute("aria-selected", String(isActive));
    }
    if (nameEl) {
      const p = settings.presets?.[type] || DEFAULT_PRESETS[type];
      const fallback = type === "day" ? "День" : type === "night" ? "Ночь" : "Подработка";
      nameEl.textContent = p?.name || fallback;
    }
  });
}

function renderShiftTimerTick() {
  if (!timerState) return;
  const now = Date.now();
  let elapsedMs = 0;
  if (timerState.isPaused) {
    elapsedMs = (timerState.pausedAt || now) - timerState.startedAt - (timerState.totalPausedMs || 0);
  } else {
    elapsedMs = now - timerState.startedAt - (timerState.totalPausedMs || 0);
  }
  if (elapsedMs < 0) elapsedMs = 0;

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (elements.shiftTimerDigits) {
    elements.shiftTimerDigits.textContent =
      `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  // Расчет примерного заработка на лету
  const presetType = timerState.presetType || "day";
  const p = settings.presets?.[presetType] || DEFAULT_PRESETS[presetType] || DEFAULT_PRESETS.day;
  const rate = p.rate !== undefined && p.rate !== "" ? Number(p.rate) : Number(settings.defaultRate || 0);
  const payMode = p.payMode || settings.payMode || "hourly";
  const elapsedHours = elapsedMs / (1000 * 60 * 60);

  let livePay = 0;
  if (payMode === "hourly") {
    livePay = Math.round(elapsedHours * rate);
  } else {
    const stdHours = calcHoursDiff(p.start || "09:00", p.end || "18:00", p.breakMins || 0);
    livePay = stdHours > 0 ? Math.round((elapsedHours / stdHours) * rate) : rate;
  }

  if (elements.shiftTimerPay) {
    elements.shiftTimerPay.textContent = `~ ${livePay.toLocaleString("ru-RU")} ${settings.currency || "₽"}`;
  }
}

function updateShiftTimerUI() {
  if (!elements.shiftTimerWidget) return;

  if (!timerState || !timerState.isRunning) {
    if (elements.shiftTimerIdle) elements.shiftTimerIdle.style.display = "";
    if (elements.shiftTimerActive) elements.shiftTimerActive.style.display = "none";
    updateTimerPresetTabsUI();
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
    return;
  }

  if (elements.shiftTimerIdle) elements.shiftTimerIdle.style.display = "none";
  if (elements.shiftTimerActive) elements.shiftTimerActive.style.display = "";

  const presetType = timerState.presetType || "day";
  const p = settings.presets?.[presetType] || DEFAULT_PRESETS[presetType] || DEFAULT_PRESETS.day;

  if (elements.shiftTimerActiveTypeBadge) {
    elements.shiftTimerActiveTypeBadge.textContent = p.name || "День";
    elements.shiftTimerActiveTypeBadge.className = `shift-timer__type-badge shift-timer__type-badge--${presetType}`;
  }

  if (timerState.isPaused) {
    if (elements.shiftTimerPauseBtn) elements.shiftTimerPauseBtn.textContent = "Продолжить";
    if (elements.shiftTimerStatusText) elements.shiftTimerStatusText.textContent = "На паузе";
    if (elements.shiftTimerPulseDot) {
      elements.shiftTimerPulseDot.classList.add("shift-timer__pulse-dot--paused", "is-paused");
    }
  } else {
    if (elements.shiftTimerPauseBtn) elements.shiftTimerPauseBtn.textContent = "Пауза";
    if (elements.shiftTimerStatusText) elements.shiftTimerStatusText.textContent = "Смена идёт";
    if (elements.shiftTimerPulseDot) {
      elements.shiftTimerPulseDot.classList.remove("shift-timer__pulse-dot--paused", "is-paused");
    }
  }

  renderShiftTimerTick();

  if (!timerInterval) {
    timerInterval = setInterval(renderShiftTimerTick, 1000);
  }
}

function initShiftTimer() {
  timerState = loadShiftTimer();
  updateTimerPresetTabsUI();
  updateShiftTimerUI();
}

function startShiftTimer() {
  timerState = {
    isRunning: true,
    isPaused: false,
    startedAt: Date.now(),
    pausedAt: null,
    totalPausedMs: 0,
    presetType: currentTimerPresetType,
  };
  saveShiftTimer(timerState);
  updateShiftTimerUI();
  triggerHaptic([20, 30]);
}

function togglePauseShiftTimer() {
  if (!timerState) return;
  const now = Date.now();
  if (timerState.isPaused) {
    if (timerState.pausedAt) {
      timerState.totalPausedMs = (timerState.totalPausedMs || 0) + (now - timerState.pausedAt);
    }
    timerState.isPaused = false;
    timerState.pausedAt = null;
    triggerHaptic(15);
  } else {
    timerState.isPaused = true;
    timerState.pausedAt = now;
    triggerHaptic(10);
  }
  saveShiftTimer(timerState);
  updateShiftTimerUI();
}

function finishShiftTimer() {
  if (!timerState) return;
  const startDate = new Date(timerState.startedAt);
  const endDate = new Date(timerState.isPaused ? (timerState.pausedAt || Date.now()) : Date.now());

  const startH = String(startDate.getHours()).padStart(2, "0");
  const startM = String(startDate.getMinutes()).padStart(2, "0");
  const endH = String(endDate.getHours()).padStart(2, "0");
  const endM = String(endDate.getMinutes()).padStart(2, "0");

  const dateKey = formatDateKey(startDate);
  const presetType = timerState.presetType || "day";
  const breakMins = Math.round((timerState.totalPausedMs || 0) / (1000 * 60));

  clearShiftTimer();
  timerState = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  updateShiftTimerUI();

  // Открываем модалку смены с предзаполненными данными
  openShiftModal(dateKey);

  setSegmentedValue("shiftTypeSegmented", "shiftType", presetType);
  elements.startTime.value = `${startH}:${startM}`;
  elements.endTime.value = `${endH}:${endM}`;
  elements.breakMins.value = breakMins;
  recalcModal();

  showToast("Смена завершена! Проверьте данные и нажмите Сохранить", "info", null, 4000);
  triggerHaptic([20, 40, 20]);
}

async function cancelShiftTimer() {
  if (!timerState) return;
  const confirmed = await showConfirm({
    title: "Сбросить таймер?",
    message: "Текущее отработанное время будет сброшено без сохранения в календарь.",
    confirmText: "Сбросить",
    cancelText: "Отмена",
    type: "danger",
  });
  if (!confirmed) return;

  clearShiftTimer();
  timerState = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  updateShiftTimerUI();
  triggerHaptic(15);
  showToast("Таймер сброшен", "info");
}

// ============================================================
// Сверка с расчетным листком (Payslip Audit)
// ============================================================
let payslipAuditOpen = false;

function togglePayslipAudit() {
  payslipAuditOpen = !payslipAuditOpen;
  if (elements.payslipAuditBody) {
    elements.payslipAuditBody.style.display = payslipAuditOpen ? "block" : "none";
  }
  if (elements.payslipToggleArrow) {
    elements.payslipToggleArrow.textContent = payslipAuditOpen ? "▴" : "▾";
    elements.payslipToggleArrow.classList.toggle("payslip-audit__arrow--open", payslipAuditOpen);
  }
  if (elements.payslipToggleBtn) {
    elements.payslipToggleBtn.setAttribute("aria-expanded", String(payslipAuditOpen));
  }
  if (payslipAuditOpen && elements.payslipActualInput) {
    setTimeout(() => elements.payslipActualInput.focus(), 100);
  }
}

function runPayslipAudit() {
  if (!elements.payslipActualInput || !elements.payslipAuditResult) return;
  const actualVal = parseFloat(elements.payslipActualInput.value);
  if (isNaN(actualVal) || actualVal < 0) {
    showToast("Введите корректную сумму из расчётного листка", "error");
    elements.payslipActualInput.focus();
    return;
  }

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const summary = calcMonthSummary(shifts, year, month);
  const expectedIncome = summary.totalIncome;

  const result = verifyPayslip(actualVal, expectedIncome);
  const curr = settings.currency || "₽";

  elements.payslipAuditResult.style.display = "block";
  elements.payslipAuditResult.className = `payslip-audit__result payslip-audit__result--${result.status}`;

  if (result.status === "match") {
    elements.payslipAuditResult.innerHTML = `
      <div class="payslip-audit__badge payslip-audit__badge--match">✓ Сходится точь-в-точь</div>
      <div class="payslip-audit__text">Расчёты приложения и расчётного листка полностью совпадают: <strong>${actualVal.toLocaleString("ru-RU")} ${curr}</strong>.</div>
    `;
  } else if (result.status === "underpaid") {
    elements.payslipAuditResult.innerHTML = `
      <div class="payslip-audit__badge payslip-audit__badge--underpaid">⚠ Недоплата: -${result.diff.toLocaleString("ru-RU")} ${curr}</div>
      <div class="payslip-audit__text">По вашему графику начислено <strong>${expectedIncome.toLocaleString("ru-RU")} ${curr}</strong>, а в листке указано <strong>${actualVal.toLocaleString("ru-RU")} ${curr}</strong>. Проверьте количество учтённых часов или штрафы/удержания.</div>
    `;
  } else {
    elements.payslipAuditResult.innerHTML = `
      <div class="payslip-audit__badge payslip-audit__badge--overpaid">ℹ Переплата: +${Math.abs(result.diff).toLocaleString("ru-RU")} ${curr}</div>
      <div class="payslip-audit__text">В листке начислено больше, чем по табелю (<strong>${actualVal.toLocaleString("ru-RU")} ${curr}</strong> против <strong>${expectedIncome.toLocaleString("ru-RU")} ${curr}</strong>). Возможно, начислены премии или отпускные.</div>
    `;
  }
  triggerHaptic(15);
}

// ============================================================
// Service Worker & PWA Install
// ============================================================

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if (elements.installAppDivider) elements.installAppDivider.style.display = 'block';
  if (elements.installAppTitle) elements.installAppTitle.style.display = 'block';
  if (elements.installAppContainer) elements.installAppContainer.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;

  if (elements.installAppDivider) elements.installAppDivider.style.display = 'none';
  if (elements.installAppTitle) elements.installAppTitle.style.display = 'none';
  if (elements.installAppContainer) elements.installAppContainer.style.display = 'none';
});

function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        reg.update();

        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              if (elements.updateBanner) {
                elements.updateBanner.style.display = "block";
              }
            }
          });
        });
      })
      .catch((err) => {
        console.warn("SW registration error:", err);
      });

    if (elements.updateReloadBtn) {
      elements.updateReloadBtn.addEventListener("click", () => {
        navigator.serviceWorker.getRegistration().then((reg) => {
          if (reg && reg.waiting) {
            reg.waiting.postMessage({ action: "skipWaiting" });
          }
        });
        window.location.reload();
      });
    }
  });
}

// ============================================================
// Привязка событий
// ============================================================
function bindEvents() {
  // Глобальный тактильный отклик (Haptic Feedback) на нажатие интерактивных элементов
  document.addEventListener("pointerdown", (e) => {
    const target = e.target.closest(
      "button, .btn, [role='button'], [role='tab'], .calendar__day, .segmented__btn, .stats__card"
    );
    if (target && !target.disabled) {
      triggerHaptic(8);
    }
  }, { passive: true });

  // Навигация
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

  if (elements.todayBtn) {
    elements.todayBtn.addEventListener("click", (e) => {
      goToToday();
      e.currentTarget.blur();
    });
  }

  // Тема и настройки
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.settingsBtn.addEventListener("click", openSettings);

  // Интерактивное сравнение с прошлым месяцем по тапу на карточки
  if (elements.statIncomeCard) {
    elements.statIncomeCard.addEventListener("click", () => {
      if (lastMonthComparisonSummary) {
        const s = lastMonthComparisonSummary;
        const sign = s.diffIncome >= 0 ? "+" : "";
        const arrow = s.diffIncome >= 0 ? "↗" : "↘";
        const curr = settings.currency || "₽";
        const msg = `${s.prevMonthName}: ${s.prevIncome.toLocaleString("ru-RU")} ${curr} (${s.prevShiftsCount} см)\n${s.curMonthName}: ${s.currentIncome.toLocaleString("ru-RU")} ${curr} (${s.currentShifts} см)\n${arrow} Разница дохода: ${sign}${s.diffIncome.toLocaleString("ru-RU")} ${curr} (${sign}${s.pctIncome}%)`;
        showToast(msg, "info", null, 4500);
      } else {
        showToast("Нет данных за предыдущий месяц для сравнения", "info");
      }
    });
    elements.statIncomeCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.statIncomeCard.click();
      }
    });
  }

  if (elements.statShiftsCard) {
    elements.statShiftsCard.addEventListener("click", () => {
      if (lastMonthComparisonSummary) {
        const s = lastMonthComparisonSummary;
        const sign = s.diffShifts >= 0 ? "+" : "";
        const arrow = s.diffShifts >= 0 ? "↗" : "↘";
        const msg = `${s.prevMonthName}: ${s.prevShiftsCount} см\n${s.curMonthName}: ${s.currentShifts} см\n${arrow} Разница смен: ${sign}${s.diffShifts} см`;
        showToast(msg, "info", null, 4000);
      } else {
        showToast("Нет данных за предыдущий месяц для сравнения", "info");
      }
    });
    elements.statShiftsCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.statShiftsCard.click();
      }
    });
  }

  if (elements.statHoursCard) {
    elements.statHoursCard.addEventListener("click", () => {
      if (lastMonthComparisonSummary) {
        const s = lastMonthComparisonSummary;
        const sign = s.diffHours >= 0 ? "+" : "";
        const arrow = s.diffHours >= 0 ? "↗" : "↘";
        const msg = `${s.prevMonthName}: ${s.prevHours} ч\n${s.curMonthName}: ${s.currentHours} ч\n${arrow} Разница часов: ${sign}${s.diffHours} ч`;
        showToast(msg, "info", null, 4000);
      } else {
        showToast("Нет данных за предыдущий месяц для сравнения", "info");
      }
    });
    elements.statHoursCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.statHoursCard.click();
      }
    });
  }

  // Экспорт
  elements.exportMonthBtn.addEventListener("click", () => handleExportCSV(false));
  elements.exportAllBtn.addEventListener("click", () => handleExportCSV(true));

  // Детализация смен
  if (elements.openShiftsBtn) {
    elements.openShiftsBtn.addEventListener("click", () => {
      renderShiftList({
        listEl: elements.shiftList,
        wrapperEl: elements.shiftListWrapper,
        monthShifts: currentMonthShiftsCache,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
        filter: "all",
        settings,
        onShiftClick: openShiftModal,
      });
      openModal("shiftsModal");
    });
  }
  if (elements.shiftsModalCloseBtn) {
    elements.shiftsModalCloseBtn.addEventListener("click", () => closeModal("shiftsModal"));
  }

  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      shifts = loadShifts();
      render();
    } else if (e.key === SETTINGS_KEY) {
      settings = loadSettings();
      updatePayModeLabels();
      updatePresetTimesUI();
      render();
    } else if (e.key === TIMER_STORAGE_KEY) {
      timerState = loadShiftTimer();
      updateShiftTimerUI();
    }
  });
  if (elements.shiftList) {
    elements.shiftList.addEventListener("scroll", () => {
      updateShiftListScrollGradients(elements.shiftList, elements.shiftListWrapper);
    }, { passive: true });
  }
  window.addEventListener("resize", () => {
    updateShiftListScrollGradients(elements.shiftList, elements.shiftListWrapper);
  }, { passive: true });

  // Форма смены
  elements.shiftForm.addEventListener("submit", saveShift);
  elements.shiftModalCloseBtn.addEventListener("click", () => closeModal("shiftModal"));
  elements.deleteBtn.addEventListener("click", deleteShift);

  // Пересчёт при изменении полей модалки
  elements.startTime.addEventListener("change", recalcModal);
  elements.endTime.addEventListener("change", recalcModal);
  elements.breakMins.addEventListener("change", recalcModal);
  elements.payMode.addEventListener("change", recalcModal);
  elements.rate.addEventListener("input", recalcModal);
  elements.bonus.addEventListener("input", recalcModal);

  // Форма настроек
  elements.settingsForm.addEventListener("submit", saveSettingsFromModal);
  elements.settingsModalCloseBtn.addEventListener("click", () => closeModal("settingsModal"));
  if (elements.defPresetName) {
    elements.defPresetName.addEventListener("input", () => {
      const val = elements.defPresetName.value.trim();
      const fallback = currentSettingsPreset === "day" ? "День" : currentSettingsPreset === "night" ? "Ночь" : "Подработка";
      const labelEl = currentSettingsPreset === "day"
        ? elements.settingsPresetLabelDay
        : currentSettingsPreset === "night"
        ? elements.settingsPresetLabelNight
        : elements.settingsPresetLabelExtra;
      if (labelEl) {
        labelEl.textContent = val || fallback;
      }
    });
  }
  if (elements.recalcMonthRatesBtn) {
    elements.recalcMonthRatesBtn.addEventListener("click", recalcCurrentMonthRates);
  }

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

  // Таймер текущей смены
  if (elements.shiftTimerStartBtn) {
    elements.shiftTimerStartBtn.addEventListener("click", startShiftTimer);
  }
  if (elements.timerTabDay) {
    elements.timerTabDay.addEventListener("click", () => setTimerPreset("day"));
  }
  if (elements.timerTabNight) {
    elements.timerTabNight.addEventListener("click", () => setTimerPreset("night"));
  }
  if (elements.timerTabExtra) {
    elements.timerTabExtra.addEventListener("click", () => setTimerPreset("extra"));
  }
  if (elements.shiftTimerPauseBtn) {
    elements.shiftTimerPauseBtn.addEventListener("click", togglePauseShiftTimer);
  }
  if (elements.shiftTimerFinishBtn) {
    elements.shiftTimerFinishBtn.addEventListener("click", finishShiftTimer);
  }
  if (elements.shiftTimerCancelBtn) {
    elements.shiftTimerCancelBtn.addEventListener("click", cancelShiftTimer);
  }

  // Сверка с расчетным листком
  if (elements.payslipToggleBtn) {
    elements.payslipToggleBtn.addEventListener("click", togglePayslipAudit);
  }
  if (elements.payslipCalcBtn) {
    elements.payslipCalcBtn.addEventListener("click", runPayslipAudit);
  }
  if (elements.payslipActualInput) {
    elements.payslipActualInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        runPayslipAudit();
      }
    });
  }

  // Бэкап
  elements.backupDownloadBtn.addEventListener("click", handleBackupDownload);
  elements.backupRestoreBtn.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", handleBackupRestore);

  // Установка PWA
  if (elements.installPwaBtn) {
    elements.installPwaBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
      }
    });
  }

  // Безопасное восстановление данных
  if (elements.restoreConfirmBtn) {
    elements.restoreConfirmBtn.addEventListener("click", confirmRestore);
  }
  if (elements.restoreCancelBtn) {
    elements.restoreCancelBtn.addEventListener("click", cancelRestore);
  }
  if (elements.restoreBackupFirstBtn) {
    elements.restoreBackupFirstBtn.addEventListener("click", () => {
      handleBackupDownload();
    });
  }

  // Закрытие модалок по клику на фон оверлея
  [
    elements.shiftModal,
    elements.settingsModal,
    elements.shiftsModal,
    elements.scheduleModal,
    elements.restoreModal,
  ].filter(Boolean).forEach((overlay) => {
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
      closeModal("restoreModal");
    }
  });
}

// ============================================================
// Инициализация приложения
// ============================================================
applyTheme(currentTheme);
initSegmentedControls();
initShiftTimer();
requestPersistentStorage();
bindEvents();
initCalendarSwipe(document.querySelector(".calendar"), elements.calendarGrid, {
  onSwipeLeft: () => changeMonth(1),
  onSwipeRight: () => changeMonth(-1),
});
initBottomSheetSwipe();
registerSW();
render();
