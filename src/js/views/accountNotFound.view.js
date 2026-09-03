import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { pageEffect, bindPageTitle } from "/js/router.js";

export default async function accountNotFoundView({ root, params, router }) {
  bindPageTitle(root, () => "Not Found");

  pageEffect(root, () => {
    const canGoBack = router.previousRoute !== null;
    render(
      html`<div id="account-not-found-view">
        ${headerTemplate({
          title: "Not found",
        })}
        <main>
          <div class="error-state" data-testid="account-not-found">
            <h3>Account not found</h3>
            <div>@${params.handleOrDid} couldn't be found</div>
            ${canGoBack
              ? html`<button
                  class="rounded-button rounded-button-secondary-inverted"
                  data-testid="go-back-button"
                  @click=${() => router.back()}
                >
                  Go back
                </button>`
              : html`<a
                  href="/"
                  class="rounded-button rounded-button-secondary-inverted"
                  data-testid="go-home-link"
                  >Go home</a
                >`}
          </div>
        </main>
      </div>`,
      root,
    );
  });
}
