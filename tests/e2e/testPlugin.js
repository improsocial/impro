// Test plugin fixture

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

// A plugin that loads but registers no setting tab.
const NO_SETTINGS_PLUGIN_BODY = /* js */ `
class TestPlugin extends Plugin {
  async onload() {}
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

export function getNoSettingsPluginSource() {
  return getWorkerSource() + "\n" + NO_SETTINGS_PLUGIN_BODY;
}

export function getPostComposerInitPluginSource() {
  return getWorkerSource() + "\n" + POST_COMPOSER_INIT_PLUGIN_BODY;
}
