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
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  themeIcon: document.getElementById("themeIcon"),
  settingsBtn: document.getElementById("settingsBtn"),
  metaThemeColor: document.querySelector('meta[name="theme-color"]'),

  // Статистика
  statShifts: document.getElementById("statShifts"),
  statHours: document.getElementById("statHours"),
  statIncome: document.getElementById("statIncome"),

  // Календарь и список смен
  calendarGrid: document.getElementById("calendarGrid"),
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
  startTime: document.getElementById("startTime"),
  endTime: document.getElementById("endTime"),
  breakMins: document.getElementById("breakMins"),
  totalHours: document.getElementById("totalHours"),
  payMode: document.getElementById("payMode"),
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
// Навигация по месяцам
// ============================================================
function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  render();
}

function goToToday() {
  currentDate = new Date();
  render();
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
  if (modal) modal.classList.add("active");
}

function closeModal(id) {
  const modal = elements[id] || document.getElementById(id);
  if (modal) modal.classList.remove("active");
}

function openShiftModal(dateKey) {
  const existing = shifts[dateKey];
  const [y, m, d] = dateKey.split("-");
  elements.shiftModalTitle.textContent = `Смена ${d}.${m}.${y}`;
  elements.shiftDate.value = dateKey;

  if (existing) {
    elements.shiftType.value = existing.type || "day";
    elements.startTime.value = existing.start;
    elements.endTime.value = existing.end;
    elements.breakMins.value = existing.breakMins ?? 0;
    elements.totalHours.value = existing.hours;
    elements.payMode.value = existing.payMode || "hourly";
    elements.rate.value = existing.rate;
    elements.bonus.value = existing.bonus || 0;
    elements.totalPay.value = existing.totalPay;
    elements.note.value = existing.note || "";
    elements.deleteBtn.style.display = "block";
  } else {
    elements.shiftType.value = "day";
    elements.startTime.value = settings.start;
    elements.endTime.value = settings.end;
    elements.breakMins.value = settings.breakMins;
    elements.payMode.value = settings.payMode;
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
  elements.defStart.value = settings.start;
  elements.defEnd.value = settings.end;
  elements.defBreak.value = settings.breakMins;
  elements.defPayMode.value = settings.payMode;
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
  closeModal("settingsModal");
  render();
}

// ============================================================
// Рендер
// ============================================================
function render() {
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

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar__day-cell calendar__day-cell--empty";
    fragment.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(year, month, day);
    const shift = shifts[dateKey];
    const cell = document.createElement("div");
    cell.className = "calendar__day-cell";
    if (dateKey === todayKey) cell.classList.add("calendar__day-cell--today");

    const dayNum = document.createElement("div");
    dayNum.className = "calendar__day-number";
    dayNum.textContent = day;
    cell.appendChild(dayNum);

    if (shift) {
      cell.classList.add("calendar__day-cell--has-shift");
      if (shift.type === "night")
        cell.classList.add("calendar__day-cell--night");
      if (shift.type === "extra")
        cell.classList.add("calendar__day-cell--extra");

      const badge = document.createElement("div");
      badge.className = "calendar__shift-badge";
      badge.textContent = `${shift.hours}ч`;
      cell.appendChild(badge);

      totalShifts++;
      totalHours += Number(shift.hours) || 0;
      totalIncome += Number(shift.totalPay) || 0;
      monthShifts.push({ dateKey, day, ...shift });
    }

    cell.setAttribute("role", "button");
    cell.setAttribute("tabindex", "0");
    cell.addEventListener("click", () => openShiftModal(dateKey));
    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openShiftModal(dateKey);
      }
    });
    fragment.appendChild(cell);
  }

  const grid = elements.calendarGrid;
  grid.innerHTML = "";
  grid.appendChild(fragment);

  elements.statShifts.textContent = totalShifts;
  elements.statHours.textContent = Math.round(totalHours * 100) / 100;
  elements.statIncome.textContent = `${totalIncome.toLocaleString("ru-RU")} ${settings.currency}`;

  renderShiftList(monthShifts, month);
}

