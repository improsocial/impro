import { html, render } from "/js/lib/lit-html.js";
import { alertIconTemplate } from "/js/templates/icons/alertIcon.template.js";
import { infoIconTemplate } from "/js/templates/icons/infoIcon.template.js";
import { wait, raf } from "/js/utils.js";

export async function showToast(
  message,
  { error = false, timeout = 3000 } = {}
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
    toast
  );
  document.body.appendChild(toast);
  await raf();
  await raf();
  toast.showPopover(); // this puts the element in the top layer, so it will be displayed above dialogs
  toast.classList.add("active");
  if (timeout) {
    await wait(timeout);
    toast.classList.remove("active");
    toast.hidePopover();
    await wait(1000);
    toast.remove();
  }
  // todo - toast can be dismissed by the user
}
