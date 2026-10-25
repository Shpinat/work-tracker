/**
 * app.js
 * Точка входа приложения Work Tracker (v2.0).
 * Координация состояния, модулей Domain, Data и UI, и привязка событий.
 */

// ============================================================
// Импорты модулей
// ============================================================
import {
  STORAGE_KEY,
  SETTINGS_KEY,
  THEME_KEY,
  DEFAULT_PRESETS,
  DEFAULT_SETTINGS,
  loadShifts,
  saveShifts,
  loadSettings,
  saveSettings,
  loadTheme,
  saveTheme,
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
  calcGoalProgress,
} from "./domain/payroll.js";

import {
  calculateAllTimeAnalytics,
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
  STREAK_ICONS,
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
let currentShiftsFilter = "all"; // "all" | "advance" | "salary"
let currentMonthShiftsCache = [];
let currentSettingsPreset = "day";
let tempPresets = {};
let customCycle = ["day", "night", "off", "off"];
let lastScheduleSnapshot = null;
let lastMonthComparisonSummary = null;
let bestMonthNavTarget = null;
let bestShiftNavTarget = null;

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
  statsOverviewBtn: document.getElementById("statsOverviewBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeIcon: document.getElementById("themeIcon"),
  settingsBtn: document.getElementById("settingsBtn"),
  metaThemeColor: document.querySelector('meta[name="theme-color"]'),

  // Статистика
  statShifts: document.getElementById("statShifts"),
  statHours: document.getElementById("statHours"),
  statIncome: document.getElementById("statIncome"),
  statShiftsCard: document.getElementById("statShiftsCard"),
  statHoursCard: document.getElementById("statHoursCard"),
  statIncomeCard: document.getElementById("statIncomeCard"),
  statShiftsBadge: document.getElementById("statShiftsBadge"),

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
  recalcMonthRatesBtn: document.getElementById("recalcMonthRatesBtn"),
  defCurrency: document.getElementById("defCurrency"),
  defCutoffDay: document.getElementById("defCutoffDay"),
  defPayoutModeSegmented: document.getElementById("defPayoutModeSegmented"),
  defPayoutMode: document.getElementById("defPayoutMode"),
  defMonthlyGoal: document.getElementById("defMonthlyGoal"),
  defGoalModeSegmented: document.getElementById("defGoalModeSegmented"),
  defGoalMode: document.getElementById("defGoalMode"),

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
  previewScheduleText: document.getElementById("schedulePreviewText"),
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

  // Модальное окно аналитики и рекордов
  analyticsModal: document.getElementById("analyticsModal"),
  analyticsModalCloseBtn: document.getElementById("analyticsModalCloseBtn"),
  allTimeIncome: document.getElementById("allTimeIncome"),
  allTimeAvgMonth: document.getElementById("allTimeAvgMonth"),
  allTimeShifts: document.getElementById("allTimeShifts"),
  allTimeHours: document.getElementById("allTimeHours"),
  analyticsStreakCard: document.getElementById("analyticsStreakCard"),
  analyticsStreakIcon: document.getElementById("analyticsStreakIcon"),
  analyticsStreakTitle: document.getElementById("analyticsStreakTitle"),
  analyticsStreakDesc: document.getElementById("analyticsStreakDesc"),
  bestMonthCard: document.getElementById("bestMonthCard"),
  bestMonthValue: document.getElementById("bestMonthValue"),
  bestMonthDate: document.getElementById("bestMonthDate"),
  bestShiftCard: document.getElementById("bestShiftCard"),
  bestShiftValue: document.getElementById("bestShiftValue"),
  bestShiftDate: document.getElementById("bestShiftDate"),
  longestShiftValue: document.getElementById("longestShiftValue"),
  longestShiftDate: document.getElementById("longestShiftDate"),
  maxStreakValue: document.getElementById("maxStreakValue"),
  maxStreakSub: document.getElementById("maxStreakSub"),
  breakdownDayText: document.getElementById("breakdownDayText"),
  breakdownDayFill: document.getElementById("breakdownDayFill"),
  breakdownNightText: document.getElementById("breakdownNightText"),
  breakdownNightFill: document.getElementById("breakdownNightFill"),
  breakdownExtraText: document.getElementById("breakdownExtraText"),
  breakdownExtraFill: document.getElementById("breakdownExtraFill"),
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
        renderShiftList({
          listEl: elements.shiftList,
          wrapperEl: elements.shiftListWrapper,
          monthShifts: currentMonthShiftsCache,
          year: currentDate.getFullYear(),
          month: currentDate.getMonth(),
          filter: currentShiftsFilter,
          settings,
          onShiftClick: openShiftModal,
        });
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
      containerId: "defPayoutModeSegmented",
      inputId: "defPayoutMode",
      onChange: () => triggerHaptic(10),
    },
    {
      containerId: "defGoalModeSegmented",
      inputId: "defGoalMode",
      onChange: () => triggerHaptic(10),
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
  saveShifts(shifts);
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
  saveShifts(shifts);
  closeModal("shiftModal");
  render();
  triggerHaptic(20);
  showToast("Смена удалена", "info");
}

function quickAddDefaultShift(dateKey) {
  if (shifts[dateKey]) return;

  shifts[dateKey] = buildShiftFromPreset("day", settings);
  saveShifts(shifts);
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
  showToast(`Смена добавлена: ${parseInt(d, 10)} ${monthName} (${preset.start}–${preset.end})`, "success");
}

// ============================================================
// Настройки
// ============================================================
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
  setSegmentedValue("defPayoutModeSegmented", "defPayoutMode", settings.payoutSplitEnabled ? "on" : "off");
  if (elements.defMonthlyGoal) {
    elements.defMonthlyGoal.value = settings.monthlyGoal ? settings.monthlyGoal : "";
  }
  setSegmentedValue("defGoalModeSegmented", "defGoalMode", settings.monthlyGoalEnabled ? "on" : "off");
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
  settings.advanceCutoffDay = Math.min(28, Math.max(1, parseInt(elements.defCutoffDay.value, 10) || 15));
  settings.payoutSplitEnabled = elements.defPayoutMode ? elements.defPayoutMode.value === "on" : false;
  settings.monthlyGoal = elements.defMonthlyGoal ? Math.max(0, parseFloat(elements.defMonthlyGoal.value) || 0) : (settings.monthlyGoal || 0);
  settings.monthlyGoalEnabled = elements.defGoalMode ? elements.defGoalMode.value === "on" : false;

  saveSettings(settings);
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

  const updatedCount = recalcMonthShifts(shifts, year, month, newRate, newPayMode);
  settings.rate = newRate;
  settings.payMode = newPayMode;
  saveSettings(settings);
  saveShifts(shifts);

  render();
  triggerHaptic(20);
  showToast(`Пересчитано смен: ${updatedCount}`, "success");
}

