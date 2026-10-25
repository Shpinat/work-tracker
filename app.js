// ============================================================
// Константы
// ============================================================
const STORAGE_KEY = "my_work_shifts_v1";
const SETTINGS_KEY = "my_work_settings_v1";
const THEME_KEY = "my_work_theme_v1";

const DEFAULT_SETTINGS = {
  start: "09:00",
  end: "21:00",
  breakMins: 60,
  payMode: "hourly",
  rate: 300,
  currency: "₽",
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

// ============================================================
// Состояние
// ============================================================
let currentDate = new Date();
let shifts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
let settings = JSON.parse(
  localStorage.getItem(SETTINGS_KEY) || JSON.stringify(DEFAULT_SETTINGS),
);
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
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeIcon: document.getElementById("themeIcon"),
  settingsBtn: document.getElementById("settingsBtn"),
  metaThemeColor: document.querySelector('meta[name="theme-color"]'),

  // Статистика
  statShifts: document.getElementById("statShifts"),
  statHours: document.getElementById("statHours"),
  statIncome: document.getElementById("statIncome"),

  // Календарь и триггер смен
  calendarGrid: document.getElementById("calendarGrid"),
  openShiftsBtn: document.getElementById("openShiftsBtn"),
  statShiftsBadge: document.getElementById("statShiftsBadge"),

  // Модальное окно деталей смен (Шторка)
  shiftsModal: document.getElementById("shiftsModal"),
  shiftsModalTitle: document.getElementById("shiftsModalTitle"),
  shiftsModalMonth: document.getElementById("shiftsModalMonth"),
  shiftsModalCloseBtn: document.getElementById("shiftsModalCloseBtn"),
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
  defStart: document.getElementById("defStart"),
  defEnd: document.getElementById("defEnd"),
  defBreak: document.getElementById("defBreak"),
  defPayMode: document.getElementById("defPayMode"),
  defPayModeSegmented: document.getElementById("defPayModeSegmented"),
  defRate: document.getElementById("defRate"),
  defCurrency: document.getElementById("defCurrency"),

  // Бэкап
  backupDownloadBtn: document.getElementById("backupDownloadBtn"),
  backupRestoreBtn: document.getElementById("backupRestoreBtn"),
  importFile: document.getElementById("importFile"),

  // PWA тост
  updateToast: document.getElementById("updateToast"),
  updateReloadBtn: document.getElementById("updateReloadBtn"),
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

/** Скачать blob-файл и освободить ObjectURL */
function triggerDownload(blob, filename) {
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// Сегментированные переключатели (Pill Switchers)
// ============================================================
function updateSegmentedUI(container, value) {
  if (!container) return;
  container.querySelectorAll(".segmented-control__btn").forEach((btn) => {
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
      onChange: null,
    },
    {
      containerId: "payModeSegmented",
      inputId: "payMode",
      onChange: () => recalcModal(),
    },
    {
      containerId: "defPayModeSegmented",
      inputId: "defPayMode",
      onChange: null,
    },
  ];

  configs.forEach(({ containerId, inputId, onChange }) => {
    const container = document.getElementById(containerId);
    const input = document.getElementById(inputId);
    if (!container || !input) return;

    container.querySelectorAll(".segmented-control__btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const val = btn.dataset.value;
        input.value = val;
        updateSegmentedUI(container, val);
        if (onChange) onChange(val);
      });
    });
  });

  updatePayModeLabels();
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

function openShiftModal(dateKey) {
  closeModal("shiftsModal");
  updatePayModeLabels();
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
    elements.startTime.value = settings.start;
    elements.endTime.value = settings.end;
    elements.breakMins.value = settings.breakMins;
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
}

function deleteShift() {
  if (!confirm("Удалить эту смену?")) return;
  const dateKey = elements.shiftDate.value;
  delete shifts[dateKey];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  closeModal("shiftModal");
  render();
}

// ============================================================
// Настройки
// ============================================================
function openSettings() {
  updatePayModeLabels();
  elements.defStart.value = settings.start;
  elements.defEnd.value = settings.end;
  elements.defBreak.value = settings.breakMins;
  setSegmentedValue("defPayModeSegmented", "defPayMode", settings.payMode || "hourly");
  elements.defRate.value = settings.rate;
  elements.defCurrency.value = settings.currency || "₽";
  openModal("settingsModal");
}