function renderShiftList(monthShifts, month) {
  const listEl = elements.shiftList;
  if (monthShifts.length === 0) {
    listEl.innerHTML =
      '<div class="shift-list__empty">Нажми на любой день в календаре, чтобы добавить смену</div>';
    return;
  }

  const fragment = document.createDocumentFragment();
  const currency = escapeHtml(settings.currency);

  // Безопасный reverse без мутации исходного массива
  [...monthShifts].reverse().forEach((s) => {
    const icon =
      s.type === "night" ? "🌙" : s.type === "extra" ? "🔥" : "☀️";
    const noteStr = s.note ? ` • ${escapeHtml(s.note)}` : "";

    const article = document.createElement("article");
    article.className = "shift-list__item";
    article.setAttribute("role", "button");
    article.setAttribute("tabindex", "0");
    article.innerHTML = `
      <div class="shift-list__left">
        <div class="shift-list__date">${icon} ${s.day} ${MONTH_NAMES[month].toLowerCase()}</div>
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
      theme === "light" ? "#f3f4f6" : "#131535",
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
function initSwipe() {
  const calendar = document.querySelector(".calendar");
  if (!calendar) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let currentX = 0;
  let isSwiping = false;

  calendar.addEventListener(
    "touchstart",
    (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isSwiping = true;
      calendar.style.transition = "none"; // Disable transition for immediate tracking
    },
    { passive: true },
  );

  calendar.addEventListener(
    "touchmove",
    (e) => {
      if (!isSwiping) return;

      const touchX = e.touches[0].clientX;
      const touchY = e.touches[0].clientY;
      const dx = touchX - touchStartX;
      const dy = touchY - touchStartY;

      // Only track horizontal swipes
      if (Math.abs(dx) > Math.abs(dy)) {
        // e.preventDefault(); // Could be added, but not strictly needed with passive: false if we change it. Since passive: true, we can't preventDefault. Let's just animate.
        calendar.style.transform = `translateX(${dx}px)`;
      } else {
        isSwiping = false; // Stop tracking if it's more vertical
        calendar.style.transform = '';
      }
    },
    { passive: true },
  );

  calendar.addEventListener(
    "touchend",
    (e) => {
      if (!isSwiping) return;
      isSwiping = false;

      const touchEndX = e.changedTouches[0].clientX;
      const touchEndY = e.changedTouches[0].clientY;
      const dx = touchEndX - touchStartX;
      const dy = touchEndY - touchStartY;

      calendar.style.transition = "transform 0.3s ease-out";

      // Свайп считается горизонтальным, если сдвиг по X больше чем по Y
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        const direction = dx > 0 ? 1 : -1;

        // Animate off screen
        calendar.style.transform = `translateX(${direction * 100}vw)`;

        setTimeout(() => {
          // Immediately hide, move to opposite side, then slide in
          calendar.style.transition = "none";
          calendar.style.transform = `translateX(${-direction * 100}vw)`;

          changeMonth(direction === 1 ? -1 : 1);

          // Small delay to let browser apply the 'none' transition
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              calendar.style.transition = "transform 0.3s ease-out";
              calendar.style.transform = "translateX(0)";
            });
          });
        }, 300); // Wait for off-screen animation
      } else {
        // Snap back if threshold not met
        calendar.style.transform = "translateX(0)";
      }
    },
    { passive: true },
  );
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
// Анимация стрелочек в выпадающих списках
// ============================================================
function initSelectAnimations() {
  document.querySelectorAll(".form__select").forEach((select) => {
    select.addEventListener("click", function () {
      this.classList.toggle("is-open");
    });
    select.addEventListener("blur", function () {
      this.classList.remove("is-open");
    });
    select.addEventListener("change", function () {
      this.classList.remove("is-open");
      this.blur();
    });
  });
}

// ============================================================
// Привязка обработчиков событий
// ============================================================
function bindEvents() {
  // Навигация по месяцам
  elements.prevMonthBtn.addEventListener("click", () => changeMonth(-1));
  elements.nextMonthBtn.addEventListener("click", () => changeMonth(1));
  elements.monthTitle.addEventListener("click", goToToday);
  elements.monthTitle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      goToToday();
    }
  });

  // Тема и настройки
  elements.themeToggleBtn.addEventListener("click", toggleTheme);
  elements.settingsBtn.addEventListener("click", openSettings);

  // Экспорт
  elements.exportMonthBtn.addEventListener("click", () => exportCSV(false));
  elements.exportAllBtn.addEventListener("click", () => exportCSV(true));

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

  // Закрытие модалки по клику на оверлей или по Escape
  [elements.shiftModal, elements.settingsModal].forEach((overlay) => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModal("shiftModal");
      closeModal("settingsModal");
    }
  });
}

// ============================================================
// Инициализация
// ============================================================
applyTheme(currentTheme);
bindEvents();
initSelectAnimations();
initSwipe();
registerSW();
render();
