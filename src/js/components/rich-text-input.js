import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { getUnresolvedFacetsFromText } from "/js/facetHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { getDisplayName } from "/js/dataHelpers.js";
import { deepClone, getIndexFromByteIndex } from "/js/utils.js";
import { TYPEAHEAD_SERVICE_URL } from "/js/config.js";

const sharedHighlights = {
  link: new Highlight(),
  mention: new Highlight(),
  tag: new Highlight(),
};

CSS.highlights.set("rt-link", sharedHighlights.link);
CSS.highlights.set("rt-mention", sharedHighlights.mention);
CSS.highlights.set("rt-tag", sharedHighlights.tag);

function isTrailingSentinel(node) {
  return (
    node &&
    node.nodeName === "BR" &&
    node.hasAttribute &&
    node.hasAttribute("data-trailing-sentinel")
  );
}

function clearHighlightRangesInElement(highlight, element) {
  for (const range of [...highlight]) {
    if (!range.startContainer || !element.contains(range.startContainer)) {
      continue;
    }
    highlight.delete(range);
  }
}

function getHighlightForFacet(facet) {
  const type = facet.features?.[0]?.$type;
  if (type === "app.bsky.richtext.facet#link") return sharedHighlights.link;
  if (type === "app.bsky.richtext.facet#mention")
    return sharedHighlights.mention;
  if (type === "app.bsky.richtext.facet#tag") return sharedHighlights.tag;
  return null;
}

function getCursorPosition(editableDiv) {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return 0;

  const range = sel.getRangeAt(0);
  const endContainer = range.endContainer;
  const endOffset = range.endOffset;

  let position = 0;
  let found = false;

  function countNodeChars(node) {
    if (isTrailingSentinel(node)) return;
    if (node.nodeType === Node.TEXT_NODE) {
      position += node.textContent.length;
    } else if (node.nodeName === "BR") {
      position += 1;
    } else {
      for (let child of node.childNodes) {
        countNodeChars(child);
      }
    }
  }

  function walkNodes(node) {
    if (found) return;
    if (isTrailingSentinel(node)) return;

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
    } else {
      for (let child of node.childNodes) {
        walkNodes(child);
        if (found) return;
      }
    }
  }

  walkNodes(editableDiv);
  return position;
}