function saveSettings(e) {
  e.preventDefault();
  settings = {
    start: elements.defStart.value || "09:00",
    end: elements.defEnd.value || "21:00",
    breakMins: Number(elements.defBreak.value) || 0,
    payMode: elements.defPayMode.value,
    rate: parseFloat(elements.defRate.value) || 0,
    currency: elements.defCurrency.value.trim() || "₽",
  };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  updatePayModeLabels();
  closeModal("settingsModal");
  render();
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

  let totalShifts = 0;
  let totalHours = 0;
  let totalIncome = 0;
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

    cell.addEventListener("click", () => openShiftModal(dateKey));
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
          totalHours += Number(shift.hours) || 0;
          totalIncome += Number(shift.totalPay) || 0;
          monthShifts.push({ dateKey, day, ...shift });
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

  renderShiftList(monthShifts, month);
}

function renderShiftList(monthShifts, month) {
  const listEl = elements.shiftList;
  if (!listEl) return;

  if (monthShifts.length === 0) {
    listEl.innerHTML =
      '<div class="shift-list__empty">Нажми на любой день в календаре, чтобы добавить смену</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  const currency = escapeHtml(settings.currency);

  // Безопасный reverse без мутации исходного массива
  [...monthShifts].reverse().forEach((s) => {
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
// Экспорт CSV
// ============================================================
function exportCSV(allTime = false) {
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

  Object.keys(shifts)
    .sort()
    .forEach((key) => {
      if (allTime || key.startsWith(datePrefix)) {
        const s = shifts[key];
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

  const csvContent = "\uFEFF" + rows.map((e) => e.join(";")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const filename = allTime ? "shifts_all.csv" : `shifts_${monthPrefix}.csv`;
  triggerDownload(blob, filename);
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
        settings = {
          start:
            typeof s.start === "string" ? s.start : DEFAULT_SETTINGS.start,
          end: typeof s.end === "string" ? s.end : DEFAULT_SETTINGS.end,
          breakMins:
            typeof s.breakMins === "number"
              ? s.breakMins
              : DEFAULT_SETTINGS.breakMins,
          payMode: ["hourly", "fixed"].includes(s.payMode)
            ? s.payMode
            : DEFAULT_SETTINGS.payMode,
          rate:
            typeof s.rate === "number" ? s.rate : DEFAULT_SETTINGS.rate,
          currency:
            typeof s.currency === "string"
              ? s.currency
              : DEFAULT_SETTINGS.currency,
        };
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      closeModal("settingsModal");
      render();
      alert("Данные успешно восстановлены!");
    } catch (err) {
      alert("Ошибка чтения файла бэкапа");
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

        // Разрешаем смахивание, если шторка прокручена к самому верху или тап по шапке/ручке
        if (content.scrollTop <= 0 || isTopDrag) {
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

        // Если тянем вниз от верха шторки или за шапку — отменяем нативный жест (pull-to-refresh)
        if (dy > 0 && (content.scrollTop <= 0 || isTopDrag)) {
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
// PWA: Service Worker и автообновление
// ============================================================
function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").then((reg) => {
      reg.update();

      if (reg.waiting) {
        showUpdatePrompt(reg.waiting);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showUpdatePrompt(newWorker);
          }
        });
      });
    });

    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  });
}

function showUpdatePrompt(worker) {
  const toast = elements.updateToast;
  const btn = elements.updateReloadBtn;
  if (!toast || !btn) return;
  toast.style.display = "flex";
  btn.addEventListener("click", () => {
    worker.postMessage({ action: "skipWaiting" });
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

  // Модальное окно детализации смен
  if (elements.openShiftsBtn) {
    elements.openShiftsBtn.addEventListener("click", () => openModal("shiftsModal"));
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

  // Бэкап
  elements.backupDownloadBtn.addEventListener("click", downloadBackup);
  elements.backupRestoreBtn.addEventListener("click", () =>
    elements.importFile.click(),
  );
  elements.importFile.addEventListener("change", restoreBackup);

  // Закрытие модалок по клику на оверлей или по Escape
  [elements.shiftModal, elements.settingsModal, elements.shiftsModal].forEach((overlay) => {
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
