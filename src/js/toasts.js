import { html, render } from "/js/lib/lit-html.js";
import { alertIconTemplate } from "/js/templates/icons/alertIcon.template.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";
import { wait, raf } from "/js/utils.js";

const TOAST_GAP_PX = 8;
const activeToasts = [];

function restackToasts() {
  let offset = 0;
  for (const entry of activeToasts) {
    entry.element.style.setProperty("--toast-stack-offset", `${offset}px`);
    offset += entry.height + TOAST_GAP_PX;
  }
}

export async function showToast(
  message,
  { error = false, timeout = 3000 } = {},
) {
  const toast = document.createElement("div");
  toast.setAttribute("popover", "manual");
  toast.classList.add("toast");
  if (error) {
    toast.classList.add("error");
  }
  render(
    html`
      <span class="toast-icon"
        >${error ? alertIconTemplate() : infoIconTemplate()}</span
      >
      ${message}
    `,
    toast,
  );
  document.body.appendChild(toast);
  await raf();
  await raf();
  toast.showPopover(); // this puts the element in the top layer, so it will be displayed above dialogs

  const entry = { element: toast, height: toast.offsetHeight };
  activeToasts.unshift(entry);
  restackToasts();

  toast.classList.add("active");
  if (timeout) {
    await wait(timeout);
    toast.classList.remove("active");
    const index = activeToasts.indexOf(entry);
    if (index !== -1) {
      activeToasts.splice(index, 1);
      restackToasts();
    }
    toast.hidePopover();
    await wait(1000);
    toast.remove();
  }
  // todo - toast can be dismissed by the user
}
