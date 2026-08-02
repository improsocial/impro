// Observes drag-and-drop events on a target, ignores non-file events
export class DragAndDropObserver {
  constructor(rootEl, { onDragStart, onDragEnd, onDrop } = {}) {
    if (!rootEl) throw new Error("DragAndDropObserver requires rootEl");
    this.rootEl = rootEl;
    this.onDragStart = onDragStart;
    this.onDragEnd = onDragEnd;
    this.onDrop = onDrop;
    this._counter = 0;
    this._active = false;

    this._onDragEnter = this._onDragEnter.bind(this);
    this._onDragOver = this._onDragOver.bind(this);
    this._onDragLeave = this._onDragLeave.bind(this);
    this._onDrop = this._onDrop.bind(this);
    this._onDragEnd = this._onDragEnd.bind(this);
    rootEl.addEventListener("dragenter", this._onDragEnter);
    rootEl.addEventListener("dragover", this._onDragOver);
    rootEl.addEventListener("dragleave", this._onDragLeave);
    rootEl.addEventListener("drop", this._onDrop);
    rootEl.addEventListener("dragend", this._onDragEnd);
  }

  disconnect() {
    this.rootEl.removeEventListener("dragenter", this._onDragEnter);
    this.rootEl.removeEventListener("dragover", this._onDragOver);
    this.rootEl.removeEventListener("dragleave", this._onDragLeave);
    this.rootEl.removeEventListener("drop", this._onDrop);
    this.rootEl.removeEventListener("dragend", this._onDragEnd);
    this._reset();
  }

  _hasFiles(event) {
    const types = event.dataTransfer?.types;
    if (!types) return false;
    return Array.from(types).includes("Files");
  }

  _onDragEnter(event) {
    if (!this._hasFiles(event)) return;
    this._counter += 1;
    if (!this._active) {
      this._active = true;
      this.onDragStart?.();
    }
  }

  _onDragOver(event) {
    if (!this._hasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
  }

  _onDragLeave(event) {
    if (event.relatedTarget === null) {
      this._reset();
      return;
    }
    if (!this._hasFiles(event)) return;
    this._counter = Math.max(0, this._counter - 1);
    if (this._counter === 0 && this._active) {
      this._active = false;
      this.onDragEnd?.();
    }
  }

  _onDragEnd() {
    this._reset();
  }

  _onDrop(event) {
    const files = Array.from(event.dataTransfer?.files ?? []);
    this._reset();
    if (files.length === 0) return;
    event.preventDefault();
    this.onDrop?.(files, event);
  }

  _reset() {
    this._counter = 0;
    if (this._active) {
      this._active = false;
      this.onDragEnd?.();
    }
  }
}
