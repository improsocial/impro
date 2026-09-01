import { html } from "/js/lib/lit-html.js";
import { classnames } from "/js/utils.js";
import "/js/components/app-icon.js";

export function fillableIconTemplate({ icon, filled = false }) {
  return html`<app-icon
    class=${classnames("icon", { filled })}
    icon=${filled ? icon : `${icon}-line`}
  ></app-icon>`;
}
