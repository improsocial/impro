import { View } from "/js/views/view.js";
import { html, render } from "/js/lib/lit-html.js";
import { pageEffect, bindToPage, bindPageTitle } from "/js/router.js";
import { headerTemplate } from "/js/templates/header.template.js";
import { auth } from "/js/auth.js";
import { Signal, ReactiveStore } from "/js/signals.js";
import "/js/components/plugin-custom-content.js";

class PluginPageView extends View {
  async render({ root, router, layout, params, context: { pluginService } }) {
    await auth.requireAuth();

    const { pluginId, pageId } = params;

    const state = new ReactiveStore("pluginPageView");
    state.$pluginDetails = new Signal.Computed(() => {
      const installed = pluginService.$installedPlugins
        .get()
        .find((plugin) => plugin.id === pluginId);
      return installed ?? null;
    });

    state.$page = new Signal.Computed(() =>
      pluginService.getPage(pluginId, pageId),
    );
    state.$loadStatus = new Signal.Computed(() =>
      pluginService.getPluginLoadStatus(pluginId),
    );

    bindToPage(root, layout, "active-nav-click", (event) => {
      event.preventDefault();
      router.go("/plugins/installed");
    });

    bindPageTitle(root, () => {
      const page = state.$page.get();
      if (page?.title) return page.title;
      return state.$pluginDetails.get()?.name ?? null;
    });

    pageEffect(root, () => {
      const pluginDetails = state.$pluginDetails.get();
      const page = state.$page.get();
      const { loading: pluginLoading, error: pluginLoadError } =
        state.$loadStatus.get();
      render(
        html`<div id="plugin-page-view">
          ${headerTemplate({
            title: page?.title ?? pluginDetails?.name ?? pluginId,
            backButtonFallbackRoute: "/plugins/installed",
          })}
          <main>
            ${(() => {
              if (!pluginDetails) {
                return html`<p
                  class="error-message"
                  data-testid="plugin-page-not-found"
                >
                  Plugin not found.
                </p>`;
              }
              if (!pluginDetails.enabled) {
                return html`<p
                  class="error-message"
                  data-testid="plugin-page-disabled"
                >
                  This plugin is not enabled.
                </p>`;
              }
              if (pluginLoadError) {
                return html`<p
                  class="error-message"
                  data-testid="plugin-page-load-failed"
                >
                  ${pluginLoadError.message ?? "This plugin failed to load."}
                </p>`;
              }
              if (!page) {
                if (pluginLoading) {
                  return html`<div class="plugins-loading-state">
                    <div class="loading-spinner"></div>
                  </div>`;
                }
                return html`<p
                  class="error-message"
                  data-testid="plugin-page-unknown"
                >
                  Page not found.
                </p>`;
              }
              return html`<div class="plugin-content plugin-content-page">
                <plugin-custom-content
                  .pluginService=${pluginService}
                  .customContent=${page.customContent}
                ></plugin-custom-content>
              </div>`;
            })()}
          </main>
        </div>`,
        root,
      );
    });

    root.addEventListener("page-restore", () => {
      window.scrollTo(0, 0);
    });
  }
}

export default new PluginPageView();
