import { html, render } from "/js/lib/lit-html.js";
import { Component } from "/js/components/component.js";
import { richTextTemplate } from "/js/templates/richText.template.js";
import { getUnresolvedFacetsFromText } from "/js/facetHelpers.js";
import { avatarTemplate } from "/js/templates/avatar.template.js";
import { getDisplayName } from "/js/dataHelpers.js";

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
      // Add 1 for the newline after the DIV (matching setCursorPosition)
      if (!found) {
        position += 1;
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
      position += 1;
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
  const range = document.createRange();
  const sel = window.getSelection();

  let currentPos = 0;
  let foundNode = null;
  let foundOffset = 0;

  // Recursive function to walk through all text nodes
  function walkTextNodes(node) {
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
      if (currentPos + 1 >= position) {
        foundNode = node;
        foundOffset = 0;
        return true;
      }
      currentPos += 1;
    } else if (node.nodeName === "DIV") {
      for (let child of node.childNodes) {
        if (walkTextNodes(child)) return true;
      }
      // Add 1 to the current position to account for the newline
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

function getContentEditableText(element) {
  if (element.children.length === 1 && element.children[0].nodeName === "BR") {
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

function getRangeForCharAtIndex(container, charIndex) {
  let charCount = 0;
  let foundNode = null;
  let foundOffset = 0;

  function walkTextNodes(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      const nodeLength =
        node.textContent === "\n" ? 1 : node.textContent.length;
      if (charCount + nodeLength > charIndex) {
        foundNode = node;
        foundOffset = charIndex - charCount;
        return true;
      }
      charCount += nodeLength;
    } else {
      for (let child of node.childNodes) {
        if (walkTextNodes(child)) return true;
      }
    }
    return false;
  }

  walkTextNodes(container);

  if (foundNode) {
    const range = document.createRange();
    range.setStart(foundNode, foundOffset);
    range.setEnd(foundNode, foundOffset);
    return range;
  }

  return null;
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
        `
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
    this.mentionSuggestions = [];
    this.selectedSuggestionIndex = null;
    this.currentMentionQuery = null;
    this.currentMentionStart = null;
    this.currentMentionEnd = null;
    this.resolvedMentions = new Map();
    this.render();
    this.initialized = true;
  }

  focus() {
    const input = this.querySelector(".rich-text-input");
    if (input) {
      input.focus();
    }
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
      this
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

    // Get the input container rect for left/right positioning
    const inputRect = input.getBoundingClientRect();

    // Get range at the @ symbol position
    const range = getRangeForCharAtIndex(input, this.currentMentionStart);

    if (range) {
      const rect = range.getBoundingClientRect();

      // Position below the @ symbol (relative to input container)
      typeahead.style.top = `${rect.bottom - inputRect.top}px`;
      typeahead.style.left = `${rect.left - inputRect.left}px`;
      typeahead.style.width = `${inputRect.width}px`;
    }
  }

  updateFacets() {
    const input = this.querySelector(".rich-text-input");
    input.innerHTML = "";
    const div = document.createElement("div");
    render(richTextTemplate({ text: this.text, facets: this.facets }), div);
    let content = div.querySelector(".rich-text").innerHTML;
    input.innerHTML = content;
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
        `https://public.api.bsky.app/xrpc/app.bsky.actor.searchActorsTypeahead?${queryParams.toString()}`
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
        pendingMention.query
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
    this.updateFacets();
    this.render();

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
      })
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

  handleKeydown(e) {
    if (this.mentionSuggestions.length === 0) return;
    // Navigate through the mention suggestions
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.selectedSuggestionIndex === null) {
        this.selectedSuggestionIndex = 0;
      } else {
        this.selectedSuggestionIndex = Math.min(
          this.selectedSuggestionIndex + 1,
          this.mentionSuggestions.length - 1
        );
      }
      this.render();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this.selectedSuggestionIndex === null) {
        this.selectedSuggestionIndex = 0;
      } else {
        this.selectedSuggestionIndex = bound({
          value: this.selectedSuggestionIndex - 1,
          min: 0,
          max: this.mentionSuggestions.length - 1,
        });
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

  handleInput(e) {
    this.text = getContentEditableText(e.target);

    let cursorPosition = getCursorPosition(e.target);

    // Get unresolved facets and resolve them using our stored DIDs if possible
    const unresolvedFacets = getUnresolvedFacetsFromText(this.text);
    const newFacets = this.partiallyResolveFacets(unresolvedFacets);

    if (JSON.stringify(this.facets) !== JSON.stringify(newFacets)) {
      this.facets = newFacets;
    }
    this.updateFacets();
    setCursorPosition(e.target, cursorPosition);

    // Check for mention typeahead
    this.updateMentionSuggestions();

    this.dispatchEvent(
      new CustomEvent("input", {
        detail: {
          text: this.text,
          facets: this.facets,
        },
      })
    );
  }
}

RichTextInput.register();
