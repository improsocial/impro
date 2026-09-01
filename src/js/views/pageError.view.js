import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { tryAgainButtonTemplate } from "/js/templates/tryAgainButton.template.js";
import { pageEffect, bindPageTitle } from "/js/router.js";

export default async function pageErrorView({ root }) {
  bindPageTitle(root, () => "Error");

  pageEffect(root, () => {
    render(
      html`<div id="page-error-view">
        ${headerTemplate({
          title: "Error",
        })}
        <main>
          <div class="error-state" data-testid="page-error">
            <div>Something went wrong.</div>
            ${tryAgainButtonTemplate()}
          </div>
        </main>
      </div>`,
      root,
    );
  });
}
