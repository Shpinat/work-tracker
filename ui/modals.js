/**
 * ui/modals.js
 * Управление модальными окнами (стек, focus-trap, Escape),
 * жестами смахивания шторок (bottom-sheet) и диалогом подтверждения.
 */

const modalOpeners = new Map();
const modalStack = [];
let isGlobalKeyHandlerBound = false;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function getFocusableElements(container) {
  if (!container) return [];
  const candidates = container.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  );
  return Array.from(candidates).filter((el) => {
    if (el.closest("[hidden]")) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return el.getClientRects().length > 0;
  });
}

function getFocusableElement(modal) {
  return getFocusableElements(modal)[0] || null;
}

function trapFocusInContainer(e, container) {
  if (e.key !== "Tab" || !container) return;
  const focusables = getFocusableElements(container);
  if (focusables.length === 0) {
    e.preventDefault();
    if (!container.hasAttribute("tabindex")) {
      container.setAttribute("tabindex", "-1");
    }
    container.focus();
    return;
  }

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;

  if (e.shiftKey) {
    if (active === first || !container.contains(active)) {
      e.preventDefault();
      last.focus();
    }
  } else if (active === last || !container.contains(active)) {
    e.preventDefault();
    first.focus();
  }
}

function getTopActiveModalId() {
  for (let i = modalStack.length - 1; i >= 0; i--) {
    const id = modalStack[i];
    const el = document.getElementById(id);
    if (el && el.classList.contains("active")) {
      return id;
    }
    modalStack.splice(i, 1);
  }
  return null;
}

function ensureGlobalKeyHandler() {
  if (isGlobalKeyHandlerBound || typeof document === "undefined") return;
  isGlobalKeyHandlerBound = true;

  document.addEventListener("keydown", (e) => {
    // Если открыт confirmModal — он сам перехватывает Escape и Tab в capture-фазе
    const confirmOverlay = document.getElementById("confirmModal");
    if (confirmOverlay && confirmOverlay.classList.contains("active")) return;

    const topId = getTopActiveModalId();
    if (!topId) return;

    const overlay = document.getElementById(topId);
    if (!overlay) return;

    if (e.key === "Escape") {
      e.preventDefault();
      e.stopImmediatePropagation();
      closeModal(topId);
      return;
    }

    if (e.key === "Tab") {
      const dialog = overlay.querySelector(".modal") || overlay;
      trapFocusInContainer(e, dialog);
    }
  });
}

/**
 * Открытие модального окна
 * @param {string} id
 * @param {Function} [onOpen]
 */
export function openModal(id, onOpen) {
  ensureGlobalKeyHandler();
  const modal = document.getElementById(id);
  if (!modal) return;

  const opener = document.activeElement;
  if (opener instanceof HTMLElement && !modal.contains(opener)) {
    modalOpeners.set(id, opener);
  }

  const existingIdx = modalStack.indexOf(id);
  if (existingIdx !== -1) {
    modalStack.splice(existingIdx, 1);
  }
  modalStack.push(id);

  const content = modal.querySelector(".modal-overlay__content");
  if (content) {
    content.style.transform = "";
    content.style.transition = "";
  }
  modal.style.backgroundColor = "";
  modal.classList.add("active");
  document.body.classList.add("modal-open");

  // Обновляем aria-expanded для связанных кнопок-триггеров
  if (id === "shiftsModal") {
    const openShiftsBtn = document.getElementById("openShiftsBtn");
    if (openShiftsBtn) {
      openShiftsBtn.setAttribute("aria-expanded", "true");
    }
  }

  requestAnimationFrame(() => {
    if (typeof onOpen === "function") {
      onOpen();
    }
    const target = getFocusableElement(modal);
    if (target) {
      target.focus();
    } else {
      const dialog = modal.querySelector(".modal") || modal;
      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      dialog.focus();
    }
  });
}

/**
 * Закрытие модального окна
 * @param {string} id
 */
