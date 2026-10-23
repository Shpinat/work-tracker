const STORAGE_KEY = "my_work_shifts_v1";
const SETTINGS_KEY = "my_work_settings_v1";

let currentDate = new Date();
let shifts = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
let settings = JSON.parse(
  localStorage.getItem(SETTINGS_KEY) ||
    JSON.stringify({
      start: "09:00",
      end: "21:00",
      breakMins: 60,
      payMode: "hourly",
      rate: 300,
      currency: "₽",
    }),
);

// Кэширование DOM-элементов
const elements = {
  // Навигация и заголовок
  monthTitle: document.getElementById("monthTitle"),
  themeIcon: document.getElementById("themeIcon"),
  metaThemeColor: document.querySelector('meta[name="theme-color"]'),

  // Статистика
  statShifts: document.getElementById("statShifts"),
  statHours: document.getElementById("statHours"),
  statIncome: document.getElementById("statIncome"),

  // Календарь и список смен
  calendarGrid: document.getElementById("calendarGrid"),
  shiftList: document.getElementById("shiftList"),

  // Модальное окно смены
  shiftModal: document.getElementById("shiftModal"),
  shiftModalTitle: document.getElementById("shiftModalTitle"),
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
  defStart: document.getElementById("defStart"),
  defEnd: document.getElementById("defEnd"),
  defBreak: document.getElementById("defBreak"),
  defPayMode: document.getElementById("defPayMode"),
  defRate: document.getElementById("defRate"),
  defCurrency: document.getElementById("defCurrency"),

  // PWA тост
  updateToast: document.getElementById("updateToast"),
  updateReloadBtn: document.getElementById("updateReloadBtn"),
};

const monthNames = [
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

function formatDateKey(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  render();
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

function openShiftModal(dateKey) {
  const modal = elements.shiftModal;
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

  modal.classList.add("active");
}

function closeModal(id) {
  const modal = elements[id] || document.getElementById(id);
  if (modal) modal.classList.remove("active");
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
  const dateKey = elements.shiftDate.value;
  delete shifts[dateKey];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
  closeModal("shiftModal");
  render();
}

function openSettings() {
  elements.defStart.value = settings.start;
  elements.defEnd.value = settings.end;
  elements.defBreak.value = settings.breakMins;
  elements.defPayMode.value = settings.payMode;
  elements.defRate.value = settings.rate;
  elements.defCurrency.value = settings.currency || "₽";
  elements.settingsModal.classList.add("active");
}

function saveSettings() {
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

function render() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  elements.monthTitle.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Пн = 0

  const grid = elements.calendarGrid;
  grid.innerHTML = "";

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar__day-cell calendar__day-cell--empty";
    grid.appendChild(empty);
  }

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

  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(year, month, day);
    const shift = shifts[dateKey];
    const cell = document.createElement("div");
    cell.className = "calendar__day-cell";
    if (dateKey === todayKey) cell.classList.add("calendar__day-cell--today");

    let html = `<div class="calendar__day-number">${day}</div>`;
    if (shift) {
      cell.classList.add("calendar__day-cell--has-shift");
      if (shift.type === "night")
        cell.classList.add("calendar__day-cell--night");
      html += `<div class="calendar__shift-badge">${shift.hours}ч</div>`;

      totalShifts++;
      totalHours += Number(shift.hours) || 0;
      totalIncome += Number(shift.totalPay) || 0;
      monthShifts.push({ dateKey, day, ...shift });
    }
    cell.innerHTML = html;
    cell.onclick = () => openShiftModal(dateKey);
    grid.appendChild(cell);
  }

  elements.statShifts.textContent = totalShifts;
  elements.statHours.textContent = Math.round(totalHours * 100) / 100;
  elements.statIncome.textContent = `${totalIncome.toLocaleString("ru-RU")} ${settings.currency}`;

  const listEl = elements.shiftList;
  if (monthShifts.length === 0) {
    listEl.innerHTML = `<div class="shift-list__empty">Нажми на любой день в календаре, чтобы добавить смену</div>`;
  } else {
    listEl.innerHTML = monthShifts
      .reverse()
      .map((s) => {
        const icon =
          s.type === "night" ? "🌙" : s.type === "extra" ? "🔥" : "☀️";
        const noteStr = s.note ? ` • ${s.note}` : "";
        return `
                <article class="shift-list__item" onclick="openShiftModal('${s.dateKey}')">
                    <div class="shift-list__left">
                        <div class="shift-list__date">${icon} ${s.day} ${monthNames[month].toLowerCase()}</div>
                        <div class="shift-list__meta">${s.start} – ${s.end}${noteStr}</div>
                    </div>
                    <div class="shift-list__right">
                        <div class="shift-list__pay">+${Number(s.totalPay).toLocaleString("ru-RU")} ${settings.currency}</div>
                        <div class="shift-list__hours">${s.hours} ч.</div>
                    </div>
                </article>
            `;
      })
      .join("");
  }
}

