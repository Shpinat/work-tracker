/**
 * ui/calendar.js
 * Рендеринг календарной сетки, генерация ячеек дней, делегирование событий
 * и обработка свайп-жестов переключения месяцев.
 */

import { formatDateKey } from "../domain/payroll.js";
import {
  getShiftIconSvg,
  DEFAULT_TEMPLATE_STYLE,
  MONTH_NAMES_GENITIVE,
  HEX_COLOR_RE,
} from "./icons.js";

const WEEKDAY_NAMES_FULL = [
  "воскресенье",
  "понедельник",
  "вторник",
  "среда",
  "четверг",
  "пятница",
  "суббота",
];

const PRESET_FALLBACK_NAMES = {
  day: "День",
  night: "Ночь",
  extra: "Подработка",
};

let isSwipingMonth = false;
const delegatedGrids = new WeakSet();
const gridHandlers = new WeakMap();

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Формирует доступный aria-label для ячейки календаря
 */
export function buildDayAriaLabel({
  year,
  month,
  day,
  isOtherMonth = false,
  isToday = false,
  shift = null,
  settings = null,
}) {
  const weekdayIdx = new Date(year, month, day).getDay();
  const weekday = WEEKDAY_NAMES_FULL[weekdayIdx] || "";
  const monthName = MONTH_NAMES_GENITIVE[month] || "";
  const parts = [`${day} ${monthName}`, weekday];

  if (isToday) parts.push("сегодня");
  if (isOtherMonth) parts.push("другой месяц");

  if (shift) {
    const typeName =
      settings?.presets?.[shift.type]?.name ||
      PRESET_FALLBACK_NAMES[shift.type] ||
      "Смена";
    parts.push(`смена: ${typeName}, ${shift.hours} ч`);
    const note = typeof shift.note === "string" ? shift.note.trim() : "";
    if (note) {
      parts.push(`заметка: ${note}`);
    }
  }

  return parts.join(", ");
}

/**
 * Привязывает делегированные обработчики событий к контейнеру сетки календаря (однократно)
 * @param {HTMLElement} grid
 */
function ensureCalendarDelegation(grid) {
  if (!grid || delegatedGrids.has(grid)) return;
  delegatedGrids.add(grid);

  let touchStartX = 0;
  let touchStartY = 0;
  let longPressTimeout = null;
  let longPressResetTimer = null;
  let isLongPressTriggered = false;
  let activeDateKey = null;

  const cancelLongPress = () => {
    if (longPressTimeout) {
      clearTimeout(longPressTimeout);
      longPressTimeout = null;
    }
    activeDateKey = null;
  };

  grid.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1 || isSwipingMonth) return;
      const cell = e.target.closest(".calendar__day-cell[data-date-key]");
      if (!cell) return;

      const dateKey = cell.dataset.dateKey;
      const state = gridHandlers.get(grid);
      if (!dateKey || state?.shifts?.[dateKey]) return;

      isLongPressTriggered = false;
      activeDateKey = dateKey;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;

      if (longPressTimeout) clearTimeout(longPressTimeout);
      longPressTimeout = setTimeout(() => {
        longPressTimeout = null;
        if (isSwipingMonth || !activeDateKey) return;
        const currentState = gridHandlers.get(grid);
        if (currentState?.shifts?.[activeDateKey]) return;
        isLongPressTriggered = true;
        currentState?.onDayLongPress?.(activeDateKey);
        if (longPressResetTimer) clearTimeout(longPressResetTimer);
        longPressResetTimer = setTimeout(() => {
          isLongPressTriggered = false;
        }, 600);
      }, 420);
    },
    { passive: true },
  );

  grid.addEventListener(
    "touchmove",
    (e) => {
      if (!longPressTimeout) return;
      if (isSwipingMonth || e.touches.length !== 1) {
        cancelLongPress();
        return;
      }
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      if (dx > 10 || dy > 10) {
        cancelLongPress();
      }
    },
    { passive: true },
  );

  grid.addEventListener("touchend", cancelLongPress, { passive: true });
  grid.addEventListener("touchcancel", cancelLongPress, { passive: true });

  grid.addEventListener("contextmenu", (e) => {
    const cell = e.target.closest(".calendar__day-cell[data-date-key]");
    if (!cell) return;
    const dateKey = cell.dataset.dateKey;
    const state = gridHandlers.get(grid);
    if (!dateKey || state?.shifts?.[dateKey]) return;
    e.preventDefault();
    state?.onDayLongPress?.(dateKey);
  });

  grid.addEventListener("click", (e) => {
    const cell = e.target.closest(".calendar__day-cell[data-date-key]");
    if (!cell) return;
    if (isLongPressTriggered) {
      isLongPressTriggered = false;
      return;
    }
    const dateKey = cell.dataset.dateKey;
    const state = gridHandlers.get(grid);
    if (!dateKey || !state) return;
    if (typeof state.onDayStamp === "function") {
      state.onDayStamp(dateKey);
    } else {
      state.onDayClick?.(dateKey);
    }
  });

  grid.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const cell = e.target.closest(".calendar__day-cell[data-date-key]");
    if (!cell) return;
    e.preventDefault();
    const dateKey = cell.dataset.dateKey;
    const state = gridHandlers.get(grid);
    if (!dateKey || !state) return;
    if (typeof state.onDayStamp === "function") {
      state.onDayStamp(dateKey);
    } else {
      state.onDayClick?.(dateKey);
    }
  });
}

