import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { getUnresolvedFacetsFromText } from "/js/facetHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { getIndexFromByteIndex } from "/js/utils.js";
import { TYPEAHEAD_SERVICE_URL } from "/js/config.js";

const FACET_HIGHLIGHT_NAMES = {
  "app.bsky.richtext.facet#mention": "facet-mention",
  "app.bsky.richtext.facet#link": "facet-link",
  "app.bsky.richtext.facet#tag": "facet-tag",
};

function getOrCreateHighlight(name) {
  let highlight = CSS.highlights.get(name);
  if (!highlight) {
    highlight = new Highlight();
    CSS.highlights.set(name, highlight);
  }
  return highlight;
}

function findNodeAtCharOffset(root, target) {
  let pos = 0;
  let result = null;

  function walk(node) {
    if (result) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const len = node.textContent.length;
      if (pos + len >= target) {
        result = { node, offset: target - pos };
        return;
      }
      pos += len;
      return;
    }

    if (node.nodeName === "BR") {
      if (pos + 1 > target) {
        result = { node: node.parentNode, offset: indexOfChild(node) };
        return;
      }
      pos += 1;
      return;
    }

    if (node.nodeName === "DIV" && node !== root) {
      for (const child of node.childNodes) {
        walk(child);
        if (result) return;
      }
      const lastChild = node.childNodes[node.childNodes.length - 1];
      if (!lastChild || lastChild.nodeName !== "BR") {
        if (pos + 1 > target) {
          result = { node, offset: node.childNodes.length };
          return;
        }
        pos += 1;
      }
      return;
    }

    for (const child of node.childNodes) {
      walk(child);
      if (result) return;
    }
  }

  walk(root);
  return result;
}

function indexOfChild(node) {
  let i = 0;
  let sibling = node;
  while ((sibling = sibling.previousSibling)) i++;
  return i;
}

function rangeForCharRange(root, start, end) {
  const startPos = findNodeAtCharOffset(root, start);
  const endPos = findNodeAtCharOffset(root, end);
  if (!startPos || !endPos) return null;
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(endPos.node, endPos.offset);
  return range;
}

function getCursorPosition(editableDiv) {
  const sel = window.getSelection();
  if (!sel.rangeCount) return 0;

  const range = sel.getRangeAt(0);
  const endContainer = range.endContainer;
  const endOffset = range.endOffset;

  let position = 0;
  let found = false;

  function walkNodes(node) {
    if (found) return;

    if (node === endContainer) {
      if (node.nodeType === Node.TEXT_NODE) {
        position += endOffset;
      } else {
        // Element node - count children up to endOffset
        for (let i = 0; i < endOffset && i < node.childNodes.length; i++) {
          countNodeChars(node.childNodes[i]);
        }
      }
      found = true;
      return;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      position += node.textContent.length;
    } else if (node.nodeName === "BR") {
      position += 1;
    } else if (node.nodeName === "DIV" && node !== editableDiv) {
      for (let child of node.childNodes) {
        walkNodes(child);
        if (found) return;
      }
      // Add 1 for the newline after the DIV, but only if it didn't end with BR
      // (BR already counted as newline, so don't double-count)
      if (!found) {
        const lastChild = node.childNodes[node.childNodes.length - 1];
        if (!lastChild || lastChild.nodeName !== "BR") {
          position += 1;
        }
      }
    } else {
      for (let child of node.childNodes) {
        walkNodes(child);
        if (found) return;
      }
    }
  }

  function countNodeChars(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      position += node.textContent.length;
    } else if (node.nodeName === "BR") {
      position += 1;
    } else if (node.nodeName === "DIV") {
      for (let child of node.childNodes) {
        countNodeChars(child);
      }
      // Only add newline if DIV didn't end with BR (which already counted)
      const lastChild = node.childNodes[node.childNodes.length - 1];
      if (!lastChild || lastChild.nodeName !== "BR") {
        position += 1;
      }
    } else {
      for (let child of node.childNodes) {
        countNodeChars(child);
      }
    }
  }

  walkNodes(editableDiv);
  return position;
}

function setCursorPosition(editableDiv, position) {
  const found = findNodeAtCharOffset(editableDiv, position);
  if (!found) return;
  const range = document.createRange();
  range.setStart(found.node, found.offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);
  editableDiv.focus();
}

function getContentEditableText(element) {
  if (
    element.childNodes.length === 1 &&
    element.childNodes[0].nodeName === "BR"
  ) {
    return "";
  }
  function extractText(node) {
    let text = "";
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    if (node.nodeName === "BR") {
      return "\n";
    }
    const blockElements = [
      "DIV",
      "P",
      "H1",
      "H2",
      "H3",
      "H4",
      "H5",
      "H6",
      "LI",
      "BLOCKQUOTE",
    ];
    const isBlock = blockElements.includes(node.nodeName);
    for (let child of node.childNodes) {
      text += extractText(child);
    }
    if (isBlock && node !== element && text && !text.endsWith("\n")) {
      text += "\n";
    }
    return text;
  }
  let result = extractText(element);
  if (result.endsWith("\n")) {
    result = result.slice(0, -1);
  }
  return result;
}

