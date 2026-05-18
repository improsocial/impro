// Test plugin fixture

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginWorkerPath = path.resolve(__dirname, "..", "..", "pluginWorker.js");

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
    this.onSettingsChange((data) => {
      this.settings = { ...DEFAULTS, ...(data ?? {}) };
    });
  }
}

TestPlugin.register();
`;

let cachedSource = null;

export function getTestPluginSource() {
  if (cachedSource) return cachedSource;
  const workerSource = fs
    .readFileSync(pluginWorkerPath, "utf-8")
    .replace(/^export /gm, "");
  cachedSource = workerSource + "\n" + TEST_PLUGIN_BODY;
  return cachedSource;
}
