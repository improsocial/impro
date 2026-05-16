import { html, render } from "/js/lib/lit-html.js";
import { alertIconTemplate } from "/js/templates/icons/alertIcon.template.js";
import { circleCheckIconTemplate } from "/js/templates/icons/circleCheckIcon.template.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";
import { wait, raf } from "/js/utils.js";

const TOAST_GAP_PX = 8;
const activeToasts = [];

const STYLE_ICONS = {
  default: circleCheckIconTemplate,
  success: circleCheckIconTemplate,
  error: alertIconTemplate,
  warning: alertIconTemplate,
  info: infoIconTemplate,
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
    setTimeout(() => toast.remove(), 1000);
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
    if (timeout) {
      timeoutId = setTimeout(dismiss, timeout);
    }
  }

  show();

  return { dismiss, element: toast };
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
  const toast = pluginRenderer.renderNode(element, pluginId);
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
