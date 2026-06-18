/**
 * @module accessibility
 * @description Accessibility (a11y) utilities:
 *  - Focus management for SPA navigation
 *  - ARIA live region announcements
 *  - Skip-link activation
 *  - Keyboard trap for modals
 *  - Reduced-motion preference detection
 */

// ─────────────────────────────────────────────────────────────────────────────
// Motion preference
// ─────────────────────────────────────────────────────────────────────────────

export const prefersReducedMotion =
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─────────────────────────────────────────────────────────────────────────────
// ARIA live region
// ─────────────────────────────────────────────────────────────────────────────

let _liveRegion = null;

/**
 * Creates (or reuses) an ARIA live region and announces a message to screen readers.
 * @param {string} message
 * @param {'polite'|'assertive'} [politeness='polite']
 */
export function announce(message, politeness = 'polite') {
  if (!_liveRegion) {
    _liveRegion = document.createElement('div');
    _liveRegion.setAttribute('role', 'status');
    _liveRegion.setAttribute('aria-live', politeness);
    _liveRegion.setAttribute('aria-atomic', 'true');
    Object.assign(_liveRegion.style, {
      position: 'absolute',
      width:    '1px',
      height:   '1px',
      padding:  '0',
      overflow: 'hidden',
      clip:     'rect(0,0,0,0)',
      whiteSpace: 'nowrap',
      border:   '0',
    });
    document.body.appendChild(_liveRegion);
  }
  // Clear then re-set to force re-announcement
  _liveRegion.setAttribute('aria-live', politeness);
  _liveRegion.textContent = '';
  requestAnimationFrame(() => { _liveRegion.textContent = message; });
}

// ─────────────────────────────────────────────────────────────────────────────
// Focus management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Moves focus to the first focusable element inside a container,
 * or to the container itself if it has tabIndex.
 * @param {HTMLElement} container
 */
export function focusFirst(container) {
  if (!container) return;
  const focusable = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const target = focusable[0] ?? container;
  if (target) {
    target.focus({ preventScroll: false });
  }
}

/**
 * Restores focus to a previously saved element.
 * @param {HTMLElement|null} el
 */
export function restoreFocus(el) {
  if (el && typeof el.focus === 'function') el.focus();
}

// ─────────────────────────────────────────────────────────────────────────────
// Modal focus trap
// ─────────────────────────────────────────────────────────────────────────────

const FOCUSABLE_SELECTORS =
  'a[href], area[href], input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Installs a focus trap inside a modal element.
 * Returns a cleanup function that removes the trap.
 * @param {HTMLElement} modal
 * @returns {() => void} cleanup
 */
export function trapFocus(modal) {
  const handler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = [...modal.querySelectorAll(FOCUSABLE_SELECTORS)];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  modal.addEventListener('keydown', handler);
  return () => modal.removeEventListener('keydown', handler);
}

// ─────────────────────────────────────────────────────────────────────────────
// Skip link
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Initialises the skip-to-main-content link behaviour.
 */
export function initSkipLink() {
  const skip = document.getElementById('skip-link');
  if (!skip) return;
  skip.addEventListener('click', (e) => {
    e.preventDefault();
    const main = document.getElementById('main-content');
    if (main) {
      main.setAttribute('tabindex', '-1');
      main.focus();
      main.addEventListener('blur', () => main.removeAttribute('tabindex'), { once: true });
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Keyboard shortcut registration
// ─────────────────────────────────────────────────────────────────────────────

const _shortcuts = new Map();

/**
 * Registers a global keyboard shortcut.
 * @param {string} key - e.g. 'l' for Alt+L
 * @param {Function} handler
 */
export function registerShortcut(key, handler) {
  _shortcuts.set(key.toLowerCase(), handler);
}

export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Alt + key shortcuts (avoids conflicts with browser shortcuts)
    if (e.altKey && !e.ctrlKey && !e.metaKey) {
      const fn = _shortcuts.get(e.key.toLowerCase());
      if (fn) { e.preventDefault(); fn(); }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Color contrast check (runtime)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calculates relative luminance of an RGB color.
 */
function relativeLuminance(r, g, b) {
  const toLinear = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Returns the WCAG contrast ratio between two hex colours.
 * @param {string} hex1 - e.g. '#ffffff'
 * @param {string} hex2 - e.g. '#000000'
 * @returns {number} contrast ratio
 */
export function contrastRatio(hex1, hex2) {
  const parse = (h) => {
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    return relativeLuminance(r, g, b);
  };
  const l1 = parse(hex1);
  const l2 = parse(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─────────────────────────────────────────────────────────────────────────────
// Toast notification (accessible)
// ─────────────────────────────────────────────────────────────────────────────

let _toastContainer = null;

function getToastContainer() {
  if (!_toastContainer) {
    _toastContainer = document.getElementById('toast-container');
  }
  return _toastContainer;
}

/**
 * Shows an accessible toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'|'warning'} [type='info']
 * @param {number} [duration=4000] ms
 */
export function showToast(message, type = 'info', duration = 4000) {
  const container = getToastContainer();
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'assertive');
  toast.setAttribute('aria-atomic', 'true');

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span aria-hidden="true">${icons[type] ?? ''}</span> ${message}`;

  container.appendChild(toast);
  announce(message, type === 'error' ? 'assertive' : 'polite');

  // Animate in
  requestAnimationFrame(() => toast.classList.add('toast--visible'));

  const remove = () => {
    toast.classList.remove('toast--visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
  };

  const timer = setTimeout(remove, duration);
  toast.addEventListener('click', () => { clearTimeout(timer); remove(); });
}
