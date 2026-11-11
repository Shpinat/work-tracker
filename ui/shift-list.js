/**
 * ui/shift-list.js
 * Рендеринг списка детализации смен за месяц, сводки выплат (с отметкой «Выплачено»),
 * фильтрация и управление эффектом плавного затухания/размытия.
 */

import { escapeHtml } from "./toast.js";
import { MONTH_NAMES, MONTH_NAMES_GENITIVE, getShiftIconSvg } from "./icons.js";

const delegatedLists = new WeakSet();
const listHandlers = new WeakMap();
const delegatedSummaries = new WeakSet();
const summaryHandlers = new WeakMap();

function ensureShiftListDelegation(listEl) {
  if (!listEl || delegatedLists.has(listEl)) return;
  delegatedLists.add(listEl);

  listEl.addEventListener("click", (e) => {
    const item = e.target.closest(".shift-list__item[data-date-key]");
    if (!item) return;
    const onShiftClick = listHandlers.get(listEl);
    if (typeof onShiftClick === "function") {
      onShiftClick(item.dataset.dateKey);
    }
  });

  listEl.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const item = e.target.closest(".shift-list__item[data-date-key]");
    if (!item) return;
    e.preventDefault();
    const onShiftClick = listHandlers.get(listEl);
    if (typeof onShiftClick === "function") {
      onShiftClick(item.dataset.dateKey);
    }
  });
}

function ensureSummaryDelegation(summaryEl) {
  if (!summaryEl || delegatedSummaries.has(summaryEl)) return;
  delegatedSummaries.add(summaryEl);

  summaryEl.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-payout-key]");
    if (!btn) return;
    const onTogglePaid = summaryHandlers.get(summaryEl);
    if (typeof onTogglePaid === "function") {
      onTogglePaid(btn.dataset.payoutKey);
    }
  });
}

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
 * Формирует ключ периода выплаты ("YYYY-MM:advance" | "YYYY-MM:salary")
 * @param {number} year
 * @param {number} month 0-indexed
 * @param {"advance"|"salary"} kind
 * @returns {string}
 */
export function formatPayoutKey(year, month, kind) {
  return `${year}-${String(month + 1).padStart(2, "0")}:${kind}`;
}

/**
 * Отрисовка сводки выплат в окне детализации смен с поддержкой отметки «Выплачено»
 * @param {Object} options
 * @param {HTMLElement} options.summaryEl
 * @param {Object|null} options.payout Результат calcPayoutSchedule
 * @param {number} options.year
 * @param {number} options.month 0-indexed
 * @param {string} [options.currency="₽"]
 * @param {Record<string, { paid?: boolean }>} [options.paidPayouts={}]
 * @param {Function|null} [options.onTogglePaid=null]
 */