/**
 * Создает DOM-элемент ячейки дня
 */
export function createDayCell({
  day,
  dateKey,
  isOtherMonth = false,
  isWeekend = false,
  isToday = false,
  shift = null,
  settings = null,
  ariaLabel = "",
  onDayClick = null,
  onDayLongPress = null,
}) {
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
    if (shift.type === "night") {
      cell.classList.add("calendar__day-cell--night");
    }
    if (shift.type === "extra") {
      cell.classList.add("calendar__day-cell--extra");
    }

    const rawColor =
      settings?.presets?.[shift.type]?.color ||
      DEFAULT_TEMPLATE_STYLE[shift.type]?.color ||
      DEFAULT_TEMPLATE_STYLE.day.color;
    const presetColor =
      typeof rawColor === "string" && HEX_COLOR_RE.test(rawColor.trim())
        ? rawColor.trim()
        : DEFAULT_TEMPLATE_STYLE.day.color;
    cell.style.setProperty("--shift-color", presetColor);

    const iconWrapper = document.createElement("div");
    iconWrapper.className = "calendar__day-icons";

    const iconSpan = document.createElement("span");
    iconSpan.className = "calendar__shift-icon";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.innerHTML = getShiftIconSvg(shift.type, settings);
    iconWrapper.appendChild(iconSpan);

    const noteText = typeof shift.note === "string" ? shift.note.trim() : "";
    if (noteText) {
      const dot = document.createElement("span");
      dot.className = "calendar__tag-dot";
      dot.title = noteText;
      dot.setAttribute("aria-hidden", "true");
      iconWrapper.appendChild(dot);
    }

    dayHeader.appendChild(iconWrapper);

    const badge = document.createElement("div");
    badge.className = "calendar__shift-badge";
    badge.textContent = `${shift.hours}ч`;
    cell.appendChild(dayHeader);
    cell.appendChild(badge);
  } else {
    cell.appendChild(dayHeader);
  }

  cell.setAttribute("role", "button");
  cell.setAttribute("tabindex", "0");
  if (ariaLabel) cell.setAttribute("aria-label", ariaLabel);

  // Обратная совместимость при прямом вызове createDayCell вне renderCalendarGrid
  if (onDayClick || onDayLongPress) {
    let touchStartX = 0;
    let touchStartY = 0;
    let longPressTimeout = null;
    let isLongPressTriggered = false;

    const startLongPress = (e) => {
      if (shift) return;
      isLongPressTriggered = false;
      const touch = e.touches ? e.touches[0] : e;
      touchStartX = touch.clientX;
      touchStartY = touch.clientY;
      longPressTimeout = setTimeout(() => {
        isLongPressTriggered = true;
        onDayLongPress?.(dateKey);
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
      if (Math.abs(touch.clientX - touchStartX) > 10 || Math.abs(touch.clientY - touchStartY) > 10) {
        cancelLongPress();
      }
    };

    cell.addEventListener("touchstart", startLongPress, { passive: true });
    cell.addEventListener("touchmove", moveLongPress, { passive: true });
    cell.addEventListener("touchend", cancelLongPress, { passive: true });
    cell.addEventListener("touchcancel", cancelLongPress, { passive: true });
    cell.addEventListener("contextmenu", (e) => {
      if (!shift) {
        e.preventDefault();
        onDayLongPress?.(dateKey);
      }
    });
    cell.addEventListener("click", () => {
      if (isLongPressTriggered) {
        isLongPressTriggered = false;
        return;
      }
      onDayClick?.(dateKey);
    });
    cell.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onDayClick?.(dateKey);
      }
    });
  }

  return cell;
}

