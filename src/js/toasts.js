import { html, render } from "/js/lib/lit-html.js";
import { enableDragToDismiss } from "/js/dragHelpers.js";
import { wait, raf } from "/js/utils.js";
import "/js/components/app-icon.js";

const TOAST_GAP_PX = 8;
const activeToasts = [];
const mountedToasts = new Set();

const STYLE_ICONS = {
  default: () => html`<app-icon icon="circle-check"></app-icon>`,
  success: () => html`<app-icon icon="circle-check"></app-icon>`,
  error: () => html`<app-icon icon="alert-circle-line"></app-icon>`,
  warning: () => html`<app-icon icon="alert-circle-line"></app-icon>`,
  info: () => html`<app-icon icon="info-circle-line"></app-icon>`,
};

function restackToasts() {
  let offset = 0;
  for (const entry of activeToasts) {
    entry.element.style.setProperty("--toast-stack-offset", `${offset}px`);
    offset += entry.height + TOAST_GAP_PX;
  }
}

function mountToast(toast, { timeout = 3000, onDismiss = () => {} } = {}) {
  toast.setAttribute("popover", "manual");
  document.body.appendChild(toast);

  let entry = null;
  let shown = false;
  let dismissed = false;
  let timeoutId = null;
  let removeTimeoutId = null;

  function remove() {
    if (removeTimeoutId != null) clearTimeout(removeTimeoutId);
    removeTimeoutId = null;
    mountedToasts.delete(handle);
    toast.remove();
  }

  function dismiss() {
    if (dismissed) return;
    dismissed = true;
    if (timeoutId != null) clearTimeout(timeoutId);
    toast.classList.remove("active");
    if (entry) {
      const index = activeToasts.indexOf(entry);
      if (index !== -1) {
        activeToasts.splice(index, 1);
        restackToasts();
      }
    }
    if (shown) toast.hidePopover();
    removeTimeoutId = setTimeout(remove, 1000);
    onDismiss();
  }

  async function show() {
    await raf();
    await raf();
    if (dismissed) {
      toast.remove();
      return;
    }
    toast.showPopover(); // this puts the element in the top layer, so it will be displayed above dialogs
    shown = true;
    entry = { element: toast, height: toast.offsetHeight };
    activeToasts.unshift(entry);
    restackToasts();
    toast.classList.add("active");
    let remainingMs = timeout;
    let scheduledAt = null;
    const scheduleAutoDismiss = () => {
      if (remainingMs > 0) {
        scheduledAt = performance.now();
        timeoutId = setTimeout(dismiss, remainingMs);
      }
    };
    const pauseAutoDismiss = () => {
      if (timeoutId != null) {
        remainingMs = Math.max(
          0,
          remainingMs - (performance.now() - scheduledAt),
        );
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };
    enableDragToDismiss(toast, {
      direction: "up",
      allowOppositeTranslate: true,
      dismissThresholdPx: 25,
      flickVelocity: 0.2,
      onDismiss: dismiss,
      onDragStart: pauseAutoDismiss,
      onDragEnd: ({ dismissed }) => {
        if (!dismissed) scheduleAutoDismiss();
      },
    });
    scheduleAutoDismiss();
  }

  show();

  const handle = { dismiss, remove, element: toast };
  mountedToasts.add(handle);
  return handle;
}

export function cleanupToasts() {
  for (const handle of [...mountedToasts]) {
    handle.dismiss();
    handle.remove();
  }
}

export function showToast(
  message,
  { style = "default", timeout = 3000, iconTemplate } = {},
) {
  const toast = document.createElement("div");
  toast.classList.add("toast", style);
  toast.dataset.testid = "toast";
  const resolvedIconTemplate =
    iconTemplate ?? STYLE_ICONS[style] ?? STYLE_ICONS.default;
  render(
    html`
      <span class="toast-icon">${resolvedIconTemplate()}</span>
      ${message}
    `,
    toast,
  );
  return mountToast(toast, { timeout });
}

const pluginToasts = new Map();

export function showPluginToast({
  pluginRenderer,
  pluginId,
  toastId,
  element,
  timeout,
}) {
  const key = `${pluginId}:${toastId}`;
  if (pluginToasts.has(key)) return;
  const toast = pluginRenderer.createRoot().render(element);
  const handle = mountToast(toast, {
    timeout,
    onDismiss: () => pluginToasts.delete(key),
  });
  pluginToasts.set(key, handle);
}

export function hidePluginToast({ pluginId, toastId }) {
  const handle = pluginToasts.get(`${pluginId}:${toastId}`);
  if (handle) handle.dismiss();
}
