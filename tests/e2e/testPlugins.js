// Test plugin fixtures

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginWorkerPath = path.resolve(
  __dirname,
  "..",
  "..",
  "impro-plugin",
  "main.js",
);

const TEST_PLUGIN_BASE_ID = "test-plugin";
export const TEST_PLUGIN_ID = `${TEST_PLUGIN_BASE_ID}__LOCAL`;
export const TEST_PLUGIN_NAME = "Test Plugin";

export const TEST_PLUGIN_DEFAULTS = {
  greeting: "Hi",
  loud: false,
  theme: "light",
};

// Manifest as served by the local plugin endpoint — matches the on-disk
// format, where the id has no __LOCAL suffix (the runtime appends it).
export const TEST_PLUGIN_RAW_MANIFEST = {
  id: TEST_PLUGIN_BASE_ID,
  name: TEST_PLUGIN_NAME,
  version: "1.0.0",
  author: "Test Author",
  description: "A test fixture plugin",
};

// Manifest as it appears in installed-plugin preferences and at runtime.
export const TEST_PLUGIN_MANIFEST = {
  ...TEST_PLUGIN_RAW_MANIFEST,
  id: TEST_PLUGIN_ID,
};

const TEST_PLUGIN_BODY = /* js */ `
const DEFAULTS = ${JSON.stringify(TEST_PLUGIN_DEFAULTS)};

class TestSettingTab extends PluginSettingTab {
  constructor() {
    super();
    this.setName(${JSON.stringify(TEST_PLUGIN_NAME)});
  }

  display() {
    new Setting(this.containerEl)
      .setName("Greeting")
      .setDesc("Text shown to the user")
      .addText((text) =>
        text
          .setPlaceholder("Hi")
          .setValue(this.plugin.settings.greeting)
          .onChange(async (value) => {
            this.plugin.settings.greeting = value;
            await this.plugin.saveData(this.plugin.settings);
          }),
      );

    new Setting(this.containerEl)
      .setName("Loud mode")
      .setDesc("Whether to be loud")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.loud)
          .onChange(async (value) => {
            this.plugin.settings.loud = value;
            await this.plugin.saveData(this.plugin.settings);
          }),
      );

    new Setting(this.containerEl)
      .setName("Theme")
      .setDesc("Preferred theme")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ light: "Light", dark: "Dark", auto: "Auto" })
          .setValue(this.plugin.settings.theme)
          .onChange(async (value) => {
            this.plugin.settings.theme = value;
            await this.plugin.saveData(this.plugin.settings);
          }),
      );

    new Setting(this.containerEl)
      .setName("Reset settings")
      .setDesc("Restore defaults")
      .addButton((button) =>
        button.setButtonText("Reset").onClick(async () => {
          this.plugin.settings = { ...DEFAULTS };
          await this.plugin.saveData(this.plugin.settings);
          this.refresh({ reset: true });
        }),
      );
  }
}

class TestPlugin extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.settings = { ...DEFAULTS, ...(saved ?? {}) };
    this.addSettingTab(new TestSettingTab());
  }
}

TestPlugin.register();
`;

// Message a plugin throws from display(); exported so the error-path test can
// assert the surfaced copy without duplicating the string.
export const TAB_LOAD_ERROR_MESSAGE = "Settings failed to load";

// A plugin whose setting tab throws while rendering, to exercise the detail
// view's tab-load error path.
const THROWING_TAB_PLUGIN_BODY = /* js */ `
class ThrowingSettingTab extends PluginSettingTab {
  constructor() {
    super();
    this.setName(${JSON.stringify(TEST_PLUGIN_NAME)});
  }

  display() {
    throw new Error(${JSON.stringify(TAB_LOAD_ERROR_MESSAGE)});
  }
}

class TestPlugin extends Plugin {
  async onload() {
    this.addSettingTab(new ThrowingSettingTab());
  }
}

TestPlugin.register();
`;

// Copy rendered by the page fixtures below; exported so specs can assert on
// content that genuinely comes from the plugin.
export const PAGE_TITLE = "Dashboard";
export const MODAL_TITLE = "List modal";
export const PAGE_LOAD_ERROR_MESSAGE = "Page failed to load";

// A plugin registering two pages at runtime, one of them built from data the
// manifest can't know. Its dashboard counts renders so a refresh is
// distinguishable from the first display, and can be refreshed from a button.
const PAGES_PLUGIN_BODY = /* js */ `
let renders = 0;

class TestPlugin extends Plugin {
  async onload() {
    this.registerPage({
      id: "dashboard",
      title: ${JSON.stringify(PAGE_TITLE)},
      display: () => {
        renders += 1;
        const el = new VirtualEl("div");
        el.createEl("h3", { text: ${JSON.stringify(PAGE_TITLE)} });
        el.createEl("p", { text: "Prose" }).setAttr(
          "data-testid",
          "plugin-page-prose",
        );
        el.createEl("ul", {}, (list) => {
          list.setAttr("data-testid", "plugin-page-list");
          list.createEl("li", { text: "One" });
          list.createEl("li", { text: "Two" });
        });
        el.createDiv({ text: String(renders) }).setAttr(
          "data-testid",
          "plugin-page-renders",
        );
        el.createEl("button", { text: "Refresh" })
          .setAttr("data-testid", "plugin-page-refresh")
          .onClick(() => this.refreshPage("dashboard"));
        return el;
      },
    });
    this.addSidebarItem("document-line", ${JSON.stringify(PAGE_TITLE)}, () => {
      this.openPage("dashboard");
    });
    this.addSidebarItem("document-line", ${JSON.stringify(MODAL_TITLE)}, () => {
      const ListModal = class extends Modal {
        onOpen() {
          this.titleEl.setText(${JSON.stringify(MODAL_TITLE)});
          this.contentEl.createEl("p", { text: "Prose" }).setAttr(
            "data-testid",
            "plugin-modal-prose",
          );
          this.contentEl.createEl("ul", {}, (list) => {
            list.setAttr("data-testid", "plugin-modal-list");
            list.createEl("li", { text: "One" });
          });
        }
      };
      new ListModal().open();
    });
    for (const name of ["alpha", "beta"]) {
      this.registerPage({
        id: "feed-" + name,
        title: "Feed " + name,
        display: () => {
          const el = new VirtualEl("div");
          el.setAttr("data-testid", "plugin-page-feed");
          el.setText(name);
          return el;
        },
      });
    }
  }
}

TestPlugin.register();
`;