/**
 * Рендерит всю сетку календаря с предыдущими, текущими и следующими днями
 */
export function renderCalendarGrid(grid, {
  year,
  month,
  shifts,
  settings = null,
  onDayClick,
  onDayLongPress,
  onDayStamp = null,
}) {
  if (!grid) return;

  ensureCalendarDelegation(grid);
  gridHandlers.set(grid, {
    shifts: shifts || {},
    onDayClick,
    onDayLongPress,
    onDayStamp,
  });

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Пн = 0

  const today = new Date();
  const todayKey = formatDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );

  const fragment = document.createDocumentFragment();

  // Дни предыдущего месяца
  const prevMonthDate = new Date(year, month - 1, 1);
  const prevMonthYear = prevMonthDate.getFullYear();
  const prevMonthIdx = prevMonthDate.getMonth();
  const prevMonthLastDate = new Date(year, month, 0).getDate();

  for (let i = startOffset - 1; i >= 0; i--) {
    const prevDay = prevMonthLastDate - i;
    const dateKey = formatDateKey(prevMonthYear, prevMonthIdx, prevDay);
    const colIndex = startOffset - 1 - i;
    const isWeekend = colIndex === 5 || colIndex === 6;
    const shift = shifts?.[dateKey] || null;
    const isToday = dateKey === todayKey;

    fragment.appendChild(
      createDayCell({
        day: prevDay,
        dateKey,
        isOtherMonth: true,
        isWeekend,
        isToday,
        shift,
        settings,
        ariaLabel: buildDayAriaLabel({
          year: prevMonthYear,
          month: prevMonthIdx,
          day: prevDay,
          isOtherMonth: true,
          isToday,
          shift,
          settings,
        }),
      }),
    );
  }

  // Дни текущего месяца
  for (let day = 1; day <= daysInMonth; day++) {
    const dateKey = formatDateKey(year, month, day);
    const dayOfWeek = (startOffset + day - 1) % 7;
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
    const shift = shifts?.[dateKey] || null;
    const isToday = dateKey === todayKey;

    fragment.appendChild(
      createDayCell({
        day,
        dateKey,
        isOtherMonth: false,
        isWeekend,
        isToday,
        shift,
        settings,
        ariaLabel: buildDayAriaLabel({
          year,
          month,
          day,
          isOtherMonth: false,
          isToday,
          shift,
          settings,
        }),
      }),
    );
  }

  // Дни следующего месяца
  const totalCells = startOffset + daysInMonth;
  const remainingCells = (7 - (totalCells % 7)) % 7;
  const nextMonthDate = new Date(year, month + 1, 1);
  const nextMonthYear = nextMonthDate.getFullYear();
  const nextMonthIdx = nextMonthDate.getMonth();

  for (let d = 1; d <= remainingCells; d++) {
    const dateKey = formatDateKey(nextMonthYear, nextMonthIdx, d);
    const colIndex = (totalCells + d - 1) % 7;
    const isWeekend = colIndex === 5 || colIndex === 6;
    const shift = shifts?.[dateKey] || null;
    const isToday = dateKey === todayKey;

    fragment.appendChild(
      createDayCell({
        day: d,
        dateKey,
        isOtherMonth: true,
        isWeekend,
        isToday,
        shift,
        settings,
        ariaLabel: buildDayAriaLabel({
          year: nextMonthYear,
          month: nextMonthIdx,
          day: d,
          isOtherMonth: true,
          isToday,
          shift,
          settings,
        }),
      }),
    );
  }

  grid.innerHTML = "";
  grid.appendChild(fragment);
}

