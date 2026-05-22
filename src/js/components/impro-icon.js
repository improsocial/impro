import { Component } from "/js/components/component.js";

const DEFAULT_SET = "majesticons";

const cache = new Map();

function fetchIcon(set, name) {
  const key = `${set}/${name}`;
  if (cache.has(key)) {
    return cache.get(key);
  }
  const url = `/img/icons/${set}/${name}.svg`;
  const promise =
    typeof globalThis.fetch === "function"
      ? globalThis.fetch(url).then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load icon "${key}": ${response.status}`);
          }
          return response.text();
        })
      : Promise.reject(new Error("fetch-unavailable"));
  promise.catch(() => {});
  cache.set(key, promise);
  return promise;
}

class ImproIcon extends Component {
  static observedAttributes = ["name", "set"];

  attributeChangedCallback() {
    this.render();
  }

  async render() {
    const name = this.getAttribute("name");
    const set = this.getAttribute("set") || DEFAULT_SET;
    if (!name) {
      this.innerHTML = "";
      return;
    }
    try {
      const svg = await fetchIcon(set, name);
      if (
        this.getAttribute("name") !== name ||
        (this.getAttribute("set") || DEFAULT_SET) !== set
      ) {
        return;
      }
      this.innerHTML = svg;
    } catch (error) {
      if (
        this.getAttribute("name") !== name ||
        (this.getAttribute("set") || DEFAULT_SET) !== set
      ) {
        return;
      }
      if (error.message !== "fetch-unavailable") {
        console.warn(error.message);
      }
      this.innerHTML = "";
    }
  }
}

ImproIcon.register();