function setCursorPosition(editableDiv, position) {
  const range = document.createRange();
  const sel = window.getSelection();

  let currentPos = 0;
  let foundNode = null;
  let foundOffset = 0;

  function walkTextNodes(node) {
    if (isTrailingSentinel(node)) return false;
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength =
        node.textContent === "\n" ? 1 : node.textContent.length;
      if (currentPos + nodeLength >= position) {
        foundNode = node;
        foundOffset = position - currentPos;
        return true;
      }
      currentPos += nodeLength;
    }
    if (node.nodeName === "BR") {
      if (currentPos + 1 > position) {
        // Position is before or at the BR
        foundNode = node;
        foundOffset = 0;
        return true;
      }
      currentPos += 1;
    } else {
      for (let child of node.childNodes) {
        if (walkTextNodes(child)) return true;
      }
    }
    return false;
  }

  walkTextNodes(editableDiv);

  if (foundNode) {
    range.setStart(foundNode, foundOffset);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // Ensure the cursor is visible
    editableDiv.focus();
  }
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
      return;
    }
    this.placeholder = this.getAttribute("placeholder") || "";
    this.facets = [];
    this.text = "";
    this.history = [
      {
        text: "",
        facets: [],
        cursorPosition: 0,
      },
    ];
    this.historyIndex = 0;
    this.historyDebounceTimer = null;
    this.mentionSuggestions = [];
    this.selectedSuggestionIndex = null;
    this.currentMentionQuery = null;
    this.currentMentionStart = null;
    this.currentMentionEnd = null;
    this.resolvedMentions = new Map();
    this._composing = false;

    this.render();
    this.initialized = true;
  }

  focus() {
    const input = this.querySelector(".rich-text-input");
    if (input) {
      input.focus();
    }
  }

  setText(text) {
    this.text = text;
    const unresolvedFacets = getUnresolvedFacetsFromText(this.text);
    this.facets = this.partiallyResolveFacets(unresolvedFacets);
    this.render();
    this.syncText();
    this.refreshHighlights();
    this.saveHistory();
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
            contenteditable="plaintext-only"
            @input=${(e) => {
              e.stopPropagation();
              this.handleInput(e);
            }}
            @compositionstart=${() => {
              this._composing = true;
            }}
            @compositionend=${(e) => {
              this._composing = false;
              this.handleInput(e);
            }}
            @keydown=${(e) => {
              this.handleKeydown(e);
            }}
            @paste=${(e) => {
              e.preventDefault();
              // https://stackoverflow.com/a/58980415
              const text = (e.clipboardData || window.clipboardData).getData(
                "text/plain",
              );
              document.execCommand("insertText", false, text);
            }}
            @click=${(e) => {
              if (e.target.closest("a")) {
                e.preventDefault();
              }
            }}
            @auxclick=${(e) => {
              if (e.target.closest("a")) {
                e.preventDefault();
              }
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

    const textNode = input.firstChild;
    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

    const inputRect = input.getBoundingClientRect();
    const startChar = Math.min(this.currentMentionStart, textNode.length);
    const endChar = Math.min(startChar + 1, textNode.length);
    const range = document.createRange();
    range.setStart(textNode, startChar);
    range.setEnd(textNode, endChar);
    const rect = range.getBoundingClientRect();

    typeahead.style.top = `${rect.bottom - inputRect.top}px`;
    typeahead.style.left = `${rect.left - inputRect.left}px`;
    typeahead.style.width = `${inputRect.width}px`;
  }

  syncText() {
    const input = this.querySelector(".rich-text-input");
    if (!input) return;
    if (input.textContent !== this.text) {
      input.textContent = this.text;
    }
    this.updateTrailingSentinel();
  }

  updateTrailingSentinel() {
    const input = this.querySelector(".rich-text-input");
    if (!input) return;
    const existing = input.querySelector("br[data-trailing-sentinel]");
    if (existing) existing.remove();
    if (!this.text.endsWith("\n")) return;
    // Native trailing <br> (desktop browsers add one automatically) already
    // renders the empty line, so no sentinel is needed.
    if (input.lastChild && input.lastChild.nodeName === "BR") return;
    const br = document.createElement("br");
    br.setAttribute("data-trailing-sentinel", "");
    input.appendChild(br);
  }

  refreshHighlights() {
    const input = this.querySelector(".rich-text-input");
    if (!input) return;

    const textNode = input.firstChild;
    for (const highlight of Object.values(sharedHighlights)) {
      clearHighlightRangesInElement(highlight, input);
    }

    if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return;

    for (const facet of this.facets) {
      const highlight = getHighlightForFacet(facet);
      if (!highlight) continue;
      const startChar = getIndexFromByteIndex(this.text, facet.index.byteStart);
      const endChar = getIndexFromByteIndex(this.text, facet.index.byteEnd);
      if (startChar < 0 || endChar > textNode.length || startChar >= endChar) {
        continue;
      }
      const range = new Range();
      range.setStart(textNode, startChar);
      range.setEnd(textNode, endChar);
      highlight.add(range);
    }
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
    // Use stored cursor position since clicking the dropdown moves focus

    // Replace the @query with @handle
    const before = this.text.substring(0, this.currentMentionStart);
    const after = this.text.substring(this.currentMentionEnd);
    const mention = `@${actor.handle}`;

    this.text = before + mention + after;

    // Store the resolved mention in the map
    this.resolvedMentions.set(actor.handle, actor.did);

    // Get unresolved facets and resolve them using our helper
    const unresolvedFacets = getUnresolvedFacetsFromText(this.text);
    this.facets = this.partiallyResolveFacets(unresolvedFacets);

    // Calculate cursor position before clearing state
    const newCursorPosition = this.currentMentionStart + mention.length;

    // Clear mention state
    this.mentionSuggestions = [];
    this.selectedSuggestionIndex = null;
    this.currentMentionQuery = null;
    this.currentMentionStart = null;

    // Update the UI
    this.render();
    this.syncText();
    this.refreshHighlights();

    // Set cursor after the mention
    setTimeout(() => {
      setCursorPosition(input, newCursorPosition);
    }, 0);

    // Dispatch event
    this.dispatchEvent(
      new CustomEvent("input", {
        detail: {
          text: this.text,
          facets: this.facets,
        },
      }),
    );
  }

  partiallyResolveFacets(unresolvedFacets) {
    // Map unresolved facets to resolved facets where we have DID information
    return unresolvedFacets.map((facet) => {
      if (
        facet.features &&
        facet.features[0].$type === "app.bsky.richtext.facet#mention"
      ) {
        const feature = facet.features[0];
        if (feature.handle && !feature.did) {
          const did = this.resolvedMentions.get(feature.handle);
          if (did) {
            return {
              index: facet.index,
              features: [
                {
                  $type: "app.bsky.richtext.facet#mention",
                  did: did,
                },
              ],
            };
          }
        }
      }
      return facet;
    });
  }

  saveHistory() {
    const input = this.querySelector(".rich-text-input");
    const cursorPosition = getCursorPosition(input);

    // Clear any pending debounce
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
    }

    // Debounce: save state after 300ms of no changes
    this.historyDebounceTimer = setTimeout(() => {
      // Don't save if state hasn't changed from last saved
      const currentEntry = this.history[this.historyIndex];
      if (currentEntry && currentEntry.text === this.text) {
        return;
      }

      // Clear any "future" states beyond current index
      this.history = this.history.slice(0, this.historyIndex + 1);

      this.history.push({
        text: this.text,
        facets: deepClone(this.facets),
        cursorPosition,
      });

      this.historyIndex = this.history.length - 1;

      // Limit history size
      if (this.history.length > 100) {
        this.history.shift();
        this.historyIndex--;
      }

      this.historyDebounceTimer = null;
    }, 300);
  }

  undo() {
    const input = this.querySelector(".rich-text-input");
    const currentCursorPosition = getCursorPosition(input);

    // If there's a pending save, flush it first
    if (this.historyDebounceTimer) {
      clearTimeout(this.historyDebounceTimer);
      this.historyDebounceTimer = null;

      const currentEntry = this.history[this.historyIndex];
      if (!currentEntry || currentEntry.text !== this.text) {
        // Clear any "future" states beyond current index
        this.history = this.history.slice(0, this.historyIndex + 1);

        this.history.push({
          text: this.text,
          facets: deepClone(this.facets),
          cursorPosition: currentCursorPosition,
        });
        this.historyIndex = this.history.length - 1;
      }
    }

    if (this.historyIndex <= 0) return;

    // Move back in history
    this.historyIndex--;
    const prev = this.history[this.historyIndex];

    this.text = prev.text;
    this.facets = prev.facets;

    this.render();
    this.syncText();
    this.refreshHighlights();

    setTimeout(() => {
      setCursorPosition(input, prev.cursorPosition);
    }, 0);

    this.dispatchEvent(
      new CustomEvent("input", {
        detail: { text: this.text, facets: this.facets },
      }),
    );
  }

  redo() {
    if (this.historyIndex >= this.history.length - 1) return;

    // Move forward in history
    this.historyIndex++;
    const next = this.history[this.historyIndex];

    this.text = next.text;
    this.facets = next.facets;

    this.render();
    this.syncText();
    this.refreshHighlights();

    const input = this.querySelector(".rich-text-input");
    setTimeout(() => {
      setCursorPosition(input, next.cursorPosition);
    }, 0);

    this.dispatchEvent(
      new CustomEvent("input", {
        detail: { text: this.text, facets: this.facets },
      }),
    );
  }

  handleKeydown(e) {
    // Handle undo/redo before anything else
    if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }
    if (
      (e.ctrlKey || e.metaKey) &&
      (e.key === "y" || (e.key === "z" && e.shiftKey))
    ) {
      e.preventDefault();
      this.redo();
      return;
    }

    if (this.mentionSuggestions.length > 0) {
      // Navigate through the mention suggestions
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
    // Skip while an IME composition is in progress
    if (this._composing) return;

    const prevText = this.text;
    this.text = e.target.textContent;

    // Save to history if text changed
    if (prevText !== this.text) {
      this.saveHistory();
    }

    // Get unresolved facets and resolve them using our stored DIDs if possible
    const unresolvedFacets = getUnresolvedFacetsFromText(this.text);
    const newFacets = this.partiallyResolveFacets(unresolvedFacets);

    if (JSON.stringify(this.facets) !== JSON.stringify(newFacets)) {
      this.facets = newFacets;
    }

    this.updateTrailingSentinel();
    this.refreshHighlights();
    // Check for mention typeahead
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
