/**
 * ui/toast.js
 * Всплывающие уведомления (тосты), тактильная отдача (вибрация) и строковые утилиты.
 */

let toastTimer = null;

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
