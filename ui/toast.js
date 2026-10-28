/**
 * ui/toast.js
 * Всплывающие уведомления (тосты), тактильная отдача (вибрация) и строковые утилиты.
 */

let toastTimer = null;
let isSwipeBound = false;

function initToastInteractions(toast) {
  if (isSwipeBound || !toast) return;
  isSwipeBound = true;

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;

  toast.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    currentX = startX;
    currentY = startY;
    isDragging = true;
    toast.style.transition = "none";
  }, { passive: true });

  toast.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    currentX = e.touches[0].clientX;
    currentY = e.touches[0].clientY;
    const dx = currentX - startX;
    const dy = currentY - startY;

    // Смахивание вниз (к краю экрана) или вбок
    const isMobile = window.innerWidth <= 600;
    const xBase = isMobile ? dx : `calc(-50% + ${dx}px)`;
    const yVal = Math.max(-10, dy);

    toast.style.transform = `translate(${xBase}, ${yVal}px)`;
    const maxDist = Math.max(Math.abs(dx), Math.max(0, dy));
    toast.style.opacity = String(Math.max(0, 1 - maxDist / 140));
  }, { passive: true });

  const finishDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    const dx = currentX - startX;
    const dy = currentY - startY;

    toast.style.transition = "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease";

    // Если смахнули вниз на 35px или вбок на 50px — закрываем
    if (dy > 35 || Math.abs(dx) > 50) {
      const isMobile = window.innerWidth <= 600;
      const finalX = isMobile ? (dx > 0 ? "100%" : "-100%") : (dx > 0 ? "50%" : "-150%");
      toast.style.transform = dy > 35 ? (isMobile ? "translate(0, 60px)" : "translate(-50%, 60px)") : `translate(${finalX}, 0)`;
      toast.style.opacity = "0";
      triggerHaptic(10);
      if (toastTimer) clearTimeout(toastTimer);
      setTimeout(() => {
        toast.classList.remove("active");
        toast.style.transform = "";
        toast.style.opacity = "";
      }, 260);
    } else {
      // Возвращаем на место
      toast.style.transform = "";
      toast.style.opacity = "";
    }
  };

  toast.addEventListener("touchend", finishDrag);
  toast.addEventListener("touchcancel", finishDrag);

  // Тап по уведомлению для быстрого скрытия
  toast.addEventListener("click", (e) => {
    if (e.target.closest(".app-toast__action")) return;
    toast.classList.remove("active");
    if (toastTimer) clearTimeout(toastTimer);
  });
}

/**
 * Экранирование HTML-спецсимволов для защиты от XSS
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return "";
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Склонение русских числительных (1 смена, 2 смены, 5 смен)
 * @param {number} number
 * @param {[string, string, string]} forms [один, два-четыре, много]
 * @returns {string}
 */
export function getRussianDeclension(number, forms) {
  const n = Math.abs(number) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (n1 > 1 && n1 < 5) return forms[1];
  if (n1 === 1) return forms[0];
  return forms[2];
}

/**
 * Тактильный отклик (Haptic Feedback) для мобильных устройств
 * @param {number|number[]} [pattern=10]
 */
export function triggerHaptic(pattern = 10) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch (_) {}
  }
}

/**
 * Отображение тост-уведомления
 * @param {string} message
 * @param {"info"|"success"|"error"} [type="info"]
 * @param {{ label: string, onClick: Function }|null} [action=null]
 * @param {number|null} [duration=null]
 */
export function showToast(message, type = "info", action = null, duration = null) {
  const toast = document.getElementById("appToast");
  if (!toast) return;

  const iconEl = toast.querySelector(".app-toast__icon");
  const msgEl = toast.querySelector(".app-toast__message");

  if (msgEl) msgEl.textContent = message;

  // Очищаем старую кнопку действия
  const oldAction = toast.querySelector(".app-toast__action");
  if (oldAction) oldAction.remove();

  if (action && typeof action.onClick === "function") {
    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "app-toast__action";
    actionBtn.textContent = action.label || "Отменить";
    actionBtn.addEventListener("click", () => {
      toast.classList.remove("active");
      action.onClick();
    });
    toast.appendChild(actionBtn);
  }

  initToastInteractions(toast);
  toast.style.transform = "";
  toast.style.opacity = "";
  toast.className = `app-toast app-toast--${type} active`;

  if (iconEl) {
    if (type === "success") {
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (type === "error") {
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
  }

  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, duration || (action ? 5000 : 3500));
}
