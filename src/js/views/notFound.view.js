import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { pageEffect, bindPageTitle } from "/js/router.js";

export default async function notFoundView({ root }) {
  bindPageTitle(root, () => "Not Found");

  pageEffect(root, () => {
    render(
      html`<div id="not-found-view">
        ${headerTemplate({
          title: "Not found",
        })}
        <main>
          <div class="error-state" data-testid="page-not-found">
            <h3>Page not found</h3>
            <div>We can't find the page you were looking for.</div>
            <a
              href="/"
              class="rounded-button rounded-button-secondary-inverted"
              data-testid="go-home-link"
              >Go home</a
            >
          </div>
        </main>
      </div>`,
      root,
    );
  });
}
