import { Signal, effect, untrack } from "/js/signals.js";

function readPersisted(storageKey) {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(storageKey));
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return {};
  }
  return parsed;
}

// A store whose `$signals` are backed by one JSON object in localStorage.
export class PersistedReactiveStore {
  #storageKey;
  #stored;
  #defaults = new Map();
  #signals = new Map();

  constructor(storageKey) {
    this.#storageKey = storageKey;
    this.#stored = readPersisted(storageKey);
    return new Proxy(this, {
      set(target, prop, value) {
        if (prop.startsWith("$")) {
          target.#register(prop, value);
        } else {
          target[prop] = value;
        }
        return true;
      },
    });
  }

  #register(prop, $signal) {
    $signal.__debugName = `${this.#storageKey}.${prop}`;
    const key = prop.slice(1);
    const defaultValue = untrack(() => $signal.get());
    this.#defaults.set(key, defaultValue);
    this.#signals.set(key, $signal);
    if (typeof this.#stored[key] === typeof defaultValue) {
      $signal.set(this.#stored[key]);
    }
    // `this` is the target rather than the proxy, so this won't re-enter the trap
    this[prop] = $signal;
    // effect() runs on creation; skip that so declaring a signal doesn't
    // immediately write its default back to storage
    let isFirstRun = true;
    effect(() => {
      $signal.get();
      if (isFirstRun) {
        isFirstRun = false;
        return;
      }
      this.#save();
    });
  }

  // untracked so one signal's save effect doesn't subscribe to all the others
  #save() {
    const data = { ...this.#stored };
    untrack(() => {
      for (const [key, $signal] of this.#signals) {
        const value = $signal.get();
        if (value === this.#defaults.get(key)) {
          delete data[key];
        } else {
          data[key] = value;
        }
      }
    });
    this.#stored = data;
    if (Object.keys(data).length === 0) {
      localStorage.removeItem(this.#storageKey);
    } else {
      localStorage.setItem(this.#storageKey, JSON.stringify(data));
    }
  }
}

const displayPreferences = new PersistedReactiveStore("display-preferences");

displayPreferences.$trendingHidden = new Signal.State(false);

export { displayPreferences };