export function closeModal(id) {
  const modal = document.getElementById(id);
  const idx = modalStack.indexOf(id);
  if (idx !== -1) {
    modalStack.splice(idx, 1);
  }

  const wasActive = Boolean(modal && modal.classList.contains("active"));
  if (modal) {
    const content = modal.querySelector(".modal-overlay__content");
    if (content) {
      content.style.transform = "";
      content.style.transition = "";
    }
    modal.style.backgroundColor = "";
    modal.classList.remove("active");

    // Обновляем aria-expanded для связанных кнопок-триггеров
    if (id === "shiftsModal") {
      const openShiftsBtn = document.getElementById("openShiftsBtn");
      if (openShiftsBtn) {
        openShiftsBtn.setAttribute("aria-expanded", "false");
      }
    }
  }

  const hasActiveModal = document.querySelector(".modal-overlay.active");
  if (!hasActiveModal) {
    document.body.classList.remove("modal-open");
  }

  const opener = modalOpeners.get(id);
  modalOpeners.delete(id);
  if (wasActive && opener?.isConnected) {
    opener.focus();
  }
}

/**
 * Кастомное диалоговое окно подтверждения (Promise-based)
 * @param {Object} options
 * @param {string} [options.title="Подтверждение"]
 * @param {string} [options.message="Вы уверены?"]
 * @param {string} [options.confirmText="Подтвердить"]
 * @param {string} [options.cancelText="Отмена"]
 * @param {"danger"|"primary"} [options.type="danger"]
 * @returns {Promise<boolean>}
 */
export function showConfirm({
  title = "Подтверждение",
  message = "Вы уверены?",
  confirmText = "Подтвердить",
  cancelText = "Отмена",
  type = "danger",
} = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");
    const iconEl = document.getElementById("confirmIcon");
    const okBtn = document.getElementById("confirmOkBtn");
    const cancelBtn = document.getElementById("confirmCancelBtn");

    if (!overlay || !okBtn || !cancelBtn) {
      return resolve(window.confirm(message));
    }

    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    okBtn.className = `btn modal__dialog-btn ${type === "danger" ? "btn--danger" : "btn--primary"}`;

    if (iconEl) {
      if (type === "danger") {
        iconEl.className = "modal__dialog-icon modal__dialog-icon--danger";
        iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
      } else {
        iconEl.className = "modal__dialog-icon modal__dialog-icon--info";
        iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
      }
    }

    const cleanup = () => {
      overlay.classList.remove("active");
      const hasOtherModal = document.querySelector(".modal-overlay.active:not(#confirmModal)");
      if (!hasOtherModal) {
        document.body.classList.remove("modal-open");
      }
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      overlay.removeEventListener("click", onOverlay);
      document.removeEventListener("keydown", onKeyDown, true);
      if (prevFocus?.isConnected) {
        prevFocus.focus();
      }
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onOverlay = (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(false);
      }
    };

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
        resolve(false);
        return;
      }
      if (e.key === "Tab") {
        const dialog = overlay.querySelector(".modal") || overlay;
        trapFocusInContainer(e, dialog);
      }
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKeyDown, true);

    overlay.classList.add("active");
    document.body.classList.add("modal-open");
    requestAnimationFrame(() => okBtn.focus());
  });
}

/**
 * Инициализация жеста смахивания вниз для закрытия шторки на мобильных (Swipe-to-dismiss)
 * @param {string[]} [modalIds]
 */
export function initBottomSheetSwipe(modalIds = [
  "shiftModal",
  "settingsModal",
  "shiftsModal",
]) {
  modalIds.forEach((id) => {
    const overlay = document.getElementById(id);
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

        const scrollable =
          content.querySelector(".shift-list") ||
          content.querySelector(".modal__body") ||
          content;

        // Разрешаем смахивание, если шторка прокручена к самому верху или тап по шапке/ручке
        if (scrollable.scrollTop <= 0 || isTopDrag) {
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

        const scrollable =
          content.querySelector(".shift-list") ||
          content.querySelector(".modal__body") ||
          content;

        // Если тянем вниз от верха шторки или за шапку — отменяем нативный жест (pull-to-refresh)
        if (dy > 0 && (scrollable.scrollTop <= 0 || isTopDrag)) {
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
      const reduced = prefersReducedMotion();
      content.style.transition = reduced
        ? "none"
        : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";
      overlay.style.backgroundColor = "";

      if (dy > 110) {
        if (reduced) {
          closeModal(overlay.id);
          content.style.transform = "";
          content.style.transition = "";
        } else {
          content.style.transform = "translateY(100%)";
          setTimeout(() => {
            closeModal(overlay.id);
            content.style.transform = "";
            content.style.transition = "";
          }, 200);
        }
      } else if (reduced) {
        content.style.transform = "";
        content.style.transition = "";
      } else {
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