function exportCSV() {
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
      if (key.startsWith(datePrefix)) {
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
          `"${s.note || ""}"`,
        ]);
      }
    });

  const csvContent = "﻿" + rows.map((e) => e.join(";")).join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `shifts_${monthPrefix}.csv`;
  link.click();
}

function downloadBackup() {
  const data = JSON.stringify({ shifts, settings }, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `shifts_backup_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
}

function restoreBackup(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const parsed = JSON.parse(e.target.result);
      if (parsed.shifts) shifts = parsed.shifts;
      if (parsed.settings) settings = parsed.settings;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(shifts));
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      closeModal("settingsModal");
      render();
      alert("Данные успешно восстановлены!");
    } catch (err) {
      alert("Ошибка чтения файла бэкапа");
    }
  };
  reader.readAsText(file);
}

// ----------------------------------------------------
// PWA: Регистрация Service Worker и автообновление
// ----------------------------------------------------
if ("serviceWorker" in navigator) {
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
  btn.onclick = () => {
    worker.postMessage({ action: "skipWaiting" });
  };
}

// Управление анимацией стрелочек в выпадающих списках
document.querySelectorAll(".form__select").forEach((select) => {
  // 1. Клик по списку — переворачиваем стрелку (добавляем/убираем класс)
  select.addEventListener("click", function () {
    this.classList.toggle("is-open");
  });

  // 2. Пользователь кликнул в пустое место (сброс фокуса) — возвращаем стрелку
  select.addEventListener("blur", function () {
    this.classList.remove("is-open");
  });

  // 3. Пользователь выбрал новый пункт — возвращаем стрелку и принудительно сбрасываем системный фокус
  select.addEventListener("change", function () {
    this.classList.remove("is-open");
    this.blur();
  });
});

// === ТЕМА (Светлая / Темная) ===
const THEME_KEY = "my_work_theme_v1";
let currentTheme = localStorage.getItem(THEME_KEY) || "dark";

// Функция применения темы
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);

  // Обновляем theme-color
  const metaThemeColor = elements.metaThemeColor;
  if (metaThemeColor) {
    if (theme === "light") {
      metaThemeColor.setAttribute("content", "#f3f4f6");
    } else {
      metaThemeColor.setAttribute("content", "#131535");
    }
  }

  const icon = elements.themeIcon;
  if (icon) {
    if (theme === "light") {
      // Иконка Луны (для переключения обратно на темную)
      icon.innerHTML =
        '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    } else {
      // Иконка Солнца (для переключения на светлую)
      icon.innerHTML =
        '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
    }
  }
}

// Функция-переключатель для кнопки
function toggleTheme() {
  currentTheme = currentTheme === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, currentTheme);
  applyTheme(currentTheme);
}

// Применяем сохраненную тему при загрузке страницы
applyTheme(currentTheme);

render();
