import { html } from "/js/lib/lit-html.js";

const VARIANTS = [
  { name: "30%", handle: "22%", lines: ["100%", "85%", "40%"] },
  { name: "22%", handle: "34%", lines: ["60%"] },
  { name: "38%", handle: "20%", lines: ["95%", "50%"], image: "3 / 2" },
  { name: "26%", handle: "28%", lines: ["100%", "100%", "100%", "30%"] },
  { name: "34%", handle: "24%", lines: ["80%", "65%"] },
];

function skeletonTextTemplate({ width, blend }) {
  return html`<div class="skeleton-text" style="max-width: ${width}">
    <div
      class="skeleton-text-bar skeleton-animate ${blend
        ? "skeleton-blend"
        : ""}"
    ></div>
  </div>`;
}

function skeletonControlTemplate({ shape }) {
  return html`<div class="post-action">
    <div class="post-action-button">
      <div
        class="skeleton-control-${shape} skeleton-animate skeleton-blend"
      ></div>
    </div>
  </div>`;
}

export function postSkeletonTemplate({ index }) {
  const { name, handle, lines, image } = VARIANTS[index % VARIANTS.length];
  return html`<div class="post-skeleton" data-testid="post-skeleton">
    <div class="post-content-left">
      <div class="skeleton-avatar skeleton-animate"></div>
    </div>
    <div class="post-content-right">
      <div class="skeleton-header">
        ${skeletonTextTemplate({ width: name, blend: false })}
        ${skeletonTextTemplate({ width: handle, blend: true })}
      </div>
      <div class="skeleton-body">
        ${lines.map((width) => skeletonTextTemplate({ width, blend: true }))}
      </div>
      ${image
        ? html`<div
            class="skeleton-image skeleton-animate skeleton-blend"
            style="aspect-ratio: ${image}"
            data-testid="post-skeleton-image"
          ></div>`
        : null}
      <div class="post-actions">
        <div class="post-actions-primary">
          ${Array.from({ length: 3 }, () =>
            skeletonControlTemplate({ shape: "pill" }),
          )}
        </div>
        <div class="post-actions-secondary">
          ${Array.from({ length: 2 }, () =>
            skeletonControlTemplate({ shape: "circle" }),
          )}
        </div>
      </div>
    </div>
  </div>`;
}