// ============================================================
// Рекорды и общая аналитика
// ============================================================
function openAnalyticsModal() {
  updateAnalyticsData();
  openModal("analyticsModal");
  triggerHaptic(12);
}

function updateAnalyticsData() {
  const curr = settings.currency || "₽";
  const data = calculateAllTimeAnalytics(shifts);

  if (data.isEmpty) {
    if (elements.allTimeIncome) elements.allTimeIncome.textContent = `0 ${curr}`;
    if (elements.allTimeAvgMonth) elements.allTimeAvgMonth.textContent = `~0 ${curr} / месяц`;
    if (elements.allTimeShifts) elements.allTimeShifts.textContent = "0 см";
    if (elements.allTimeHours) elements.allTimeHours.textContent = "0 ч всего";

    if (elements.analyticsStreakTitle) elements.analyticsStreakTitle.textContent = "Текущий статус";
    if (elements.analyticsStreakDesc) elements.analyticsStreakDesc.textContent = "Смен пока нет";
    if (elements.analyticsStreakIcon) elements.analyticsStreakIcon.innerHTML = STREAK_ICONS.empty;

    if (elements.bestMonthValue) elements.bestMonthValue.textContent = "—";
    if (elements.bestMonthDate) elements.bestMonthDate.textContent = "Нет смен";
    if (elements.bestShiftValue) elements.bestShiftValue.textContent = "—";
    if (elements.bestShiftDate) elements.bestShiftDate.textContent = "Нет смен";
    if (elements.longestShiftValue) elements.longestShiftValue.textContent = "—";
    if (elements.longestShiftDate) elements.longestShiftDate.textContent = "Нет смен";
    if (elements.maxStreakValue) elements.maxStreakValue.textContent = "0";

    if (elements.breakdownDayText) elements.breakdownDayText.textContent = "0 см (0%)";
    if (elements.breakdownDayFill) elements.breakdownDayFill.style.width = "0%";
    if (elements.breakdownNightText) elements.breakdownNightText.textContent = "0 см (0%)";
    if (elements.breakdownNightFill) elements.breakdownNightFill.style.width = "0%";
    if (elements.breakdownExtraText) elements.breakdownExtraText.textContent = "0 см (0%)";
    if (elements.breakdownExtraFill) elements.breakdownExtraFill.style.width = "0%";

    bestMonthNavTarget = null;
    bestShiftNavTarget = null;
    return;
  }

  if (elements.allTimeIncome) {
    elements.allTimeIncome.textContent = `${data.totalIncome.toLocaleString("ru-RU")} ${curr}`;
  }
  if (elements.allTimeAvgMonth) {
    elements.allTimeAvgMonth.textContent = `~${data.avgMonthlyIncome.toLocaleString("ru-RU")} ${curr} / месяц`;
  }
  if (elements.allTimeShifts) {
    elements.allTimeShifts.textContent = `${data.totalShifts} см`;
  }
  if (elements.allTimeHours) {
    elements.allTimeHours.textContent = `${data.totalHours} ч всего`;
  }

  // Рекордный месяц
  if (data.bestMonth) {
    bestMonthNavTarget = { year: data.bestMonth.year, month: data.bestMonth.month };
    if (elements.bestMonthValue) {
      elements.bestMonthValue.textContent = `${data.bestMonth.income.toLocaleString("ru-RU")} ${curr}`;
    }
    if (elements.bestMonthDate) {
      elements.bestMonthDate.textContent = `${MONTH_NAMES[data.bestMonth.month]} ${data.bestMonth.year} ↗`;
    }
  }

  // Лучшая смена
  if (data.bestShift) {
    bestShiftNavTarget = data.bestShift.key;
    if (elements.bestShiftValue) {
      elements.bestShiftValue.textContent = `${data.bestShift.pay.toLocaleString("ru-RU")} ${curr}`;
    }
    if (elements.bestShiftDate) {
      elements.bestShiftDate.textContent = `${data.bestShift.day} ${MONTH_NAMES_GENITIVE[data.bestShift.month]} ${data.bestShift.year} ↗`;
    }
  }

  // Длинная смена
  if (data.longestShift) {
    if (elements.longestShiftValue) {
      elements.longestShiftValue.textContent = `${data.longestShift.hours} ч`;
    }
    if (elements.longestShiftDate) {
      elements.longestShiftDate.textContent = `${data.longestShift.day} ${MONTH_NAMES_GENITIVE[data.longestShift.month]} ${data.longestShift.year}`;
    }
  }

  // Максимальный стрик
  if (elements.maxStreakValue) {
    elements.maxStreakValue.textContent = data.maxStreak;
  }
  if (elements.maxStreakSub) {
    elements.maxStreakSub.textContent = getRussianDeclension(data.maxStreak, ["смена подряд", "смены подряд", "смен подряд"]);
  }

  // Текущий стрик / отдых
  if (data.currentStreak.status === "today") {
    if (elements.analyticsStreakCard) elements.analyticsStreakCard.classList.remove("analytics-streak--rest");
    if (elements.analyticsStreakIcon) elements.analyticsStreakIcon.innerHTML = STREAK_ICONS.fire;
    if (elements.analyticsStreakTitle) elements.analyticsStreakTitle.textContent = "Текущий стрик смен";
    if (elements.analyticsStreakDesc) {
      elements.analyticsStreakDesc.textContent = `${data.currentStreak.days} ${getRussianDeclension(data.currentStreak.days, ["смена подряд", "смены подряд", "смен подряд"])} (включая сегодня)`;
    }
  } else if (data.currentStreak.status === "yesterday") {
    if (elements.analyticsStreakCard) elements.analyticsStreakCard.classList.remove("analytics-streak--rest");
    if (elements.analyticsStreakIcon) elements.analyticsStreakIcon.innerHTML = STREAK_ICONS.flash;
    if (elements.analyticsStreakTitle) elements.analyticsStreakTitle.textContent = "Последний стрик";
    if (elements.analyticsStreakDesc) {
      elements.analyticsStreakDesc.textContent = `${data.currentStreak.days} ${getRussianDeclension(data.currentStreak.days, ["смена подряд", "смены подряд", "смен подряд"])} (вчера была смена)`;
    }
  } else {
    if (elements.analyticsStreakCard) elements.analyticsStreakCard.classList.add("analytics-streak--rest");
    if (elements.analyticsStreakIcon) elements.analyticsStreakIcon.innerHTML = STREAK_ICONS.coffee;
    if (elements.analyticsStreakTitle) elements.analyticsStreakTitle.textContent = "Текущий статус";
    if (elements.analyticsStreakDesc) {
      elements.analyticsStreakDesc.textContent = `Отдых: ${data.currentStreak.days} ${getRussianDeclension(data.currentStreak.days, ["день", "дня", "дней"])} без смен`;
    }
  }

  // Структура работы (Breakdown)
  if (elements.breakdownDayText) elements.breakdownDayText.textContent = `${data.dayShiftsCount} см (${data.dayPct}%)`;
  if (elements.breakdownDayFill) elements.breakdownDayFill.style.width = `${data.dayPct}%`;

  if (elements.breakdownNightText) elements.breakdownNightText.textContent = `${data.nightShiftsCount} см (${data.nightPct}%)`;
  if (elements.breakdownNightFill) elements.breakdownNightFill.style.width = `${data.nightPct}%`;

  if (elements.breakdownExtraText) elements.breakdownExtraText.textContent = `${data.extraShiftsCount} см (${data.extraPct}%)`;
  if (elements.breakdownExtraFill) elements.breakdownExtraFill.style.width = `${data.extraPct}%`;
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
      title = "День";
    } else if (type === "night") {
      iconSvg = '<svg class="tag-svg-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"></path></svg>';
      title = "Ночь";
    }

    chip.innerHTML = `${iconSvg} <span>${title}</span> <span style="font-size: 0.7rem; opacity: 0.6; margin-left: 2px;">✕</span>`;
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

  previewEl.innerHTML = `Будет добавлено <strong>${planned.length} смен</strong> (${breakdown.join(", ")}) на <strong>${durationStr}</strong>.<br>Прогнозируемый доход: ~<strong>${estTotal.toLocaleString("ru-RU")} ${settings.currency}</strong>.`;
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

  planned.forEach((s) => {
    shifts[s.dateKey] = buildShiftFromPreset(s.type, settings);
  });

  saveShifts(shifts);
  closeModal("scheduleModal");
  render();
  triggerHaptic([30, 40, 50]);

  showToast(`График заполнен (+${planned.length} смен)!`, "success", {
    label: "Отменить",
    onClick: () => {
      if (lastScheduleSnapshot) {
        shifts = lastScheduleSnapshot;
        saveShifts(shifts);
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
function handleBackupDownload() {
  downloadBackup(shifts, settings);
}

async function handleBackupRestore(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    const restored = await parseBackupFile(file);
    shifts = restored.shifts;
    settings = restored.settings;
    saveShifts(shifts);
    saveSettings(settings);
    closeModal("settingsModal");
    render();
    showToast("Данные успешно восстановлены!", "success");
  } catch (err) {
    showToast("Ошибка чтения файла бэкапа", "error");
  }

  event.target.value = "";
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

function updateGoalTrackerUI(totalIncome, totalShifts) {
  if (!elements.goalTracker) return;

  const goal = settings.monthlyGoal || 0;
  const curr = settings.currency || "₽";

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

  const p = calcGoalProgress(totalIncome, goal, avgShiftPay);

  if (p.isZeroGoal) {
    elements.goalTracker.classList.remove("goal-tracker--completed");
    if (elements.goalProgressText) elements.goalProgressText.textContent = `0 ${curr}`;
    if (elements.goalPercentage) elements.goalPercentage.textContent = "0%";
    if (elements.goalProgressBar) {
      elements.goalProgressBar.style.width = "0%";
      elements.goalProgressBar.classList.remove("goal-tracker__bar--completed");
    }
    if (elements.goalStatusText) elements.goalStatusText.textContent = "Поставьте цель заработка на месяц";
    if (elements.goalActionHint) elements.goalActionHint.textContent = "Настроить";
    return;
  }

  if (elements.goalProgressText) {
    elements.goalProgressText.textContent = `${totalIncome.toLocaleString("ru-RU")} / ${goal.toLocaleString("ru-RU")} ${curr}`;
  }
  if (elements.goalPercentage) {
    elements.goalPercentage.textContent = `${p.percent}%`;
  }
  if (elements.goalProgressBar) {
    elements.goalProgressBar.style.width = `${p.clampedWidth}%`;
  }

  if (p.isCompleted) {
    elements.goalTracker.classList.add("goal-tracker--completed");
    if (elements.goalProgressBar) {
      elements.goalProgressBar.classList.add("goal-tracker__bar--completed");
    }
    if (elements.goalStatusText) {
      if (p.surplus > 0) {
        elements.goalStatusText.textContent = `Цель выполнена! Перевыполнение: +${p.surplus.toLocaleString("ru-RU")} ${curr}`;
      } else {
        elements.goalStatusText.textContent = "Цель достигнута на 100%! Отличная работа!";
      }
    }
    if (elements.goalActionHint) elements.goalActionHint.textContent = "Изменить";
  } else {
    elements.goalTracker.classList.remove("goal-tracker--completed");
    if (elements.goalProgressBar) {
      elements.goalProgressBar.classList.remove("goal-tracker__bar--completed");
    }
    if (elements.goalStatusText) {
      if (p.neededShifts) {
        const shiftWord = getRussianDeclension(p.neededShifts, ["смена", "смены", "смен"]);
        elements.goalStatusText.textContent = `Осталось: ${p.remaining.toLocaleString("ru-RU")} ${curr} (~${p.neededShifts} ${shiftWord})`;
      } else {
        elements.goalStatusText.textContent = `Осталось заработать: ${p.remaining.toLocaleString("ru-RU")} ${curr}`;
      }
    }
    if (elements.goalActionHint) elements.goalActionHint.textContent = "Изменить";
  }
}

function render() {
  if (window.scrollX !== 0) {
    window.scrollTo(0, window.scrollY);
  }
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const cutoffDay = settings.advanceCutoffDay || 15;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  elements.monthTitle.textContent = `${MONTH_NAMES[month]} ${year}`;

  // Подсчет сводки по сменам месяца
  const summary = calcMonthSummary(shifts, year, month, cutoffDay);

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

  // Динамика трендов MoM
  updateStatsTrends(year, month, summary.totalShifts, summary.totalHours, summary.totalIncome);

  // Блоки выплат: Аванс и Расчет
  if (elements.payoutSplit) {
    elements.payoutSplit.style.display = settings.payoutSplitEnabled ? "" : "none";
  }
  const curr = settings.currency || "₽";
  if (elements.advanceLabel) {
    elements.advanceLabel.textContent = `Аванс (1–${cutoffDay})`;
  }
  if (elements.salaryLabel) {
    elements.salaryLabel.textContent = `Расчёт (${cutoffDay + 1}–${daysInMonth})`;
  }
  if (elements.statAdvanceIncome) {
    elements.statAdvanceIncome.textContent = `${summary.advanceIncome.toLocaleString("ru-RU")} ${curr}`;
    elements.statAdvanceIncome.title = elements.statAdvanceIncome.textContent;
  }
  if (elements.statAdvanceMeta) {
    elements.statAdvanceMeta.textContent = `${summary.advanceShiftsCount} см • ${summary.advanceHours} ч`;
  }
  if (elements.statSalaryIncome) {
    elements.statSalaryIncome.textContent = `${summary.salaryIncome.toLocaleString("ru-RU")} ${curr}`;
    elements.statSalaryIncome.title = elements.statSalaryIncome.textContent;
  }
  if (elements.statSalaryMeta) {
    elements.statSalaryMeta.textContent = `${summary.salaryShiftsCount} см • ${summary.salaryHours} ч`;
  }
  if (elements.filterAdvanceBtn) {
    elements.filterAdvanceBtn.textContent = `Аванс (1–${cutoffDay})`;
  }
  if (elements.filterSalaryBtn) {
    elements.filterSalaryBtn.textContent = `Расчёт (${cutoffDay + 1}–${daysInMonth})`;
  }

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
  const today = new Date();
  const isCurrentMonth =
    currentDate.getFullYear() === today.getFullYear() &&
    currentDate.getMonth() === today.getMonth();
  if (elements.todayBtn) {
    elements.todayBtn.classList.toggle("header__today-btn--active", !isCurrentMonth);
    elements.todayBtn.title = isCurrentMonth
      ? "Текущий месяц"
      : `Вернуться к ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`;
  }

  // Финансовая цель ("Копилка")
  if (elements.goalTracker) {
    elements.goalTracker.style.display = settings.monthlyGoalEnabled ? "" : "none";
  }
  if (settings.monthlyGoalEnabled) {
    updateGoalTrackerUI(summary.totalIncome, summary.totalShifts);
  }

  currentMonthShiftsCache = summary.monthShifts;
  renderShiftList({
    listEl: elements.shiftList,
    wrapperEl: elements.shiftListWrapper,
    monthShifts: summary.monthShifts,
    year,
    month,
    filter: currentShiftsFilter,
    settings,
    onShiftClick: openShiftModal,
  });
}

// ============================================================
// Service Worker
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
// Привязка событий
// ============================================================
function bindEvents() {
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

  // Рекорды и общая аналитика
  if (elements.statsOverviewBtn) {
    elements.statsOverviewBtn.addEventListener("click", openAnalyticsModal);
  }
  if (elements.analyticsModalCloseBtn) {
    elements.analyticsModalCloseBtn.addEventListener("click", () => closeModal("analyticsModal"));
  }
  if (elements.bestMonthCard) {
    elements.bestMonthCard.addEventListener("click", () => {
      if (bestMonthNavTarget) {
        currentDate = new Date(bestMonthNavTarget.year, bestMonthNavTarget.month, 1);
        closeModal("analyticsModal");
        render();
        triggerHaptic(12);
        showToast(`Перешли к месяцу: ${MONTH_NAMES[bestMonthNavTarget.month]} ${bestMonthNavTarget.year}`, "info");
      }
    });
    elements.bestMonthCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.bestMonthCard.click();
      }
    });
  }
  if (elements.bestShiftCard) {
    elements.bestShiftCard.addEventListener("click", () => {
      if (bestShiftNavTarget) {
        const [y, m] = bestShiftNavTarget.split("-").map(Number);
        currentDate = new Date(y, m - 1, 1);
        closeModal("analyticsModal");
        render();
        setTimeout(() => {
          openShiftModal(bestShiftNavTarget);
        }, 120);
        triggerHaptic(12);
      }
    });
    elements.bestShiftCard.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        elements.bestShiftCard.click();
      }
    });
  }

  // Интерактивное сравнение с прошлым месяцем по тапу на карточки
  if (elements.statIncomeCard) {
    elements.statIncomeCard.addEventListener("click", () => {
      triggerHaptic(10);
      if (lastMonthComparisonSummary) {
        const s = lastMonthComparisonSummary;
        const sign = s.diffIncome >= 0 ? "+" : "";
        const arrow = s.diffIncome >= 0 ? "↗" : "↘";
        const curr = settings.currency || "₽";
        const msg = `${s.prevMonthName}: ${s.prevIncome.toLocaleString("ru-RU")} ${curr} (${s.prevShiftsCount} см)\n${s.curMonthName}: ${s.currentIncome.toLocaleString("ru-RU")} ${curr} (${s.currentShifts} см)\n${arrow} Разница дохода: ${sign}${s.diffIncome.toLocaleString("ru-RU")} ${curr} (${sign}${s.pctIncome}%)`;
        showToast(msg, s.diffIncome >= 0 ? "success" : "info", null, 5000);
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
      triggerHaptic(10);
      if (lastMonthComparisonSummary) {
        const s = lastMonthComparisonSummary;
        const sign = s.diffShifts >= 0 ? "+" : "";
        const arrow = s.diffShifts >= 0 ? "↗" : "↘";
        const msg = `${s.prevMonthName}: ${s.prevShiftsCount} см\n${s.curMonthName}: ${s.currentShifts} см\n${arrow} Разница смен: ${sign}${s.diffShifts} см`;
        showToast(msg, s.diffShifts >= 0 ? "success" : "info", null, 4000);
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
      triggerHaptic(10);
      if (lastMonthComparisonSummary) {
        const s = lastMonthComparisonSummary;
        const sign = s.diffHours >= 0 ? "+" : "";
        const arrow = s.diffHours >= 0 ? "↗" : "↘";
        const msg = `${s.prevMonthName}: ${s.prevHours} ч\n${s.curMonthName}: ${s.currentHours} ч\n${arrow} Разница часов: ${sign}${s.diffHours} ч`;
        showToast(msg, s.diffHours >= 0 ? "success" : "info", null, 4000);
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

  // Цель на месяц
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

  // Детализация смен и выплаты
  if (elements.payoutAdvanceCard) {
    elements.payoutAdvanceCard.addEventListener("click", () => {
      currentShiftsFilter = "advance";
      setSegmentedValue("shiftsFilterSegmented", "shiftsFilterInput", "advance");
      renderShiftList({
        listEl: elements.shiftList,
        wrapperEl: elements.shiftListWrapper,
        monthShifts: currentMonthShiftsCache,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
        filter: currentShiftsFilter,
        settings,
        onShiftClick: openShiftModal,
      });
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
      renderShiftList({
        listEl: elements.shiftList,
        wrapperEl: elements.shiftListWrapper,
        monthShifts: currentMonthShiftsCache,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
        filter: currentShiftsFilter,
        settings,
        onShiftClick: openShiftModal,
      });
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
      renderShiftList({
        listEl: elements.shiftList,
        wrapperEl: elements.shiftListWrapper,
        monthShifts: currentMonthShiftsCache,
        year: currentDate.getFullYear(),
        month: currentDate.getMonth(),
        filter: currentShiftsFilter,
        settings,
        onShiftClick: openShiftModal,
      });
      openModal("shiftsModal");
    });
  }
  if (elements.shiftsModalCloseBtn) {
    elements.shiftsModalCloseBtn.addEventListener("click", () => closeModal("shiftsModal"));
  }
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

  // Бэкап
  elements.backupDownloadBtn.addEventListener("click", handleBackupDownload);
  elements.backupRestoreBtn.addEventListener("click", () => elements.importFile.click());
  elements.importFile.addEventListener("change", handleBackupRestore);

  // Закрытие модалок по клику на фон оверлея
  [
    elements.shiftModal,
    elements.settingsModal,
    elements.shiftsModal,
    elements.scheduleModal,
    elements.analyticsModal,
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
      closeModal("analyticsModal");
    }
  });
}

// ============================================================
// Инициализация приложения
// ============================================================
applyTheme(currentTheme);
initSegmentedControls();
bindEvents();
initCalendarSwipe(document.querySelector(".calendar"), elements.calendarGrid, {
  onSwipeLeft: () => changeMonth(1),
  onSwipeRight: () => changeMonth(-1),
});
initBottomSheetSwipe();
registerSW();
render();
