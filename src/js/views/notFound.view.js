import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { pageEffect } from "/js/router.js";

class NotFoundView extends View {
  async render({ root }) {
    pageEffect(root, () => {
      render(
        html`<div id="not-found-view">
          ${headerTemplate({
            title: "Not found",
          })}
          <main>
            <h1>Page not found</h1>
            <a href="/">Go home</a>
          </main>
        </div>`,
        root,
      );
    });
  }
}

export default new NotFoundView();
