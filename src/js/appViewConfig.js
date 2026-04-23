import { AppViewConfig, DEFAULT_APP_VIEW_CONFIGS } from "/js/config.js";

const STORAGE_KEY = "appview-config";
const RESET_QUERY_PARAM = "reset-appview";

export const CUSTOM_APP_VIEW_CONFIG_ID = "custom";

function isKnownId(id) {
  if (id === CUSTOM_APP_VIEW_CONFIG_ID) return true;
  return DEFAULT_APP_VIEW_CONFIGS.some((config) => config.id === id);
}

export function isValidAppViewConfig(config) {
  return (
    config &&
    typeof config === "object" &&
    typeof config.id === "string" &&
    isKnownId(config.id) &&
    typeof config.appViewServiceDid === "string" &&
    config.appViewServiceDid.length > 0 &&
    typeof config.chatServiceDid === "string" &&
    config.chatServiceDid.length > 0
  );
}

function defaultConfig() {
  const { id, appViewServiceDid, chatServiceDid } = AppViewConfig.BLUESKY;
  return { id, appViewServiceDid, chatServiceDid };
}

export function getAppViewConfig() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (isValidAppViewConfig(parsed)) {
        return {
          id: parsed.id,
          appViewServiceDid: parsed.appViewServiceDid,
          chatServiceDid: parsed.chatServiceDid,
        };
      }
    } catch {
      // fall through to default
    }
  }
  return defaultConfig();
}

export function setAppViewConfig(config) {
  if (!isValidAppViewConfig(config)) {
    throw new Error("Invalid app view config");
  }
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      id: config.id,
      appViewServiceDid: config.appViewServiceDid,
      chatServiceDid: config.chatServiceDid,
    }),
  );
}

export function resetAppViewConfig() {
  localStorage.removeItem(STORAGE_KEY);
}

export function handleAppViewResetQueryParam() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(RESET_QUERY_PARAM)) {
    return false;
  }
  resetAppViewConfig();
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.delete(RESET_QUERY_PARAM);
  window.history.replaceState({}, "", newUrl.toString());
  return true;
}
