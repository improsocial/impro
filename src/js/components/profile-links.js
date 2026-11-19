import { html, render, repeat } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { HoverObserver } from "/js/hoverObserver.js";
import { getProfileLinkLabel } from "/js/dataHelpers.js";
import { profileLinkIconTemplate } from "/js/templates/profileLinkIcon.template.js";
import "/js/components/app-icon.js";
import "/js/components/floating-card.js";

const TOOLTIP_DELAY_MS = 200;

function splitDestination(url) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname.replace(/^www\./, ""),
      rest: parsed.pathname.replace(/\/$/, "") + parsed.search,
    };
  } catch {
    return { host: url, rest: "" };
  }
}

function linkDestinationTemplate({ url }) {
  const { host, rest } = splitDestination(url);
  return html`<div
    class="profile-link-destination"
    data-testid="profile-link-destination"
  >
    <strong>${host}</strong>${rest}
  </div>`;
}

function linkPillTemplate({ link }) {
  return html`<a
    class="profile-link-pill"
    href=${link.url}
    target="_blank"
    rel="me noopener noreferrer"
    data-testid="profile-link"
  >
    ${profileLinkIconTemplate({ iconUrl: link.iconUrl })}
    <span class="profile-link-label">${getProfileLinkLabel(link)}</span>
    <app-icon class="profile-link-arrow" icon="open-line"></app-icon>
  </a>`;
}

class ProfileLinks extends Component {
  #links = [];
  #hoverObserver = null;
  #floatingCard = null;
  #tooltipTimer = null;

  connectedCallback() {
    if (!this._initialized) {
      this._initialized = true;
      this.#floatingCard = document.createElement("floating-card");
      this.#floatingCard.style.width = "max-content";
      this.#floatingCard.setAttribute("data-testid", "profile-link-tooltip");
      this.render();
    }
    this.#hoverObserver = new HoverObserver(this, {
      selector: ".profile-link-pill",
      onEnter: (pill) => this.#scheduleTooltip(pill),
      onLeave: () => this.#hideTooltip(),
    });
    this.addEventListener("focusin", this.#handleFocusIn);
    this.addEventListener("focusout", this.#handleFocusOut);
    window.addEventListener("page-transition", this.#handlePageTransition);
  }

  disconnectedCallback() {
    this.#hoverObserver?.disconnect();
    this.#hoverObserver = null;
    this.removeEventListener("focusin", this.#handleFocusIn);
    this.removeEventListener("focusout", this.#handleFocusOut);
    window.removeEventListener("page-transition", this.#handlePageTransition);
    this.#hideTooltip();
  }

  set links(value) {
    this.#links = value;
    if (this._initialized) this.render();
  }

  get links() {
    return this.#links;
  }

  #handleFocusIn = (event) => {
    const pill = event.target.closest?.(".profile-link-pill");
    if (pill?.matches(":focus-visible")) this.#scheduleTooltip(pill);
  };

  #handleFocusOut = () => this.#hideTooltip();

  #handlePageTransition = () => this.#hideTooltip();

  #scheduleTooltip(pill) {
    clearTimeout(this.#tooltipTimer);
    this.#tooltipTimer = setTimeout(() => {
      render(
        html`<div class="profile-link-tooltip">
          ${linkDestinationTemplate({ url: pill.href })}
        </div>`,
        this.#floatingCard,
      );
      this.#floatingCard.open(pill.getBoundingClientRect());
    }, TOOLTIP_DELAY_MS);
  }

  #hideTooltip() {
    clearTimeout(this.#tooltipTimer);
    this.#tooltipTimer = null;
    this.#floatingCard?.close();
  }

  render() {
    render(
      html`<div class="profile-links-row">
          ${repeat(
            this.#links,
            (link) => `${link.url} ${link.iconUrl}`,
            (link) => linkPillTemplate({ link }),
          )}
        </div>
        ${this.#floatingCard}`,
      this,
    );
  }
}

ProfileLinks.register();