// A plugin whose page display() throws, to exercise the view's error path.
const THROWING_PAGE_PLUGIN_BODY = /* js */ `
class TestPlugin extends Plugin {
  async onload() {
    this.registerPage({
      id: "dashboard",
      title: ${JSON.stringify(PAGE_TITLE)},
      display: () => {
        throw new Error(${JSON.stringify(PAGE_LOAD_ERROR_MESSAGE)});
      },
    });
  }
}

TestPlugin.register();
`;

// A plugin whose onload rejects, so the host never gets a usable instance.
// The host reports its own message for this, not the plugin's.
export const PLUGIN_LOAD_FAILURE_MESSAGE =
  "Plugin failed during initialization";

const FAILING_PLUGIN_BODY = /* js */ `
class TestPlugin extends Plugin {
  async onload() {
    throw new Error("could not start");
  }
}

TestPlugin.register();
`;

// A plugin that loads but registers no setting tab.
const NO_SETTINGS_PLUGIN_BODY = /* js */ `
class TestPlugin extends Plugin {
  async onload() {}
}

TestPlugin.register();
`;

// Asks for a user-granted fetch origin as soon as it loads, so the host's
// permission prompt appears without needing plugin-rendered UI to trigger it.
export const REQUESTED_FETCH_ORIGIN = "https://api.example.com/*";

const FETCH_PERMISSION_PLUGIN_BODY = /* js */ `
class TestPlugin extends Plugin {
  async onload() {
    await requestFetchPermission("https://api.example.com/v1/chat");
  }
}

TestPlugin.register();
`;

// A plugin that seeds the composer with a signature string on every open
// (post and reply). Used by composer-init e2e tests.
const POST_COMPOSER_INIT_PLUGIN_BODY = /* js */ `
class TestPlugin extends Plugin {
  async onload() {
    this.app.on("post-composer-open", (composer, context) => {
      composer.appendText("\\n\\n— from test plugin (" + context.kind + ")");
      composer.setCursor(0);
    });
  }
}

TestPlugin.register();
`;

// A plugin that badges every rendered author with a cacheKey-declared slot.
// The badge text carries a global invocation counter, so tests can tell a
// shared cache hit (same number) from a fresh handler run (higher number).
// Its post context-menu item refreshes only the clicked post's author.
const BADGE_SLOT_PLUGIN_BODY = /* js */ `
let invocations = 0;

class TestPlugin extends Plugin {
  async onload() {
    this.registerSlot(
      "author-badges",
      (context) => {
        invocations += 1;
        const el = new VirtualEl("span");
        el.setAttr("data-testid", "plugin-badge");
        el.setText(context.did + " #" + invocations);
        return el;
      },
      { cacheKey: ["did"] },
    );
    this.app.on("post-context-menu", (menu, post) => {
      menu.addItem((item) =>
        item.setTitle("Refresh badge").onClick(() => {
          this.refreshSlot("author-badges", {
            keys: [{ did: post.author.did }],
          });
        }),
      );
    });
  }
}

TestPlugin.register();
`;

// The same badge plugin without a cacheKey: nothing is cached and nothing is
// shared, so a keyed refresh has only the per-context versions to target with.
const UNCACHED_BADGE_SLOT_PLUGIN_BODY = BADGE_SLOT_PLUGIN_BODY.replace(
  '      { cacheKey: ["did"] },\n',
  "",
);

let cachedWorkerSource = null;

function getWorkerSource() {
  if (!cachedWorkerSource) {
    cachedWorkerSource = fs
      .readFileSync(pluginWorkerPath, "utf-8")
      .replace(/^export /gm, "");
  }
  return cachedWorkerSource;
}

export function getTestPluginSource() {
  return getWorkerSource() + "\n" + TEST_PLUGIN_BODY;
}

export function getThrowingTabPluginSource() {
  return getWorkerSource() + "\n" + THROWING_TAB_PLUGIN_BODY;
}

export function getPagesPluginSource() {
  return getWorkerSource() + "\n" + PAGES_PLUGIN_BODY;
}

export function getThrowingPagePluginSource() {
  return getWorkerSource() + "\n" + THROWING_PAGE_PLUGIN_BODY;
}

export function getFailingPluginSource() {
  return getWorkerSource() + "\n" + FAILING_PLUGIN_BODY;
}

export function getNoSettingsPluginSource() {
  return getWorkerSource() + "\n" + NO_SETTINGS_PLUGIN_BODY;
}

export function getFetchPermissionPluginSource() {
  return getWorkerSource() + "\n" + FETCH_PERMISSION_PLUGIN_BODY;
}

export function getPostComposerInitPluginSource() {
  return getWorkerSource() + "\n" + POST_COMPOSER_INIT_PLUGIN_BODY;
}

export function getBadgeSlotPluginSource() {
  return getWorkerSource() + "\n" + BADGE_SLOT_PLUGIN_BODY;
}

export function getUncachedBadgeSlotPluginSource() {
  return getWorkerSource() + "\n" + UNCACHED_BADGE_SLOT_PLUGIN_BODY;
}
