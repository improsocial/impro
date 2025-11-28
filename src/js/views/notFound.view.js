import { View } from "./view.js";
import { html, render } from "/js/lib/lit-html.js";

class NotFoundView extends View {
  async render({ root, context: { dataStore } }) {
    async function renderPage() {
      render(
        html`<div id="not-found-view">
          <main>
            <h1>Not Found</h1>
            <a
              href="/"
              @click=${(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.router.go(`/`);
              }}
              >Go Home</a
            >
          </main>
        </div>`,
        root
      );
    }

    renderPage();
  }
}

export default new NotFoundView();
