// Test plugin fixture

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginWorkerPath = path.resolve(__dirname, "..", "..", "pluginWorker.js");

export const TEST_PLUGIN_ID = "test-plugin";
export const TEST_PLUGIN_NAME = "Test Plugin";

export const TEST_PLUGIN_DEFAULTS = {
  greeting: "Hi",
  loud: false,
  theme: "light",
};

export const TEST_PLUGIN_MANIFEST = {
  id: TEST_PLUGIN_ID,
  name: TEST_PLUGIN_NAME,
  version: "1.0.0",
  description: "A test fixture plugin",
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