/**
 * Анимированный переход между месяцами
 * Плавно продолжает движение с текущей позиции свайпа и учитывает prefers-reduced-motion.
 */
export function animateMonthSwipe(grid, delta, onSwitchMonth) {
  if (isSwipingMonth) return;
  if (!grid || prefersReducedMotion()) {
    try {
      onSwitchMonth?.();
    } catch (err) {
      console.error("Month switch callback error:", err);
    } finally {
      if (grid) {
        grid.style.transition = "";
        grid.style.transform = "";
        grid.style.opacity = "";
      }
      isSwipingMonth = false;
    }
    return;
  }

  isSwipingMonth = true;

  // Фиксируем текущее состояние transform (например, после живого drag), чтобы переход не прыгал в 0
  void window.getComputedStyle(grid).transform;

  const outX = delta === 1 ? -100 : 100;
  const inX = delta === 1 ? 100 : -100;

  grid.style.transition = "transform 0.16s ease-out, opacity 0.16s ease-out";
  grid.style.transform = `translateX(${outX}%)`;
  grid.style.opacity = "0";

  setTimeout(() => {
    try {
      onSwitchMonth?.();
    } catch (err) {
      console.error("Month switch callback error:", err);
    } finally {
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
    }
  }, 160);
}

/**
 * Инициализирует свайпы пальцем по календарю для переключения месяцев
 */
export function initCalendarSwipe(calendarContainer, grid, { onSwipeLeft, onSwipeRight }) {
  if (!calendarContainer || !grid) return;

  let touchStartX = 0;
  let touchStartY = 0;
  let isTracking = false;
  let isHorizontal = false;

  calendarContainer.addEventListener(
    "touchstart",
    (e) => {
      if (isSwipingMonth || e.touches.length !== 1) return;
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      isTracking = true;
      isHorizontal = false;
    },
    { passive: true },
  );

  calendarContainer.addEventListener(
    "touchmove",
    (e) => {
      if (!isTracking || isSwipingMonth || e.touches.length !== 1) return;

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

  const resetOrCancel = (e) => {
    if (!isTracking || isSwipingMonth) return;
    isTracking = false;

    if (!isHorizontal) return;
    isHorizontal = false;

    const changed = e.changedTouches?.[0];
    const dx = changed ? changed.clientX - touchStartX : 0;
    const dy = changed ? changed.clientY - touchStartY : 0;

    if (e.type === "touchend" && Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        onSwipeRight?.();
      } else {
        onSwipeLeft?.();
      }
    } else if (prefersReducedMotion()) {
      grid.style.transition = "";
      grid.style.transform = "";
      grid.style.opacity = "";
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
  };

  calendarContainer.addEventListener("touchend", resetOrCancel, { passive: true });
  calendarContainer.addEventListener("touchcancel", resetOrCancel, { passive: true });
}