export function renderShiftsPayoutSummary({
  summaryEl,
  payout,
  year,
  month,
  currency = "₽",
  paidPayouts = {},
  onTogglePaid = null,
}) {
  if (!summaryEl) return;
  if (!payout) {
    summaryEl.style.display = "none";
    summaryEl.innerHTML = "";
    return;
  }

  ensureSummaryDelegation(summaryEl);
  summaryHandlers.set(summaryEl, onTogglePaid);

  const safeCurr = escapeHtml(currency || "₽");
  const curMonthGen = escapeHtml(MONTH_NAMES_GENITIVE[month] || "");
  const nextMonthGen = escapeHtml(MONTH_NAMES_GENITIVE[payout.nextMonthSalary?.payMonth] || "");
  const curMonthName = escapeHtml((MONTH_NAMES[month] || "").toLowerCase());

  const advKey = formatPayoutKey(year, month, "advance");
  const salKey = formatPayoutKey(year, month, "salary");
  const advPaid = Boolean(paidPayouts?.[advKey]?.paid);
  const salPaid = Boolean(paidPayouts?.[salKey]?.paid);

  const advAmount = Number(payout.advance?.amount) || 0;
  const salAmount = Number(payout.nextMonthSalary?.amount) || 0;
  const totalIncoming = Number(payout.totalIncomingInMonth) || 0;

  const hasSecondHalf =
    payout.nextMonthSalary?.fromDay !== null &&
    payout.nextMonthSalary?.fromDay !== undefined &&
    payout.nextMonthSalary?.toDay !== null &&
    payout.nextMonthSalary?.toDay !== undefined &&
    payout.nextMonthSalary.fromDay <= payout.nextMonthSalary.toDay;

  const secondHalfLabel = hasSecondHalf
    ? `ЗП за ${escapeHtml(String(payout.nextMonthSalary.fromDay))}–${escapeHtml(String(payout.nextMonthSalary.toDay))} ${curMonthGen} (выпл. ${escapeHtml(String(payout.nextMonthSalary.payDay))} ${nextMonthGen}):`
    : `ЗП за 2-ю половину ${curMonthGen} (нет дней):`;

  const renderStatusControl = (key, isPaid) => {
    const label = isPaid ? "Выплачено" : "Ожидается";
    if (typeof onTogglePaid !== "function") {
      return `<span class="shifts-payout-summary__status${isPaid ? " is-paid" : ""}">${label}</span>`;
    }
    return `<button type="button" class="shifts-payout-summary__status-btn${isPaid ? " is-paid" : ""}" data-payout-key="${escapeHtml(key)}" aria-pressed="${isPaid ? "true" : "false"}">${label}</button>`;
  };

  summaryEl.style.display = "";
  summaryEl.innerHTML = `
    <div class="shifts-payout-summary__row">
      <span>Аванс (${escapeHtml(String(payout.advance.fromDay))}–${escapeHtml(String(payout.advance.toDay))} ${curMonthGen}, выпл. ${escapeHtml(String(payout.advance.payDay))} ${curMonthGen}):</span>
      <span class="shifts-payout-summary__right">
        ${renderStatusControl(advKey, advPaid)}
        <strong>${advAmount.toLocaleString("ru-RU")} ${safeCurr}</strong>
      </span>
    </div>
    <div class="shifts-payout-summary__row">
      <span>${secondHalfLabel}</span>
      <span class="shifts-payout-summary__right">
        ${hasSecondHalf ? renderStatusControl(salKey, salPaid) : ""}
        <strong>${salAmount.toLocaleString("ru-RU")} ${safeCurr}</strong>
      </span>
    </div>
    <div class="shifts-payout-summary__row shifts-payout-summary__row--muted">
      <span>Поступления в ${curMonthName} (ЗП за прошл. мес. + аванс):</span>
      <strong>${totalIncoming.toLocaleString("ru-RU")} ${safeCurr}</strong>
    </div>
  `;
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
 * @param {HTMLElement|null} [options.summaryEl=null]
 * @param {Object|null} [options.payout=null]
 * @param {Record<string, { paid?: boolean }>} [options.paidPayouts={}]
 * @param {Function|null} [options.onTogglePaid=null]
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
  summaryEl = null,
  payout = null,
  paidPayouts = {},
  onTogglePaid = null,
}) {
  if (summaryEl && payout) {
    renderShiftsPayoutSummary({
      summaryEl,
      payout,
      year,
      month,
      currency: settings?.currency || "₽",
      paidPayouts,
      onTogglePaid,
    });
  }

  if (!listEl) return;

  ensureShiftListDelegation(listEl);
  listHandlers.set(listEl, onShiftClick);

  const cutoffDay = settings?.advanceCutoffDay || 15;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthGenitive = escapeHtml(MONTH_NAMES_GENITIVE[month] || "");

  let filteredShifts = monthShifts;
  if (filter === "advance") {
    filteredShifts = monthShifts.filter((s) => s.day <= cutoffDay);
  } else if (filter === "salary") {
    filteredShifts = monthShifts.filter((s) => s.day > cutoffDay);
  }

  if (filteredShifts.length === 0) {
    let emptyMsg = "Нажми на любой день в календаре, чтобы добавить смену";
    if (filter === "advance") {
      emptyMsg = `В периоде аванса (1–${escapeHtml(String(cutoffDay))} ${monthGenitive}) пока нет смен`;
    } else if (filter === "salary") {
      if (cutoffDay >= daysInMonth) {
        emptyMsg = `В этом месяце нет периода расчёта после ${escapeHtml(String(cutoffDay))}-го числа`;
      } else {
        emptyMsg = `В периоде расчёта (${escapeHtml(String(cutoffDay + 1))}–${escapeHtml(String(daysInMonth))} ${monthGenitive}) пока нет смен`;
      }
    }
    listEl.innerHTML = `
      <div class="shift-list__empty">
        <svg class="shift-list__empty-icon" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
        <p class="shift-list__empty-text">${emptyMsg}</p>
      </div>
    `;
    if (wrapperEl) {
      updateShiftListScrollGradients(listEl, wrapperEl);
    }
    return;
  }

  const fragment = document.createDocumentFragment();
  const currency = escapeHtml(settings?.currency || "₽");

  // Безопасный reverse без мутации исходного массива
  [...filteredShifts].reverse().forEach((s) => {
    const noteText = typeof s.note === "string" ? s.note.trim() : "";
    const noteStr = noteText ? ` • ${escapeHtml(noteText)}` : "";
    const typeName = settings?.presets?.[s.type]?.name;
    const typeBadge = typeName ? ` • ${escapeHtml(typeName)}` : "";
    const tagsArr = Array.isArray(s.tags)
      ? s.tags.map((t) => escapeHtml(String(t))).filter(Boolean)
      : [];
    const tagsStr = tagsArr.length > 0 ? ` • ${tagsArr.join(", ")}` : "";

    const rawPay = Number(s.totalPay ?? s.pay ?? 0);
    const safePay = Number.isFinite(rawPay) ? rawPay : 0;
    const safeDay = escapeHtml(String(s.day));
    const safeHours = escapeHtml(String(s.hours ?? 0));
    const safeStart = escapeHtml(String(s.start || ""));
    const safeEnd = escapeHtml(String(s.end || ""));

    const article = document.createElement("article");
    article.className = "shift-list__item";
    article.dataset.dateKey = String(s.dateKey || "");
    article.setAttribute("role", "button");
    article.setAttribute("tabindex", "0");
    article.setAttribute(
      "aria-label",
      `${s.day} ${MONTH_NAMES_GENITIVE[month] || ""}, ${s.start || ""} – ${s.end || ""}, ${safePay.toLocaleString("ru-RU")} ${settings?.currency || "₽"}, ${s.hours ?? 0} ч${noteText ? `, ${noteText}` : ""}`,
    );
    article.innerHTML = `
      <div class="shift-list__left">
        <div class="shift-list__date">${getShiftIconSvg(s.type, settings)}<span>${safeDay} ${monthGenitive}</span></div>
        <div class="shift-list__meta">${safeStart} – ${safeEnd}${typeBadge}${tagsStr}${noteStr}</div>
      </div>
      <div class="shift-list__right">
        <div class="shift-list__pay">+${safePay.toLocaleString("ru-RU")} ${currency}</div>
        <div class="shift-list__hours">${safeHours} ч.</div>
      </div>
    `;

    fragment.appendChild(article);
  });

  listEl.innerHTML = "";
  listEl.appendChild(fragment);

  if (wrapperEl) {
    requestAnimationFrame(() => updateShiftListScrollGradients(listEl, wrapperEl));
  }
}
