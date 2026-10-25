/**
 * ui/shift-list.js
 * Рендеринг списка детализации смен за месяц, фильтрация и управление эффектом плавного затухания/размытия.
 */

import { escapeHtml } from "./toast.js";
import { MONTH_NAMES_GENITIVE, getShiftIconSvg } from "./icons.js";

/**
 * Динамическое управление классами плавного затухания и размытия по краям прокрутки
 * @param {HTMLElement} listEl
 * @param {HTMLElement} wrapperEl
 */
export function updateShiftListScrollGradients(listEl, wrapperEl) {
  if (!listEl || !wrapperEl) return;

  const isScrolled = listEl.scrollTop > 4;
  const isAtBottom = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight <= 4;
  const hasScroll = listEl.scrollHeight > listEl.clientHeight + 4;

  wrapperEl.classList.toggle("can-scroll-up", isScrolled);
  wrapperEl.classList.toggle("can-scroll-down", hasScroll && !isAtBottom);
}

/**
 * Отрисовка списка смен месяца с учетом активного фильтра периода выплат
 * @param {Object} options
 * @param {HTMLElement} options.listEl
 * @param {HTMLElement} options.wrapperEl
 * @param {Array<Object>} options.monthShifts
 * @param {number} options.year
 * @param {number} options.month 0-indexed
 * @param {"all"|"advance"|"salary"} options.filter
 * @param {Object} options.settings
 * @param {Function} options.onShiftClick
 */
export function renderShiftList({
  listEl,
  wrapperEl,
  monthShifts = [],
  year,
  month,
  filter = "all",
  settings,
  onShiftClick,
}) {
  if (!listEl) return;

  const cutoffDay = settings.advanceCutoffDay || 15;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let filteredShifts = monthShifts;
  if (filter === "advance") {
    filteredShifts = monthShifts.filter((s) => s.day <= cutoffDay);
  } else if (filter === "salary") {
    filteredShifts = monthShifts.filter((s) => s.day > cutoffDay);
  }

  if (filteredShifts.length === 0) {
    let emptyMsg = "Нажми на любой день в календаре, чтобы добавить смену";
    if (filter === "advance") {
      emptyMsg = `В периоде аванса (1–${cutoffDay} ${MONTH_NAMES_GENITIVE[month]}) пока нет смен`;
    } else if (filter === "salary") {
      emptyMsg = `В периоде расчёта (${cutoffDay + 1}–${daysInMonth} ${MONTH_NAMES_GENITIVE[month]}) пока нет смен`;
    }
    listEl.innerHTML = `<div class="shift-list__empty">${emptyMsg}</div>`;
    if (wrapperEl) {
      updateShiftListScrollGradients(listEl, wrapperEl);
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  const currency = escapeHtml(settings.currency || "₽");

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

    if (typeof onShiftClick === "function") {
      article.addEventListener("click", () => onShiftClick(s.dateKey));
      article.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onShiftClick(s.dateKey);
        }
      });
    }

    fragment.appendChild(article);
  });

  listEl.innerHTML = "";
  listEl.appendChild(fragment);

  if (wrapperEl) {
    requestAnimationFrame(() => updateShiftListScrollGradients(listEl, wrapperEl));
  }
}