function mentionSuggestionsTemplate({
  mentionSuggestions,
  selectedSuggestionIndex,
  onSelect,
}) {
  return html`
    <div class="mention-typeahead" id="mention-typeahead">
      ${mentionSuggestions.map(
        (actor, index) => html`
          <div
            class="mention-suggestion ${index === selectedSuggestionIndex
              ? "selected"
              : ""}"
            @click=${() => onSelect(actor)}
          >
            ${avatarTemplate({
              author: actor,
              clickAction: "none",
            })}
            <div class="mention-suggestion-text">
              <div class="mention-suggestion-name">
                ${getDisplayName(actor)}
              </div>
              <div class="mention-suggestion-handle">@${actor.handle}</div>
            </div>
          </div>
        `,
      )}
    </div>
  `;
}

export class RichTextInput extends Component {
  connectedCallback() {
    if (this.initialized) {
      this.paintFacets();
      return;
    }
    this.placeholder = this.getAttribute("placeholder") || "";
    this.facets = [];
    this.text = "";
    this.mentionSuggestions = [];
    this.selectedSuggestionIndex = null;
    this.currentMentionQuery = null;
    this.currentMentionStart = null;
    this.currentMentionEnd = null;
    this.isComposing = false;
    this._facetHighlights = new Map();
    this.render();
    this.initialized = true;
  }

  disconnectedCallback() {
    this.clearHighlights();
  }

  clearHighlights() {
    if (!this._facetHighlights) return;
    for (const [name, ranges] of this._facetHighlights) {
      const highlight = CSS.highlights.get(name);
      if (!highlight) continue;
      for (const range of ranges) highlight.delete(range);
    }
    this._facetHighlights = new Map();
  }

  focus() {
    const input = this.querySelector(".rich-text-input");
    if (input) {
      input.focus();
    }
  }

  setText(text) {
    this.text = text;
    const input = this.querySelector(".rich-text-input");
    if (input) {
      input.textContent = text;
    }
    this.facets = getUnresolvedFacetsFromText(this.text);
    this.render();
    this.paintFacets();
    this.dispatchEvent(
      new CustomEvent("input", {
        detail: { text: this.text, facets: this.facets },
      }),
    );
  }

  setCursor(cursor) {
    const input = this.querySelector(".rich-text-input");
    if (!input) return;
    const position = Math.max(0, Math.min(this.text.length, cursor));
    setCursorPosition(input, position);
  }

  render() {
    render(
      html`
        <div class="rich-text-input-container">
          <div
            class="rich-text-input"
            contenteditable="true"
            @input=${(e) => {
              e.stopPropagation();
              this.handleInput(e);
            }}
            @keydown=${(e) => {
              this.handleKeydown(e);
            }}
            @compositionstart=${() => {
              this.isComposing = true;
            }}
            @compositionend=${(e) => {
              this.isComposing = false;
              this.handleInput(e);
            }}
            @paste=${(e) => {
              e.preventDefault();
              // https://stackoverflow.com/a/58980415
              const text = (e.clipboardData || window.clipboardData).getData(
                "text/plain",
              );
              document.execCommand("insertText", false, text);
            }}
          ></div>
          <div
            class="rich-text-input-placeholder ${this.text.length > 0
              ? "hidden"
              : ""}"
          >
            ${this.placeholder}
          </div>
          ${this.mentionSuggestions.length > 0
            ? mentionSuggestionsTemplate({
                mentionSuggestions: this.mentionSuggestions,
                selectedSuggestionIndex: this.selectedSuggestionIndex,
                onSelect: (actor) => this.selectMention(actor),
              })
            : ""}
        </div>
      `,
      this,
    );

    // Position the typeahead below the @ symbol
    if (this.mentionSuggestions.length > 0) {
      requestAnimationFrame(() => {
        this.positionTypeahead();
      });
    }
  }

  positionTypeahead() {
    const typeahead = this.querySelector("#mention-typeahead");
    const input = this.querySelector(".rich-text-input");

    if (!typeahead || !input || this.currentMentionStart === null) return;

    const inputRect = input.getBoundingClientRect();
    const range = rangeForCharRange(
      input,
      this.currentMentionStart,
      this.currentMentionStart,
    );

    if (range) {
      const rect = range.getBoundingClientRect();

      // Position below the @ symbol (relative to input container)
      typeahead.style.top = `${rect.bottom - inputRect.top}px`;
      typeahead.style.left = `${rect.left - inputRect.left}px`;
      typeahead.style.width = `${inputRect.width}px`;
    }
  }

