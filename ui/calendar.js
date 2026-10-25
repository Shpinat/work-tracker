/**
 * ui/calendar.js
 * Рендеринг календарной сетки, генерация ячеек дней и обработка свайп-жестов переключения месяцев.
 */

import { formatDateKey } from "../domain/payroll.js";
import { getShiftIconSvg } from "./icons.js";

let isSwipingMonth = false;

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

    const iconWrapper = document.createElement("div");
    iconWrapper.className = "calendar__day-icons";

    const iconSpan = document.createElement("span");
    iconSpan.className = "calendar__shift-icon";
    iconSpan.setAttribute("aria-hidden", "true");
    iconSpan.innerHTML = getShiftIconSvg(shift.type);
    iconWrapper.appendChild(iconSpan);

    const hasNote = Boolean(shift.note && shift.note.trim());
    if (hasNote) {
      const dot = document.createElement("span");
      dot.className = "calendar__tag-dot";
      dot.title = shift.note;
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
      if (onDayLongPress) onDayLongPress(dateKey);
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
    if (!shift) {
      e.preventDefault();
      if (onDayLongPress) onDayLongPress(dateKey);
    }
  });

  cell.addEventListener("click", () => {
    if (isLongPressTriggered) {
      isLongPressTriggered = false;
      return;
    }
    if (onDayClick) onDayClick(dateKey);
  });

  cell.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (onDayClick) onDayClick(dateKey);
    }
  });

  return cell;
}

/**
 * Рендерит всю сетку календаря с предыдущими, текущими и следующими днями
 */
export function renderCalendarGrid(grid, {
  year,
  month,
  shifts,
  onDayClick,
  onDayLongPress,
}) {
  if (!grid) return;

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = (firstDay + 6) % 7; // Пн = 0

  const today = new Date();
  const todayKey = formatDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
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

    fragment.appendChild(
      createDayCell({
        day: prevDay,
        dateKey,
        isOtherMonth: true,
        isWeekend,
        isToday: dateKey === todayKey,
        shift: shifts[dateKey] || null,
        ariaLabel: `Предыдущий месяц, ${prevDay}`,
        onDayClick,
        onDayLongPress,
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
        shift: shifts[dateKey] || null,
        ariaLabel: "",
        onDayClick,
        onDayLongPress,
      })
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

    fragment.appendChild(
      createDayCell({
        day: d,
        dateKey,
        isOtherMonth: true,
        isWeekend,
        isToday: dateKey === todayKey,
        shift: shifts[dateKey] || null,
        ariaLabel: `Следующий месяц, ${d}`,
        onDayClick,
        onDayLongPress,
      })
    );
  }

  grid.innerHTML = "";
  grid.appendChild(fragment);
}

/**
 * Анимированный переход между месяцами
 */
export function animateMonthSwipe(grid, delta, onSwitchMonth) {
  if (isSwipingMonth) return;
  if (!grid) {
    if (onSwitchMonth) onSwitchMonth();
    return;
  }
  isSwipingMonth = true;

  const outX = delta === 1 ? -100 : 100;
  const inX = delta === 1 ? 100 : -100;

  grid.style.transition = "transform 0.16s ease-out, opacity 0.16s ease-out";
  grid.style.transform = `translateX(${outX}%)`;
  grid.style.opacity = "0";

  setTimeout(() => {
    if (onSwitchMonth) onSwitchMonth();

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
      if (isSwipingMonth) return;
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

  calendarContainer.addEventListener(
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
        if (dx > 0) {
          if (onSwipeRight) onSwipeRight();
        } else {
          if (onSwipeLeft) onSwipeLeft();
        }
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
