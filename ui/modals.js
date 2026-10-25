/**
 * ui/modals.js
 * Управление модальными окнами, жестами смахивания шторок (bottom-sheet) и диалогом подтверждения.
 */

/**
 * Открытие модального окна
 * @param {string} id
 * @param {Function} [onOpen]
 */
export function openModal(id, onOpen) {
  const modal = document.getElementById(id);
  if (modal) {
    const content = modal.querySelector(".modal-overlay__content");
    if (content) {
      content.style.transform = "";
      content.style.transition = "";
    }
    modal.style.backgroundColor = "";
    modal.classList.add("active");
    document.body.classList.add("modal-open");
    if (typeof onOpen === "function") {
      requestAnimationFrame(onOpen);
    }
  }
}

/**
 * Закрытие модального окна
 * @param {string} id
 */
export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    const content = modal.querySelector(".modal-overlay__content");
    if (content) {
      content.style.transform = "";
      content.style.transition = "";
    }
    modal.style.backgroundColor = "";
    modal.classList.remove("active");
  }
  const hasActiveModal = document.querySelector(".modal-overlay.active");
  if (!hasActiveModal) {
    document.body.classList.remove("modal-open");
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

    if (titleEl) titleEl.textContent = title;
    if (messageEl) messageEl.textContent = message;
    okBtn.textContent = confirmText;
    cancelBtn.textContent = cancelText;

    okBtn.className = `btn modal__dialog-btn ${type === "danger" ? "btn--danger" : "btn--primary"}`;

    if (iconEl) {
      if (type === "danger") {
        iconEl.className = "modal__dialog-icon modal__dialog-icon--danger";
        iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
      } else {
        iconEl.className = "modal__dialog-icon modal__dialog-icon--info";
        iconEl.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`;
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
        e.stopPropagation();
        cleanup();
        resolve(false);
      }
    };

    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    overlay.addEventListener("click", onOverlay);
    document.addEventListener("keydown", onKeyDown, true);

    overlay.classList.add("active");
    document.body.classList.add("modal-open");
    okBtn.focus();
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
  "scheduleModal",
  "analyticsModal",
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

        const scrollable = content.querySelector(".shift-list") || content;

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

        const scrollable = content.querySelector(".shift-list") || content;

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
      content.style.transition = "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)";
      overlay.style.backgroundColor = "";

      if (dy > 110) {
        // Смахиваем шторку вниз до конца и закрываем
        content.style.transform = "translateY(100%)";
        setTimeout(() => {
          closeModal(overlay.id);
          content.style.transform = "";
          content.style.transition = "";
        }, 200);
      } else {
        // Возвращаем шторку на место
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
