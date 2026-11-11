/**
 * ui/toast.js
 * Всплывающие уведомления (тосты), тактильная отдача (вибрация) и строковые утилиты.
 */

let toastTimer = null;
let dismissTimer = null;
let toastSequence = 0;
let isSwipeBound = false;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function initToastInteractions(toast) {
  if (isSwipeBound || !toast) return;
  isSwipeBound = true;

  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let currentY = 0;
  let isDragging = false;

  toast.addEventListener(
    "touchstart",
    (e) => {
      if (e.touches.length !== 1) return;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      currentX = startX;
      currentY = startY;
      isDragging = true;
      toast.style.transition = "none";
    },
    { passive: true },
  );

  toast.addEventListener(
    "touchmove",
    (e) => {
      if (!isDragging || e.touches.length !== 1) return;
      currentX = e.touches[0].clientX;
      currentY = e.touches[0].clientY;
      const dx = currentX - startX;
      const dy = currentY - startY;

      // Смахивание вверх (к краю экрана) или вбок; брейкпоинт <= 600 соответствует мобильному CSS
      const isMobile = window.innerWidth <= 600;
      const xBase = isMobile ? `${dx}px` : `calc(-50% + ${dx}px)`;
      const yVal = Math.min(10, dy);

      toast.style.transform = `translate(${xBase}, ${yVal}px)`;
      const maxDist = Math.max(Math.abs(dx), Math.max(0, -dy));
      toast.style.opacity = String(Math.max(0, 1 - maxDist / 140));
    },
    { passive: true },
  );

  const finishDrag = () => {
    if (!isDragging) return;
    isDragging = false;
    const dx = currentX - startX;
    const dy = currentY - startY;
    const reduced = prefersReducedMotion();

    toast.style.transition = reduced
      ? "none"
      : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease";

    // Если смахнули вверх на 35px или вбок на 50px — закрываем
    if (dy < -35 || Math.abs(dx) > 50) {
      const isMobile = window.innerWidth <= 600;
      const finalX = isMobile ? (dx > 0 ? "100%" : "-100%") : dx > 0 ? "50%" : "-150%";
      toast.style.transform =
        dy < -35
          ? isMobile
            ? "translate(0, -60px)"
            : "translate(-50%, -60px)"
          : `translate(${finalX}, 0)`;
      toast.style.opacity = "0";
      triggerHaptic(10);
      if (toastTimer) clearTimeout(toastTimer);
      if (dismissTimer) clearTimeout(dismissTimer);
      const seq = toastSequence;

      const finalizeDismiss = () => {
        if (seq !== toastSequence) return;
        toast.classList.remove("active");
        toast.style.transform = "";
        toast.style.opacity = "";
        toast.style.transition = "";
      };

      if (reduced) {
        finalizeDismiss();
      } else {
        dismissTimer = setTimeout(finalizeDismiss, 260);
      }
    } else {
      // Возвращаем на место
      toast.style.transform = "";
      toast.style.opacity = "";
    }
  };

  toast.addEventListener("touchend", finishDrag, { passive: true });
  toast.addEventListener("touchcancel", finishDrag, { passive: true });

  // Тап по уведомлению для быстрого скрытия
  toast.addEventListener("click", (e) => {
    if (e.target.closest(".app-toast__action")) return;
    toast.classList.remove("active");
    toast.style.transform = "";
    toast.style.opacity = "";
    if (toastTimer) clearTimeout(toastTimer);
  });
}

/**
 * Экранирование HTML-спецсимволов для защиты от XSS (чистое строковое экранирование)
 * Корректно обрабатывает число 0 (возвращает "0").
 * @param {unknown} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

  toastSequence += 1;
  if (toastTimer) clearTimeout(toastTimer);
  if (dismissTimer) clearTimeout(dismissTimer);

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
      if (toastTimer) clearTimeout(toastTimer);
      toast.classList.remove("active");
      action.onClick();
    });
    toast.appendChild(actionBtn);
  }

  initToastInteractions(toast);
  toast.style.transform = "";
  toast.style.opacity = "";
  toast.style.transition = "";
  const safeType = type === "success" || type === "error" ? type : "info";
  toast.className = `app-toast app-toast--${safeType} active`;

  if (iconEl) {
    if (safeType === "success") {
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    } else if (safeType === "error") {
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    } else {
      iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
    }
  }

  toastTimer = setTimeout(() => {
    toast.classList.remove("active");
  }, duration || (action ? 5000 : 3500));
}