  paintFacets() {
    if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
    const input = this.querySelector(".rich-text-input");
    if (!input) return;

    this.clearHighlights();

    const byType = new Map();
    for (const facet of this.facets) {
      const featureType = facet.features[0]?.$type;
      const highlightName = FACET_HIGHLIGHT_NAMES[featureType];
      if (!highlightName) continue;
      const charStart = getIndexFromByteIndex(this.text, facet.index.byteStart);
      const charEnd = getIndexFromByteIndex(this.text, facet.index.byteEnd);
      const range = rangeForCharRange(input, charStart, charEnd);
      if (!range) continue;
      const highlight = getOrCreateHighlight(highlightName);
      highlight.add(range);
      if (!byType.has(highlightName)) byType.set(highlightName, []);
      byType.get(highlightName).push(range);
    }

    this._facetHighlights = byType;
  }

  detectPendingMention() {
    const input = this.querySelector(".rich-text-input");
    const cursorPosition = getCursorPosition(input);

    // Look backwards from cursor to find a potential mention
    let mentionStart = -1;
    for (let i = cursorPosition - 1; i >= 0; i--) {
      const char = this.text[i];
      if (char === "@") {
        mentionStart = i;
        break;
      }
      // Stop if we hit a space or newline
      if (char === " " || char === "\n") {
        break;
      }
    }

    if (mentionStart !== -1) {
      const query = this.text.substring(mentionStart + 1, cursorPosition);
      if (query.length > 0) {
        return { query, start: mentionStart, end: cursorPosition };
      }
    }

    return null;
  }

  async fetchMentionSuggestions(query) {
    try {
      const queryParams = new URLSearchParams({
        q: query,
        limit: "8",
      });
      const response = await fetch(
        `${TYPEAHEAD_SERVICE_URL}/xrpc/app.bsky.actor.searchActorsTypeahead?${queryParams.toString()}`,
      );
      if (response.ok) {
        const data = await response.json();
        return data.actors;
      }
    } catch (error) {
      console.error("Error fetching mention suggestions:", error);
    }

    return [];
  }

  async updateMentionSuggestions() {
    const pendingMention = this.detectPendingMention();

    if (pendingMention) {
      this.currentMentionQuery = pendingMention.query;
      this.currentMentionStart = pendingMention.start;
      this.currentMentionEnd = pendingMention.end;
      const suggestions = await this.fetchMentionSuggestions(
        pendingMention.query,
      );
      this.mentionSuggestions = suggestions;
    } else {
      this.mentionSuggestions = [];
      this.selectedSuggestionIndex = null;
      this.currentMentionQuery = null;
      this.currentMentionStart = null;
      this.currentMentionEnd = null;
    }

    this.render();
  }

  selectMention(actor) {
    if (this.currentMentionStart === null) return;

    const input = this.querySelector(".rich-text-input");
    const mention = `@${actor.handle} `;

    // Select the @query span, then replace via execCommand so the browser's
    // native undo stack records this edit alongside ordinary typing.
    const range = rangeForCharRange(
      input,
      this.currentMentionStart,
      this.currentMentionEnd,
    );
    if (range) {
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      input.focus();
      document.execCommand("insertText", false, mention);
    }

    // Clear mention state
    this.mentionSuggestions = [];
    this.selectedSuggestionIndex = null;
    this.currentMentionQuery = null;
    this.currentMentionStart = null;
    this.currentMentionEnd = null;
    this.render();
  }

  handleKeydown(e) {
    if (this.mentionSuggestions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (this.selectedSuggestionIndex === null) {
          this.selectedSuggestionIndex = 0;
        } else {
          this.selectedSuggestionIndex = Math.min(
            this.selectedSuggestionIndex + 1,
            this.mentionSuggestions.length - 1,
          );
        }
        this.render();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        if (this.selectedSuggestionIndex === null) {
          this.selectedSuggestionIndex = 0;
        } else {
          this.selectedSuggestionIndex = Math.max(
            this.selectedSuggestionIndex - 1,
            0,
          );
        }
        this.render();
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        const index = this.selectedSuggestionIndex ?? 0;
        const selectedActor = this.mentionSuggestions[index];
        if (selectedActor) {
          this.selectMention(selectedActor);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.mentionSuggestions = [];
        this.selectedSuggestionIndex = null;
        this.currentMentionQuery = null;
        this.currentMentionStart = null;
        this.currentMentionEnd = null;
        this.render();
      }
    }
  }

  handleInput(e) {
    if (this.isComposing) return;

    this.text = getContentEditableText(e.target);

    this.facets = getUnresolvedFacetsFromText(this.text);

    this.paintFacets();

    this.updateMentionSuggestions();

    this.dispatchEvent(
      new CustomEvent("input", {
        detail: {
          text: this.text,
          facets: this.facets,
        },
      }),
    );
  }
}

RichTextInput.register();
