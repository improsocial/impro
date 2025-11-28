export class EventEmitter {
  constructor() {
    this.__eventListeners = new Map();
  }

  on(event, listener) {
    const listeners = this.__eventListeners.get(event) || [];
    listeners.push(listener);
    this.__eventListeners.set(event, listeners);
  }

  emit(event, data) {
    const listeners = this.__eventListeners.get(event) || [];
    listeners.forEach((listener) => listener(data));
  }

  off(event, listener) {
    const listeners = this.__eventListeners.get(event) || [];
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
    if (listeners.length === 0) {
      this.__eventListeners.delete(event);
    } else {
      this.__eventListeners.set(event, listeners);
    }
  }

  removeAllListeners(event) {
    if (event) {
      this.__eventListeners.delete(event);
    } else {
      this.__eventListeners.clear();
    }
  }
}
