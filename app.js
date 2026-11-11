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
  PAID_PAYOUTS_KEY,
  DEFAULT_PRESETS,
  loadShifts,
  saveShifts,
  loadSettings,
  saveSettings,
  loadTheme,
  saveTheme,
  loadPaidPayouts,
  savePaidPayouts,
  requestPersistentStorage,
} from "./data/storage.js";

import {
  downloadBackup,
  parseBackupFile,
  exportCSV,
  exportICS,
} from "./data/backup.js";

import {
  formatDateKey,
  calcHoursDiff,
  calcShiftPay,
  calcMonthSummary,
  calcPayoutSchedule,
  recalcMonthShifts,
  verifyPayslip,
} from "./domain/payroll.js";

import { buildShiftFromPreset } from "./domain/schedule.js";

import {
  MONTH_NAMES,
  MONTH_NAMES_GENITIVE,
  TEMPLATE_COLORS,
  TEMPLATE_ICONS,
  DEFAULT_TEMPLATE_STYLE,
  renderIconSvgByKey,
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
  renderShiftsPayoutSummary,
  formatPayoutKey,
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
let paidPayouts = loadPaidPayouts();
let currentMonthShiftsCache = [];
let currentSettingsPreset = "day";
let deferredPrompt = null;
let tempPresets = {};
let lastPayoutSchedule = null;
let currentTimerPresetType = "day";
let isStampMode = false;
let hasUnsavedShiftEdits = false;
let payslipAuditOpen = false;
let pendingRestoreData = null;

// ============================================================
// Кэширование DOM-элементов
// ============================================================
const elements = {
  // Навигация и заголовок
  monthTitle: document.getElementById("monthTitle"),
  prevMonthBtn: document.getElementById("prevMonthBtn"),
  nextMonthBtn: document.getElementById("nextMonthBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeIcon: document.getElementById("themeIcon"),
  settingsBtn: document.getElementById("settingsBtn"),
  metaThemeColors: document.querySelectorAll('meta[name="theme-color"]'),

  // Быстрое добавление смены и штамп под календарем
  shiftTimerWidget: document.getElementById("shiftTimerWidget"),
  shiftTimerIdle: document.getElementById("shiftTimerIdle"),
  quickAddShiftBtn: document.getElementById("quickAddShiftBtn"),
  stampModeToggleBtn: document.getElementById("stampModeToggleBtn"),
  shiftTimerPresetTabs: document.getElementById("shiftTimerPresetTabs"),
  timerTabDay: document.getElementById("timerTabDay"),
  timerTabNight: document.getElementById("timerTabNight"),
  timerTabExtra: document.getElementById("timerTabExtra"),
  timerTabIconDay: document.getElementById("timerTabIconDay"),
  timerTabIconNight: document.getElementById("timerTabIconNight"),
  timerTabIconExtra: document.getElementById("timerTabIconExtra"),
  timerTabNameDay: document.getElementById("timerTabNameDay"),
  timerTabNameNight: document.getElementById("timerTabNameNight"),
  timerTabNameExtra: document.getElementById("timerTabNameExtra"),

  // График выплат (Аванс / ЗП 12-го)
  payoutStrip: document.getElementById("payoutStrip"),
  payoutSalaryCard: document.getElementById("payoutSalaryCard"),
  payoutSalaryTitle: document.getElementById("payoutSalaryTitle"),
  payoutSalaryPeriod: document.getElementById("payoutSalaryPeriod"),
  payoutSalaryValue: document.getElementById("payoutSalaryValue"),
  payoutSalaryStatus: document.getElementById("payoutSalaryStatus"),
  payoutSalaryMeta: document.getElementById("payoutSalaryMeta"),
  payoutAdvanceCard: document.getElementById("payoutAdvanceCard"),
  payoutAdvanceTitle: document.getElementById("payoutAdvanceTitle"),
  payoutAdvancePeriod: document.getElementById("payoutAdvancePeriod"),
  payoutAdvanceValue: document.getElementById("payoutAdvanceValue"),
  payoutAdvanceStatus: document.getElementById("payoutAdvanceStatus"),
  payoutAdvanceMeta: document.getElementById("payoutAdvanceMeta"),
  shiftsPayoutSummary: document.getElementById("shiftsPayoutSummary"),

  // Статистика
  statShifts: document.getElementById("statShifts"),
  statHours: document.getElementById("statHours"),
  statIncome: document.getElementById("statIncome"),
  statShiftsBadge: document.getElementById("statShiftsBadge"),

  // Календарь и триггер смен
  calendarGrid: document.getElementById("calendarGrid"),
  openShiftsBtn: document.getElementById("openShiftsBtn"),

  // Модальное окно деталей смен (Шторка)
  shiftsModal: document.getElementById("shiftsModal"),
  shiftsModalTitle: document.getElementById("shiftsModalTitle"),
  shiftsModalMonth: document.getElementById("shiftsModalMonth"),
  shiftsModalCloseBtn: document.getElementById("shiftsModalCloseBtn"),
  shiftsFilter: document.getElementById("shiftsFilter"),
  shiftList: document.getElementById("shiftList"),
  shiftListWrapper: document.getElementById("shiftListWrapper"),

  // Экспорт
  exportMonthBtn: document.getElementById("exportMonthBtn"),
  exportAllBtn: document.getElementById("exportAllBtn"),
  exportIcsBtn: document.getElementById("exportIcsBtn"),

  // Модальное окно смены
  shiftModal: document.getElementById("shiftModal"),
  shiftModalTitle: document.getElementById("shiftModalTitle"),
  shiftModalCloseBtn: document.getElementById("shiftModalCloseBtn"),
  shiftForm: document.getElementById("shiftForm"),
  shiftDate: document.getElementById("shiftDate"),
  shiftDateWarning: document.getElementById("shiftDateWarning"),
  shiftType: document.getElementById("shiftType"),
  shiftTypeSegmented: document.getElementById("shiftTypeSegmented"),
  presetIconDay: document.getElementById("presetIconDay"),
  presetIconNight: document.getElementById("presetIconNight"),
  presetIconExtra: document.getElementById("presetIconExtra"),
  presetTitleDay: document.getElementById("presetTitleDay"),
  presetTitleNight: document.getElementById("presetTitleNight"),
  presetTitleExtra: document.getElementById("presetTitleExtra"),
  presetTimeDay: document.getElementById("presetTimeDay"),
  presetTimeNight: document.getElementById("presetTimeNight"),
  presetTimeExtra: document.getElementById("presetTimeExtra"),
  startTime: document.getElementById("startTime"),
  endTime: document.getElementById("endTime"),
  totalHours: document.getElementById("totalHours"),
  totalHoursDisplay: document.getElementById("totalHoursDisplay"),
  payMode: document.getElementById("payMode"),
  payModeSegmented: document.getElementById("payModeSegmented"),
  rateLabel: document.getElementById("rateLabel"),
  rate: document.getElementById("rate"),
  totalPayDisplay: document.getElementById("totalPayDisplay"),
  totalPay: document.getElementById("totalPay"),
  note: document.getElementById("note"),
  deleteBtn: document.getElementById("deleteBtn"),

  // Модальное окно настроек
  settingsModal: document.getElementById("settingsModal"),
  settingsModalCloseBtn: document.getElementById("settingsModalCloseBtn"),
  settingsForm: document.getElementById("settingsForm"),
  settingsPresetSegmented: document.getElementById("settingsPresetSegmented"),
  settingsPresetIconDay: document.getElementById("settingsPresetIconDay"),
  settingsPresetIconNight: document.getElementById("settingsPresetIconNight"),
  settingsPresetIconExtra: document.getElementById("settingsPresetIconExtra"),
  settingsPresetLabelDay: document.getElementById("settingsPresetLabelDay"),
  settingsPresetLabelNight: document.getElementById("settingsPresetLabelNight"),
  settingsPresetLabelExtra: document.getElementById("settingsPresetLabelExtra"),
  settingsActivePreset: document.getElementById("settingsActivePreset"),
  defPresetName: document.getElementById("defPresetName"),
  defStart: document.getElementById("defStart"),
  defEnd: document.getElementById("defEnd"),
  defPresetColors: document.getElementById("defPresetColors"),
  defPresetColor: document.getElementById("defPresetColor"),
  defPresetIcons: document.getElementById("defPresetIcons"),
  defPresetIcon: document.getElementById("defPresetIcon"),
  defPayMode: document.getElementById("defPayMode"),
  defPayModeSegmented: document.getElementById("defPayModeSegmented"),
  defRate: document.getElementById("defRate"),
  recalcMonthRatesBtn: document.getElementById("recalcMonthRatesBtn"),
  defCurrency: document.getElementById("defCurrency"),
  defPayoutMode: document.getElementById("defPayoutMode"),
  defPayoutModeSegmented: document.getElementById("defPayoutModeSegmented"),
  payoutSettingsFields: document.getElementById("payoutSettingsFields"),
  defCutoffDay: document.getElementById("defCutoffDay"),
  defAdvancePayDay: document.getElementById("defAdvancePayDay"),
  defSalaryPayDay: document.getElementById("defSalaryPayDay"),
  payoutRuleHint: document.getElementById("payoutRuleHint"),

  // Бэкап и установка PWA
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
// Вспомогательные утилиты
// ============================================================
function clampNonNegativeRate(rawVal) {
  const n = parseFloat(rawVal);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function showShiftDateWarning(message) {
  if (!elements.shiftDateWarning) return;
  elements.shiftDateWarning.textContent = message;
  elements.shiftDateWarning.style.display = "block";
}

function hideShiftDateWarning() {
  if (!elements.shiftDateWarning) return;
  elements.shiftDateWarning.textContent = "";
  elements.shiftDateWarning.style.display = "none";
}

function pulseCalendarCell(dateKey) {
  if (!dateKey) return;
  requestAnimationFrame(() => {
    const cell = document.querySelector(`.calendar__day-cell[data-date-key="${dateKey}"]`);
    if (!cell) return;
    cell.classList.remove("calendar__day-cell--pulse");
    requestAnimationFrame(() => {
      cell.classList.add("calendar__day-cell--pulse");
    });
  });
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

function getPresetIconHtml(presetObj, type, className = "segmented-control__icon") {
  const fallback = DEFAULT_TEMPLATE_STYLE[type] || DEFAULT_TEMPLATE_STYLE.day;
  const iconKey = presetObj?.icon && TEMPLATE_ICONS[presetObj.icon] ? presetObj.icon : fallback.icon;
  const color = presetObj?.color || fallback.color;
  return renderIconSvgByKey(iconKey, className, color);
}

function updatePresetTimesUI() {
  const p = settings.presets || DEFAULT_PRESETS;
  const dayName = p.day?.name || "День";
  const nightName = p.night?.name || "Ночь";
  const extraName = p.extra?.name || "Подработка";

  if (elements.presetIconDay) elements.presetIconDay.innerHTML = getPresetIconHtml(p.day, "day");
  if (elements.presetIconNight) elements.presetIconNight.innerHTML = getPresetIconHtml(p.night, "night");
  if (elements.presetIconExtra) elements.presetIconExtra.innerHTML = getPresetIconHtml(p.extra, "extra");

  if (elements.presetTitleDay) elements.presetTitleDay.textContent = dayName;
  if (elements.presetTimeDay) elements.presetTimeDay.textContent = `${p.day.start}–${p.day.end}`;

  if (elements.presetTitleNight) elements.presetTitleNight.textContent = nightName;
  if (elements.presetTimeNight) elements.presetTimeNight.textContent = `${p.night.start}–${p.night.end}`;

  if (elements.presetTitleExtra) elements.presetTitleExtra.textContent = extraName;
  if (elements.presetTimeExtra) elements.presetTimeExtra.textContent = `${p.extra.start}–${p.extra.end}`;

  if (elements.settingsPresetIconDay) elements.settingsPresetIconDay.innerHTML = getPresetIconHtml(p.day, "day");
  if (elements.settingsPresetIconNight) elements.settingsPresetIconNight.innerHTML = getPresetIconHtml(p.night, "night");
  if (elements.settingsPresetIconExtra) elements.settingsPresetIconExtra.innerHTML = getPresetIconHtml(p.extra, "extra");

  if (elements.settingsPresetLabelDay) elements.settingsPresetLabelDay.textContent = dayName;
  if (elements.settingsPresetLabelNight) elements.settingsPresetLabelNight.textContent = nightName;
  if (elements.settingsPresetLabelExtra) elements.settingsPresetLabelExtra.textContent = extraName;

  updateTimerPresetTabsUI();
}

function applyPresetToModal(type) {
  const p = settings.presets?.[type] || DEFAULT_PRESETS[type] || DEFAULT_PRESETS.day;
  elements.startTime.value = p.start;
  elements.endTime.value = p.end;
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
        hasUnsavedShiftEdits = true;
        applyPresetToModal(val);
        triggerHaptic(12);
      },
    },
    {
      containerId: "payModeSegmented",
      inputId: "payMode",
      onChange: () => {
        hasUnsavedShiftEdits = true;
        recalcModal();
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
      containerId: "defPayoutModeSegmented",
      inputId: "defPayoutMode",
      onChange: () => {
        updatePayoutSettingsVisibility();
        triggerHaptic(10);
      },
    },
    {
      containerId: "shiftsFilterSegmented",
      inputId: "shiftsFilter",
      onChange: (filterVal) => {
        refreshShiftsModalContent(filterVal || "all");
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

function initArrowKeyNavigation() {
  document.addEventListener("keydown", (e) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement)) return;
    const group = active.closest('[role="tablist"], [role="radiogroup"]');
    if (!group) return;

    const items = Array.from(group.querySelectorAll('button:not([disabled]), [role="tab"]:not([disabled]), [role="radio"]:not([disabled])'));
    if (items.length <= 1) return;
    const idx = items.indexOf(active);
    if (idx === -1) return;

    e.preventDefault();
    let nextIdx = idx;
    if (e.key === "ArrowRight") nextIdx = (idx + 1) % items.length;
    else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + items.length) % items.length;
    else if (e.key === "Home") nextIdx = 0;
    else if (e.key === "End") nextIdx = items.length - 1;

    const target = items[nextIdx];
    target.focus();
    target.click();
  });
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
    pulseCalendarCell(formatDateKey(today));
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
    pulseCalendarCell(formatDateKey(today));
  }, 220);
}

// ============================================================
// Пересчёт и работа модалки смены
// ============================================================
function recalcModal() {
  const start = elements.startTime.value;
  const end = elements.endTime.value;
  const payMode = elements.payMode.value;
  const rate = clampNonNegativeRate(elements.rate.value);
  const curr = settings.currency || "₽";

  elements.rateLabel.textContent =
    payMode === "hourly"
      ? `Ставка в час (${curr})`
      : `За смену (${curr})`;

  const hours = calcHoursDiff(start, end, 0);
  elements.totalHours.value = hours;
  if (elements.totalHoursDisplay) {
    elements.totalHoursDisplay.textContent = `${hours.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ч`;
  }

  const totalPay = calcShiftPay(hours, rate, payMode, 0);
  elements.totalPay.value = totalPay;
  if (elements.totalPayDisplay) {
    elements.totalPayDisplay.textContent = `${totalPay.toLocaleString("ru-RU")} ${curr}`;
  }
}

function syncShiftModalForDate(dateKey, forcedType = null) {
  if (!dateKey) return;
  const existing = shifts[dateKey];
  const [y, m, d] = dateKey.split("-");
  elements.shiftModalTitle.textContent = `Смена ${d}.${m}.${y}`;

  if (existing && !forcedType) {
    setSegmentedValue("shiftTypeSegmented", "shiftType", existing.type || "day");
    elements.startTime.value = existing.start;
    elements.endTime.value = existing.end;
    setSegmentedValue("payModeSegmented", "payMode", existing.payMode || "hourly");
    elements.rate.value = existing.rate;
    elements.note.value = existing.note || "";
    elements.deleteBtn.style.display = "block";
    recalcModal();
  } else {
    const type = forcedType || (existing?.type || "day");
    setSegmentedValue("shiftTypeSegmented", "shiftType", type);
    const p = settings.presets?.[type] || DEFAULT_PRESETS[type] || DEFAULT_PRESETS.day;
    elements.startTime.value = p.start;
    elements.endTime.value = p.end;
    setSegmentedValue("payModeSegmented", "payMode", settings.payMode);
    elements.rate.value = settings.rate;
    elements.note.value = existing ? (existing.note || "") : "";
    elements.deleteBtn.style.display = existing ? "block" : "none";
    recalcModal();
  }
}

function openShiftModal(dateKey, forcedType = null, warningMsg = "") {
  closeModal("shiftsModal");
  updatePayModeLabels();
  updatePresetTimesUI();
  elements.shiftDate.value = dateKey;
  hasUnsavedShiftEdits = false;
  syncShiftModalForDate(dateKey, forcedType);
  if (warningMsg) {
    showShiftDateWarning(warningMsg);
  } else {
    hideShiftDateWarning();
  }
  openModal("shiftModal");
}

function saveShift(e) {
  e.preventDefault();
  const dateKey = elements.shiftDate.value;
  if (!dateKey) return;

  shifts = loadShifts();

  const hours = calcHoursDiff(elements.startTime.value, elements.endTime.value, 0);
  const payMode = elements.payMode.value;
  const rate = clampNonNegativeRate(elements.rate.value);
  const totalPay = calcShiftPay(hours, rate, payMode, 0);
  shifts[dateKey] = {
    type: elements.shiftType.value,
    start: elements.startTime.value,
    end: elements.endTime.value,
    breakMins: 0,
    hours,
    payMode,
    rate,
    bonus: 0,
    totalPay,
    note: elements.note.value.trim(),
    tags: [],
  };
  if (!saveShifts(shifts)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
  hasUnsavedShiftEdits = false;
  hideShiftDateWarning();
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

  shifts = loadShifts();

  delete shifts[dateKey];
  if (!saveShifts(shifts)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
  hasUnsavedShiftEdits = false;
  hideShiftDateWarning();
  closeModal("shiftModal");
  render();
  triggerHaptic(20);
  showToast("Смена удалена", "info");
}

function quickAddDefaultShift(dateKey) {
  shifts = loadShifts();
  if (shifts[dateKey]) return;

  const type = currentTimerPresetType || "day";
  const safeRate = clampNonNegativeRate(settings.rate);
  shifts[dateKey] = buildShiftFromPreset(type, { ...settings, rate: safeRate });
  if (!saveShifts(shifts)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
  triggerHaptic([30, 40, 30]);
  render();
  pulseCalendarCell(dateKey);

  const [, m, d] = dateKey.split("-");
  const monthName = MONTH_NAMES_GENITIVE[parseInt(m, 10) - 1] || "";
  const preset = settings.presets?.[type] || DEFAULT_PRESETS[type] || DEFAULT_PRESETS.day;
  const shiftTitle = preset.name || "Смена";
  showToast(`${shiftTitle} добавлена: ${parseInt(d, 10)} ${monthName} (${preset.start}–${preset.end})`, "success");
}

// ============================================================
// Режим штампа (быстрое проставление/удаление смен в 1 тап)
// ============================================================
function setStampMode(active) {
  isStampMode = Boolean(active);
  if (elements.stampModeToggleBtn) {
    elements.stampModeToggleBtn.classList.toggle("is-active", isStampMode);
    elements.stampModeToggleBtn.setAttribute("aria-pressed", String(isStampMode));
  }
  if (elements.calendarGrid) {
    elements.calendarGrid.classList.toggle("calendar--stamp-active", isStampMode);
  }
}

function handleStampDay(dateKey) {
  if (!dateKey) return;
  shifts = loadShifts();
  const existing = shifts[dateKey];
  const type = currentTimerPresetType || "day";
  const preset = settings.presets?.[type] || DEFAULT_PRESETS[type] || DEFAULT_PRESETS.day;
  const presetName = preset.name || "Смена";
  const [, m, d] = dateKey.split("-");
  const dayNum = parseInt(d, 10);
  const monthGen = MONTH_NAMES_GENITIVE[parseInt(m, 10) - 1] || "";

  if (existing && existing.type === type) {
    const removedShift = { ...existing };
    delete shifts[dateKey];
    if (!saveShifts(shifts)) {
      showToast("Ошибка сохранения", "error");
      return;
    }
    render();
    triggerHaptic(15);
    showToast(`Смена удалена (${dayNum} ${monthGen})`, "info", {
      label: "Отменить",
      onClick: () => {
        shifts = loadShifts();
        shifts[dateKey] = removedShift;
        if (saveShifts(shifts)) {
          render();
          pulseCalendarCell(dateKey);
          triggerHaptic(12);
          showToast("Смена восстановлена", "success");
        }
      },
    });
    return;
  }

  const prevShift = existing ? { ...existing } : null;
  const safeRate = clampNonNegativeRate(settings.rate);
  shifts[dateKey] = buildShiftFromPreset(type, { ...settings, rate: safeRate });
  if (!saveShifts(shifts)) {
    showToast("Ошибка сохранения", "error");
    return;
  }
  render();
  pulseCalendarCell(dateKey);
  triggerHaptic([20, 30, 20]);

  if (prevShift) {
    showToast(`${presetName}: ${dayNum} ${monthGen}`, "success", {
      label: "Отменить",
      onClick: () => {
        shifts = loadShifts();
        shifts[dateKey] = prevShift;
        if (saveShifts(shifts)) {
          render();
          pulseCalendarCell(dateKey);
          triggerHaptic(12);
        }
      },
    });
  } else {
    showToast(`${presetName} добавлена: ${dayNum} ${monthGen}`, "success");
  }
}

// ============================================================
// Настройки
// ============================================================
function initTemplateStylePickers() {
  if (elements.defPresetColors) {
    elements.defPresetColors.innerHTML = "";
    TEMPLATE_COLORS.forEach((c) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "template-color-btn";
      btn.dataset.value = c.id;
      btn.title = c.label;
      btn.setAttribute("aria-label", c.label);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.style.setProperty("--swatch-color", c.id);
      btn.addEventListener("click", () => {
        if (elements.defPresetColor) elements.defPresetColor.value = c.id;
        updateTemplateStylePickerUI(c.id, elements.defPresetIcon?.value);
        saveCurrentSettingsInputsToTemp();
        triggerHaptic(8);
      });
      elements.defPresetColors.appendChild(btn);
    });
  }

  if (elements.defPresetIcons) {
    elements.defPresetIcons.innerHTML = "";
    Object.entries(TEMPLATE_ICONS).forEach(([key, def]) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "template-icon-btn";
      btn.dataset.value = key;
      btn.title = def.label;
      btn.setAttribute("aria-label", def.label);
      btn.setAttribute("role", "radio");
      btn.setAttribute("aria-checked", "false");
      btn.innerHTML = renderIconSvgByKey(key, "template-icon-btn__svg");
      btn.addEventListener("click", () => {
        if (elements.defPresetIcon) elements.defPresetIcon.value = key;
        updateTemplateStylePickerUI(elements.defPresetColor?.value, key);
        saveCurrentSettingsInputsToTemp();
        triggerHaptic(8);
      });
      elements.defPresetIcons.appendChild(btn);
    });
  }
}

function updateTemplateStylePickerUI(color, icon) {
  const activeColor = color || DEFAULT_TEMPLATE_STYLE.day.color;
  const activeIcon = icon || DEFAULT_TEMPLATE_STYLE.day.icon;

  if (elements.defPresetColors) {
    elements.defPresetColors.querySelectorAll(".template-color-btn").forEach((btn) => {
      const isActive = btn.dataset.value.toLowerCase() === activeColor.toLowerCase();
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-checked", String(isActive));
    });
  }

  if (elements.defPresetIcons) {
    elements.defPresetIcons.style.setProperty("--picker-accent", activeColor);
    elements.defPresetIcons.querySelectorAll(".template-icon-btn").forEach((btn) => {
      const isActive = btn.dataset.value === activeIcon;
      btn.classList.toggle("is-active", isActive);
      btn.setAttribute("aria-checked", String(isActive));
    });
  }
}

function updatePayoutSettingsVisibility() {
  const isOn = (elements.defPayoutMode?.value || "on") === "on";
  if (elements.payoutSettingsFields) {
    elements.payoutSettingsFields.style.display = isOn ? "" : "none";
  }
  updatePayoutRuleHint();
}

function updatePayoutRuleHint() {
  if (!elements.payoutRuleHint) return;
  const cutoff = Math.min(28, Math.max(1, parseInt(elements.defCutoffDay?.value, 10) || 15));
  const salaryDay = Math.min(31, Math.max(1, parseInt(elements.defSalaryPayDay?.value, 10) || 12));
  const advDay = Math.min(31, Math.max(1, parseInt(elements.defAdvancePayDay?.value, 10) || 27));
  elements.payoutRuleHint.textContent =
    `Аванс (выплата ${advDay}-го) учитывает смены с 1 по ${cutoff} число текущего месяца. ЗП за остаток месяца (с ${cutoff + 1}-го по конец) выплачивается ${salaryDay} числа следующего месяца.`;
}

function openSettings() {
  updatePayModeLabels();
  tempPresets = JSON.parse(JSON.stringify(settings.presets || DEFAULT_PRESETS));
  currentSettingsPreset = "day";
  setSegmentedValue("settingsPresetSegmented", "settingsActivePreset", "day");

  if (elements.settingsPresetLabelDay) elements.settingsPresetLabelDay.textContent = tempPresets.day?.name || "День";
  if (elements.settingsPresetLabelNight) elements.settingsPresetLabelNight.textContent = tempPresets.night?.name || "Ночь";
  if (elements.settingsPresetLabelExtra) elements.settingsPresetLabelExtra.textContent = tempPresets.extra?.name || "Подработка";
  if (elements.settingsPresetIconDay) elements.settingsPresetIconDay.innerHTML = getPresetIconHtml(tempPresets.day, "day");
  if (elements.settingsPresetIconNight) elements.settingsPresetIconNight.innerHTML = getPresetIconHtml(tempPresets.night, "night");
  if (elements.settingsPresetIconExtra) elements.settingsPresetIconExtra.innerHTML = getPresetIconHtml(tempPresets.extra, "extra");

  loadPresetIntoSettingsInputs("day");

  setSegmentedValue("defPayModeSegmented", "defPayMode", settings.payMode || "hourly");
  elements.defRate.value = settings.rate;

  const currVal = settings.currency || "₽";
  if (elements.defCurrency) {
    const hasOpt = Array.from(elements.defCurrency.options).some((opt) => opt.value === currVal);
    if (!hasOpt) {
      const opt = document.createElement("option");
      opt.value = currVal;
      opt.textContent = currVal;
      elements.defCurrency.appendChild(opt);
    }
    elements.defCurrency.value = currVal;
  }

  setSegmentedValue("defPayoutModeSegmented", "defPayoutMode", settings.payoutMode || "on");
  if (elements.defCutoffDay) elements.defCutoffDay.value = settings.advanceCutoffDay ?? 15;
  if (elements.defAdvancePayDay) elements.defAdvancePayDay.value = settings.advancePayDay ?? 27;
  if (elements.defSalaryPayDay) elements.defSalaryPayDay.value = settings.salaryPayDay ?? 12;
  updatePayoutSettingsVisibility();

  openModal("settingsModal");
}

function loadPresetIntoSettingsInputs(type) {
  const p = tempPresets[type] || DEFAULT_PRESETS[type];
  const fallbackStyle = DEFAULT_TEMPLATE_STYLE[type] || DEFAULT_TEMPLATE_STYLE.day;
  const fallback = type === "day" ? "День" : type === "night" ? "Ночь" : "Подработка";
  if (elements.defPresetName) {
    elements.defPresetName.value = p.name || fallback;
  }
  elements.defStart.value = p.start;
  elements.defEnd.value = p.end;
  const color = p.color || fallbackStyle.color;
  const icon = p.icon && TEMPLATE_ICONS[p.icon] ? p.icon : fallbackStyle.icon;
  if (elements.defPresetColor) elements.defPresetColor.value = color;
  if (elements.defPresetIcon) elements.defPresetIcon.value = icon;
  updateTemplateStylePickerUI(color, icon);
}

function saveCurrentSettingsInputsToTemp() {
  if (!tempPresets[currentSettingsPreset]) {
    tempPresets[currentSettingsPreset] = { ...DEFAULT_PRESETS[currentSettingsPreset] };
  }
  const fallbackStyle = DEFAULT_TEMPLATE_STYLE[currentSettingsPreset] || DEFAULT_TEMPLATE_STYLE.day;
  const fallback = currentSettingsPreset === "day" ? "День" : currentSettingsPreset === "night" ? "Ночь" : "Подработка";
  const customName = elements.defPresetName ? elements.defPresetName.value.trim() : "";
  tempPresets[currentSettingsPreset].name = customName || tempPresets[currentSettingsPreset].name || fallback;
  tempPresets[currentSettingsPreset].start = elements.defStart.value || DEFAULT_PRESETS[currentSettingsPreset].start;
  tempPresets[currentSettingsPreset].end = elements.defEnd.value || DEFAULT_PRESETS[currentSettingsPreset].end;
  tempPresets[currentSettingsPreset].breakMins = 0;
  tempPresets[currentSettingsPreset].color = elements.defPresetColor?.value || fallbackStyle.color;
  tempPresets[currentSettingsPreset].icon = elements.defPresetIcon?.value || fallbackStyle.icon;

  const labelEl = currentSettingsPreset === "day"
    ? elements.settingsPresetLabelDay
    : currentSettingsPreset === "night"
    ? elements.settingsPresetLabelNight
    : elements.settingsPresetLabelExtra;
  if (labelEl) {
    labelEl.textContent = tempPresets[currentSettingsPreset].name;
  }

  const iconEl = currentSettingsPreset === "day"
    ? elements.settingsPresetIconDay
    : currentSettingsPreset === "night"
    ? elements.settingsPresetIconNight
    : elements.settingsPresetIconExtra;
  if (iconEl) {
    iconEl.innerHTML = getPresetIconHtml(tempPresets[currentSettingsPreset], currentSettingsPreset);
  }
}

function saveSettingsFromModal(e) {
  e.preventDefault();
  saveCurrentSettingsInputsToTemp();

  settings.presets = tempPresets;
  settings.start = tempPresets.day.start;
  settings.end = tempPresets.day.end;
  settings.breakMins = 0;
  settings.payMode = elements.defPayMode.value;
  settings.rate = clampNonNegativeRate(elements.defRate.value);
  settings.currency = elements.defCurrency.value.trim() || "₽";
  settings.payoutMode = elements.defPayoutMode?.value || "on";
  settings.advanceCutoffDay = Math.min(28, Math.max(1, parseInt(elements.defCutoffDay?.value, 10) || 15));
  settings.advancePayDay = Math.min(31, Math.max(1, parseInt(elements.defAdvancePayDay?.value, 10) || 27));
  settings.salaryPayDay = Math.min(31, Math.max(1, parseInt(elements.defSalaryPayDay?.value, 10) || 12));

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
  const newRate = clampNonNegativeRate(elements.defRate.value);
  const newPayMode = elements.defPayMode ? elements.defPayMode.value : (settings.payMode || "hourly");
  const curr = (elements.defCurrency && elements.defCurrency.value.trim()) || settings.currency || "₽";

  const monthSummary = calcMonthSummary(shifts, year, month, settings.advanceCutoffDay || 15);
  const count = monthSummary.totalShifts;

  if (count === 0) {
    showToast("В этом месяце нет смен для пересчета", "info");
    return;
  }

  const countText = `${count} ${getRussianDeclension(count, ["смену", "смены", "смен"])}`;
  const rateLabel = newPayMode === "hourly" ? `${newRate} ${curr}/час` : `${newRate} ${curr}/смена`;

  const confirmed = await showConfirm({
    title: "Пересчитать смены месяца?",
    message: `Применить ставку ${rateLabel} для ${countText} за ${MONTH_NAMES[month]} ${year}? Индивидуальные часы и заметки сохранятся.`,
    confirmText: "Пересчитать",
    cancelText: "Отмена",
    type: "primary",
  });

  if (!confirmed) return;

  shifts = loadShifts();
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
// Бэкап и Экспорт
// ============================================================
async function handleBackupDownload() {
  try {
    const res = await downloadBackup(shifts, settings, paidPayouts);
    if (res.shared) {
      showToast("Резервная копия отправлена", "success");
    } else if (!res.aborted) {
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

  const prevShifts = loadShifts();
  const prevSettings = loadSettings();
  const prevPaidPayouts = loadPaidPayouts();

  const nextShifts = pendingRestoreData.shifts;
  const nextSettings = pendingRestoreData.settings;
  const nextPaidPayouts = pendingRestoreData.paidPayouts && typeof pendingRestoreData.paidPayouts === "object"
    ? pendingRestoreData.paidPayouts
    : {};

  // Атомарная запись в localStorage до обновления глобального состояния
  if (!saveShifts(nextShifts)) {
    showToast("Ошибка сохранения смен при восстановлении", "error");
    return;
  }

  if (!saveSettings(nextSettings)) {
    saveShifts(prevShifts);
    showToast("Ошибка сохранения настроек при восстановлении", "error");
    return;
  }

  if (!savePaidPayouts(nextPaidPayouts)) {
    saveShifts(prevShifts);
    saveSettings(prevSettings);
    savePaidPayouts(prevPaidPayouts);
    showToast("Ошибка сохранения статусов выплат при восстановлении", "error");
    return;
  }

  shifts = nextShifts;
  settings = nextSettings;
  paidPayouts = nextPaidPayouts;
  pendingRestoreData = null;

  closeModal("restoreModal");
  closeModal("settingsModal");
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

function handleExportICS() {
  const res = exportICS({
    shifts,
    settings,
    year: currentDate.getFullYear(),
    month: currentDate.getMonth(),
  });

  if (res.count === 0) {
    showToast("В этом месяце нет смен для экспорта", "info");
    return;
  }

  triggerHaptic(15);
  showToast(`Календарь .ics скачан (${res.count} см)`, "success");
}

// ============================================================
// Тема
// ============================================================
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const themeColor = theme === "light" ? "#f5f5f7" : "#101115";

  if (elements.metaThemeColors && elements.metaThemeColors.length > 0) {
    elements.metaThemeColors.forEach((meta) => {
      meta.setAttribute("content", themeColor);
    });
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
// Детализация смен и статусы выплат
// ============================================================
function handleTogglePaid(payoutKey) {
  if (!payoutKey) return;
  paidPayouts = loadPaidPayouts();
  const isCurrentlyPaid = Boolean(paidPayouts[payoutKey]?.paid);

  if (isCurrentlyPaid) {
    delete paidPayouts[payoutKey];
  } else {
    paidPayouts[payoutKey] = {
      paid: true,
      paidAt: new Date().toISOString(),
    };
  }

  if (!savePaidPayouts(paidPayouts)) {
    showToast("Ошибка сохранения статуса выплаты", "error");
    return;
  }

  triggerHaptic(12);
  render();
  showToast(isCurrentlyPaid ? "Статус сброшен: Ожидается" : "Отмечено: Выплачено", "success");
}

function refreshShiftsModalContent(filterOverride = null) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const activeFilter = filterOverride || elements.shiftsFilter?.value || "all";

  if ((settings.payoutMode || "on") === "on" && lastPayoutSchedule && elements.shiftsPayoutSummary) {
    renderShiftsPayoutSummary({
      summaryEl: elements.shiftsPayoutSummary,
      payout: lastPayoutSchedule,
      year,
      month,
      currency: settings.currency || "₽",
      paidPayouts,
      onTogglePaid: handleTogglePaid,
    });
  } else if (elements.shiftsPayoutSummary) {
    elements.shiftsPayoutSummary.style.display = "none";
  }

  renderShiftList({
    listEl: elements.shiftList,
    wrapperEl: elements.shiftListWrapper,
    monthShifts: currentMonthShiftsCache,
    year,
    month,
    filter: activeFilter,
    settings,
    onShiftClick: openShiftModal,
  });
}

function openShiftsModal(filter = "all", targetYear = null, targetMonth = null) {
  if (Number.isInteger(targetYear) && Number.isInteger(targetMonth)) {
    if (currentDate.getFullYear() !== targetYear || currentDate.getMonth() !== targetMonth) {
      currentDate = new Date(targetYear, targetMonth, 1);
      render();
    }
  }
  setSegmentedValue("shiftsFilterSegmented", "shiftsFilter", filter);
  refreshShiftsModalContent(filter);
  openModal("shiftsModal");
}

// ============================================================
// Рендер и UI-виджеты
// ============================================================
function render() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = new Date();
  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  elements.monthTitle.textContent = `${MONTH_NAMES[month]} ${year}`;
  elements.monthTitle.classList.toggle("month-selector__title--current", isCurrentMonth);
  elements.monthTitle.title = isCurrentMonth ? "Текущий месяц" : "Перейти к текущему месяцу";

  // Один проход сводки по месяцу и выплатам
  const cutoffDay = settings.advanceCutoffDay || 15;
  const summary = calcMonthSummary(shifts, year, month, cutoffDay);
  currentMonthShiftsCache = summary.monthShifts;

  renderPayoutSchedule(year, month);

  // Отрисовка календаря
  renderCalendarGrid(elements.calendarGrid, {
    year,
    month,
    shifts,
    settings,
    onDayClick: openShiftModal,
    onDayLongPress: quickAddDefaultShift,
    onDayStamp: isStampMode ? handleStampDay : null,
  });

  // Основная статистика
  elements.statShifts.textContent = summary.totalShifts;
  elements.statHours.textContent = summary.totalHours;
  elements.statIncome.textContent = `${summary.totalIncome.toLocaleString("ru-RU")} ${settings.currency}`;
  elements.statIncome.title = elements.statIncome.textContent;

  // Бейдж средней оплаты в шапке модалки детализации
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

  // Ленивое обновление списка смен только при открытом модальном окне
  if (elements.shiftsModal?.classList.contains("active")) {
    refreshShiftsModalContent();
  }
}

// ============================================================
// График выплат (Аванс 1–15 / ЗП 12-го за прошлый месяц)
// ============================================================
function updatePayoutStatusBadge(el, isPaid, shouldShow) {
  if (!el) return;
  if (!shouldShow) {
    el.style.display = "none";
    el.classList.remove("payout-strip__status--paid");
    return;
  }
  el.style.display = "";
  el.textContent = isPaid ? "Выплачено" : "Ожидается";
  el.classList.toggle("payout-strip__status--paid", isPaid);
}

function renderPayoutSchedule(year, month) {
  const isEnabled = (settings.payoutMode || "on") === "on";
  const curr = settings.currency || "₽";

  if (!isEnabled) {
    lastPayoutSchedule = null;
    if (elements.payoutStrip) elements.payoutStrip.style.display = "none";
    if (elements.shiftsPayoutSummary) elements.shiftsPayoutSummary.style.display = "none";
    return;
  }

  const payout = calcPayoutSchedule(shifts, year, month, {
    cutoffDay: settings.advanceCutoffDay ?? 15,
    advancePayDay: settings.advancePayDay ?? 27,
    salaryPayDay: settings.salaryPayDay ?? 12,
  });
  lastPayoutSchedule = payout;

  const curMonthGen = MONTH_NAMES_GENITIVE[month];
  const prevMonthGen = MONTH_NAMES_GENITIVE[payout.incomingPrevSalary.sourceMonth];
  const nextMonthGen = MONTH_NAMES_GENITIVE[payout.nextMonthSalary.payMonth];

  const prevSalKey = formatPayoutKey(
    payout.incomingPrevSalary.sourceYear,
    payout.incomingPrevSalary.sourceMonth,
    "salary",
  );
  const curAdvKey = formatPayoutKey(year, month, "advance");
  const isPrevSalPaid = Boolean(paidPayouts?.[prevSalKey]?.paid);
  const isCurAdvPaid = Boolean(paidPayouts?.[curAdvKey]?.paid);

  if (elements.payoutStrip) {
    elements.payoutStrip.style.display = "";
  }
  if (elements.payoutSalaryTitle) {
    elements.payoutSalaryTitle.textContent = `ЗП ${payout.incomingPrevSalary.payDay} ${curMonthGen}`;
  }
  if (elements.payoutSalaryPeriod) {
    elements.payoutSalaryPeriod.textContent = `за ${MONTH_NAMES[payout.incomingPrevSalary.sourceMonth].toLowerCase()}`;
  }
  if (elements.payoutSalaryValue) {
    elements.payoutSalaryValue.textContent = `${payout.incomingPrevSalary.amount.toLocaleString("ru-RU")} ${curr}`;
  }
  if (elements.payoutSalaryMeta) {
    if (!payout.incomingPrevSalary.hasRange) {
      elements.payoutSalaryMeta.textContent = `Нет дней (отсечка ${payout.cutoffDay} ${prevMonthGen})`;
    } else if (payout.incomingPrevSalary.shiftsCount > 0) {
      elements.payoutSalaryMeta.textContent = `${payout.incomingPrevSalary.fromDay}–${payout.incomingPrevSalary.toDay} ${prevMonthGen} • ${payout.incomingPrevSalary.shiftsCount} см (${payout.incomingPrevSalary.hours} ч)`;
    } else {
      elements.payoutSalaryMeta.textContent = `Нет смен за ${payout.incomingPrevSalary.fromDay}–${payout.incomingPrevSalary.toDay} ${prevMonthGen}`;
    }
  }
  updatePayoutStatusBadge(
    elements.payoutSalaryStatus,
    isPrevSalPaid,
    payout.incomingPrevSalary.shiftsCount > 0 || isPrevSalPaid,
  );

  if (elements.payoutAdvanceTitle) {
    elements.payoutAdvanceTitle.textContent = `Аванс ${payout.advance.payDay} ${curMonthGen}`;
  }
  if (elements.payoutAdvancePeriod) {
    elements.payoutAdvancePeriod.textContent = `${payout.advance.fromDay}–${payout.advance.toDay} ${curMonthGen}`;
  }
  if (elements.payoutAdvanceValue) {
    elements.payoutAdvanceValue.textContent = `${payout.advance.amount.toLocaleString("ru-RU")} ${curr}`;
  }
  if (elements.payoutAdvanceMeta) {
    elements.payoutAdvanceMeta.textContent = `${payout.advance.shiftsCount} см • ${payout.nextMonthSalary.payDay} ${nextMonthGen}: ${payout.nextMonthSalary.amount.toLocaleString("ru-RU")} ${curr}`;
  }
  updatePayoutStatusBadge(
    elements.payoutAdvanceStatus,
    isCurAdvPaid,
    payout.advance.shiftsCount > 0 || isCurAdvPaid,
  );

  const advBtn = document.getElementById("filterAdvanceBtn");
  const salBtn = document.getElementById("filterSalaryBtn");
  if (advBtn) advBtn.textContent = `Аванс (1–${payout.cutoffDay})`;
  if (salBtn) salBtn.textContent = `ЗП ${payout.nextMonthSalary.payDay}-го`;
}

// ============================================================
// Быстрое добавление смены под календарем
// ============================================================
function setTimerPreset(type) {
  currentTimerPresetType = type;
  updateTimerPresetTabsUI();
}

function updateTimerPresetTabsUI() {
  const tabs = [
    { el: elements.timerTabDay, iconEl: elements.timerTabIconDay, nameEl: elements.timerTabNameDay, type: "day" },
    { el: elements.timerTabNight, iconEl: elements.timerTabIconNight, nameEl: elements.timerTabNameNight, type: "night" },
    { el: elements.timerTabExtra, iconEl: elements.timerTabIconExtra, nameEl: elements.timerTabNameExtra, type: "extra" },
  ];

  tabs.forEach(({ el, iconEl, nameEl, type }) => {
    const p = settings.presets?.[type] || DEFAULT_PRESETS[type];
    if (el) {
      const isActive = currentTimerPresetType === type;
      el.classList.toggle("is-active", isActive);
      el.setAttribute("aria-selected", String(isActive));
    }
    if (iconEl) {
      iconEl.innerHTML = getPresetIconHtml(p, type, "shift-timer__tab-svg");
    }
    if (nameEl) {
      const fallback = type === "day" ? "День" : type === "night" ? "Ночь" : "Подработка";
      nameEl.textContent = p?.name || fallback;
    }
  });
}

function handleQuickAddShift() {
  const today = new Date();
  const isCurrentMonth =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();
  const targetKey = isCurrentMonth
    ? formatDateKey(today)
    : formatDateKey(currentDate.getFullYear(), currentDate.getMonth(), 1);

  if (shifts[targetKey]) {
    openShiftModal(targetKey, null, "На эту дату уже есть смена — открыта текущая запись");
    return;
  }
  openShiftModal(targetKey, currentTimerPresetType);
}

// ============================================================
// Сверка с расчетным листком (Payslip Audit)
// ============================================================
function togglePayslipAudit() {
  payslipAuditOpen = !payslipAuditOpen;
  if (elements.payslipAuditSection) {
    elements.payslipAuditSection.classList.toggle("is-open", payslipAuditOpen);
  }
  if (elements.payslipAuditBody) {
    elements.payslipAuditBody.style.display = payslipAuditOpen ? "block" : "none";
  }
  if (elements.payslipToggleArrow) {
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
  const summary = calcMonthSummary(shifts, year, month, settings.advanceCutoffDay || 15);
  const expectedIncome = summary.totalIncome;

  const result = verifyPayslip(actualVal, expectedIncome);
  const curr = escapeHtml(settings.currency || "₽");

  elements.payslipAuditResult.style.display = "block";
  elements.payslipAuditResult.className = `payslip-audit__result payslip-audit__result--${result.status}`;

  if (result.status === "match") {
    elements.payslipAuditResult.innerHTML = `
      <div class="payslip-audit__badge payslip-audit__badge--match">✓ Сходится точь-в-точь</div>
      <div class="payslip-audit__text">Расчёты приложения и расчётного листка полностью совпадают: <strong>${actualVal.toLocaleString("ru-RU")} ${curr}</strong>.</div>
    `;
  } else if (result.status === "underpaid") {
    elements.payslipAuditResult.innerHTML = `
      <div class="payslip-audit__badge payslip-audit__badge--underpaid">⚠ Недоплата: ${result.diff.toLocaleString("ru-RU")} ${curr}</div>
      <div class="payslip-audit__text">По вашему графику начислено <strong>${expectedIncome.toLocaleString("ru-RU")} ${curr}</strong>, а в листке указано <strong>${actualVal.toLocaleString("ru-RU")} ${curr}</strong>. Проверьте количество учтённых часов или удержания.</div>
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
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;

  if (elements.installAppDivider) elements.installAppDivider.style.display = "block";
  if (elements.installAppTitle) elements.installAppTitle.style.display = "block";
  if (elements.installAppContainer) elements.installAppContainer.style.display = "flex";
});

window.addEventListener("appinstalled", () => {
  deferredPrompt = null;

  if (elements.installAppDivider) elements.installAppDivider.style.display = "none";
  if (elements.installAppTitle) elements.installAppTitle.style.display = "none";
  if (elements.installAppContainer) elements.installAppContainer.style.display = "none";
});

function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        reg.update();

        if (reg.waiting && navigator.serviceWorker.controller && elements.updateBanner) {
          elements.updateBanner.style.display = "block";
        }

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
            navigator.serviceWorker.addEventListener(
              "controllerchange",
              () => window.location.reload(),
              { once: true },
            );
            reg.waiting.postMessage({ action: "skipWaiting" });
          } else {
            window.location.reload();
          }
        });
      });
    }
  });
}

// ============================================================
// Привязка событий
// ============================================================
function bindEvents() {
  // Глобальный тактильный отклик на нажатие интерактивных элементов
  document.addEventListener(
    "pointerdown",
    (e) => {
      const target = e.target.closest("button, .btn, [role='button'], [role='tab']");
      if (target && !target.disabled) {
        triggerHaptic(8);
      }
    },
    { passive: true },
  );

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

  // Тема и настройки
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.settingsBtn.addEventListener("click", openSettings);

  // Экспорт
  elements.exportMonthBtn.addEventListener("click", () => handleExportCSV(false));
  elements.exportAllBtn.addEventListener("click", () => handleExportCSV(true));
  if (elements.exportIcsBtn) {
    elements.exportIcsBtn.addEventListener("click", handleExportICS);
  }

  // Детализация смен
  if (elements.openShiftsBtn) {
    elements.openShiftsBtn.addEventListener("click", () => openShiftsModal("all"));
  }
  if (elements.shiftsModalCloseBtn) {
    elements.shiftsModalCloseBtn.addEventListener("click", () => closeModal("shiftsModal"));
  }

  // Синхронизация между вкладками
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) {
      shifts = loadShifts();
      render();
      if (elements.shiftModal?.classList.contains("active")) {
        const activeKey = elements.shiftDate?.value;
        if (activeKey) {
          if (!hasUnsavedShiftEdits) {
            syncShiftModalForDate(activeKey, null);
          } else {
            showShiftDateWarning("Данные этой смены изменены в другой вкладке");
          }
        }
      }
    } else if (e.key === SETTINGS_KEY) {
      settings = loadSettings();
      updatePayModeLabels();
      updatePresetTimesUI();
      render();
    } else if (e.key === THEME_KEY) {
      currentTheme = loadTheme();
      applyTheme(currentTheme);
    } else if (e.key === PAID_PAYOUTS_KEY) {
      paidPayouts = loadPaidPayouts();
      render();
    }
  });

  if (elements.shiftList) {
    elements.shiftList.addEventListener(
      "scroll",
      () => {
        updateShiftListScrollGradients(elements.shiftList, elements.shiftListWrapper);
      },
      { passive: true },
    );
  }
  window.addEventListener(
    "resize",
    () => {
      updateShiftListScrollGradients(elements.shiftList, elements.shiftListWrapper);
    },
    { passive: true },
  );

  // Форма смены
  elements.shiftForm.addEventListener("submit", saveShift);
  elements.shiftModalCloseBtn.addEventListener("click", () => closeModal("shiftModal"));
  elements.deleteBtn.addEventListener("click", deleteShift);

  // Пересчёт и смена даты в модалке смены
  elements.shiftDate.addEventListener("change", () => {
    const newKey = elements.shiftDate.value;
    if (!newKey) return;
    const existing = shifts[newKey];
    if (existing) {
      hasUnsavedShiftEdits = false;
      syncShiftModalForDate(newKey, null);
      showShiftDateWarning("На эту дату уже есть смена — загружены сохранённые данные");
    } else if (hasUnsavedShiftEdits) {
      const [y, m, d] = newKey.split("-");
      elements.shiftModalTitle.textContent = `Смена ${d}.${m}.${y}`;
      elements.deleteBtn.style.display = "none";
      hideShiftDateWarning();
    } else {
      syncShiftModalForDate(newKey, null);
      hideShiftDateWarning();
    }
  });

  const markEditedAndRecalc = () => {
    hasUnsavedShiftEdits = true;
    recalcModal();
  };
  elements.startTime.addEventListener("input", markEditedAndRecalc);
  elements.startTime.addEventListener("change", markEditedAndRecalc);
  elements.endTime.addEventListener("input", markEditedAndRecalc);
  elements.endTime.addEventListener("change", markEditedAndRecalc);
  elements.payMode.addEventListener("change", markEditedAndRecalc);
  elements.rate.addEventListener("input", markEditedAndRecalc);
  elements.note.addEventListener("input", () => {
    hasUnsavedShiftEdits = true;
  });

  // Форма настроек
  elements.settingsForm.addEventListener("submit", saveSettingsFromModal);
  elements.settingsModalCloseBtn.addEventListener("click", () => closeModal("settingsModal"));
  [elements.defCutoffDay, elements.defAdvancePayDay, elements.defSalaryPayDay]
    .filter(Boolean)
    .forEach((inp) => {
      inp.addEventListener("input", updatePayoutRuleHint);
    });
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

  // Быстрое добавление смены и режим штампа
  if (elements.quickAddShiftBtn) {
    elements.quickAddShiftBtn.addEventListener("click", handleQuickAddShift);
  }
  if (elements.stampModeToggleBtn) {
    elements.stampModeToggleBtn.addEventListener("click", () => {
      setStampMode(!isStampMode);
      triggerHaptic(12);
      render();
      if (isStampMode) {
        showToast("Режим штампа: нажимайте на дни календаря", "info", null, 2500);
      }
    });
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

  // Карточки графика выплат (click + keyboard Enter/Space)
  if (elements.payoutAdvanceCard) {
    const openAdvance = () => openShiftsModal("advance");
    elements.payoutAdvanceCard.addEventListener("click", openAdvance);
    elements.payoutAdvanceCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openAdvance();
      }
    });
  }
  if (elements.payoutSalaryCard) {
    const openPrevSalary = () => {
      if (!lastPayoutSchedule?.incomingPrevSalary) return;
      const { sourceYear, sourceMonth } = lastPayoutSchedule.incomingPrevSalary;
      openShiftsModal("salary", sourceYear, sourceMonth);
    };
    elements.payoutSalaryCard.addEventListener("click", openPrevSalary);
    elements.payoutSalaryCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openPrevSalary();
      }
    });
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
    elements.installPwaBtn.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
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
    elements.restoreModal,
  ]
    .filter(Boolean)
    .forEach((overlay) => {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal(overlay.id);
      });
    });

  // Выход из режима штампа по Escape, если нет открытых модалок
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isStampMode && !document.querySelector(".modal-overlay.active")) {
      setStampMode(false);
      render();
    }
  });
}

// ============================================================
// Инициализация приложения
// ============================================================
applyTheme(currentTheme);
initTemplateStylePickers();
initSegmentedControls();
initArrowKeyNavigation();
updateTimerPresetTabsUI();
requestPersistentStorage();
bindEvents();
initCalendarSwipe(document.querySelector(".calendar"), elements.calendarGrid, {
  onSwipeLeft: () => changeMonth(1),
  onSwipeRight: () => changeMonth(-1),
});
initBottomSheetSwipe();
registerSW();
render();
