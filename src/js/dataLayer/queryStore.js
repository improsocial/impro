import { SignalMap, ReactiveStore } from "/js/signals.js";

// One slot per query key, holding loaded pages:
//
//   { pages: [{ items: [...], cursor }] }
//
// `items` holds ids when the item is an entity referenced elsewhere (a post, a
// profile) and whole values when it is only ever read through this query (a
// feed item, a notification). prependToResource/removeFromResource match by
// identity, so they apply only to id-bearing slots.
//
export class QueryStore extends ReactiveStore {
  constructor() {
    super("queryStore");
    this.$collections = new SignalMap();
  }

  get(queryKey) {
    return this.$collections.get(queryKey);
  }

  // Empty string when nothing is loaded yet (fetch from the top), cursor string when there is
  // a next page, and null when the last page was the end of the list.
  getNextCursor(queryKey) {
    const pages = this.$collections.get(queryKey)?.pages;
    if (!pages?.length) {
      return "";
    }
    return pages[pages.length - 1].cursor;
  }

  // Ids of items from all pages
  getItems(queryKey) {
    const collection = this.$collections.get(queryKey);
    if (!collection) {
      return null;
    }
    const items = [];
    const seen = new Set();
    for (const page of collection.pages) {
      for (const id of page.items) {
        if (seen.has(id)) {
          continue;
        }
        seen.add(id);
        items.push(id);
      }
    }
    return items;
  }

  // A single-value query: no pages, no cursor. The entity itself lives here,
  // and list queries hold ids that resolve through getValue.
  setValue(queryKey, value) {
    this.$collections.set(queryKey, { value });
  }

  getValue(queryKey) {
    const collection = this.$collections.get(queryKey);
    return collection && "value" in collection ? collection.value : null;
  }

  set(queryKey, collection) {
    this.$collections.set(queryKey, collection);
  }

  appendPage(queryKey, page, { requestCursor } = {}) {
    const collection = this.$collections.get(queryKey);
    const nextCursor = this.getNextCursor(queryKey);
    if (nextCursor !== (requestCursor === undefined ? "" : requestCursor)) {
      console.warn("Cursor mismatch, discarding page", {
        queryKey,
        requestCursor,
        nextCursor,
      });
      return false;
    }
    this.$collections.set(queryKey, {
      pages: [...(collection?.pages ?? []), normalizePage(page)],
    });
    return true;
  }

  // A reload replaces the collection outright. Everything after the first page
  // was paged in from a cursor chain that starts where the old first page
  // ended, so splicing a fresh first page on top of it could both duplicate
  // items and skip the ones that fell between the two windows.
  replacePages(queryKey, page) {
    this.$collections.set(queryKey, { pages: [normalizePage(page)] });
  }

  // A page either replaces the collection or appends after the cursor it was
  // fetched from; `reload` is the only thing that distinguishes them, and the
  // cursor passed here has to be the one the request was actually made with.
  writePage(queryKey, page, { reload = false, requestCursor } = {}) {
    if (reload) {
      this.replacePages(queryKey, page);
      return true;
    }
    return this.appendPage(queryKey, page, { requestCursor });
  }

  prependToResource(resource, id) {
    this.#updateResource(resource, prependItem(id));
  }

  removeFromResource(resource, id) {
    this.#updateResource(resource, removeItem(id));
  }

  // Key-scoped variants, for resources whose key carries a parameter so a
  // resource-wide update would reach unrelated slots.
  prependToQuery(queryKey, id) {
    this.#updateCollection(queryKey, prependItem(id));
  }

  removeFromQuery(queryKey, id) {
    this.#updateCollection(queryKey, removeItem(id));
  }

  // Query keys that currently hold a slot for the given resource.
  keysForResource(resource) {
    const prefix = resource + "|";
    return [...this.$collections.keys()].filter((queryKey) =>
      queryKey.startsWith(prefix),
    );
  }

  #updateResource(resource, updater) {
    const prefix = resource + "|";
    for (const queryKey of [...this.$collections.keys()]) {
      if (!queryKey.startsWith(prefix)) {
        continue;
      }
      this.#updateCollection(queryKey, updater);
    }
  }

  #updateCollection(queryKey, updater) {
    const collection = this.$collections.get(queryKey);
    if (!collection?.pages?.length) {
      return;
    }
    const next = updater(collection);
    if (next && next !== collection) {
      this.$collections.set(queryKey, next);
    }
  }
}

function prependItem(id) {
  return (collection) => {
    if (collection.pages.some((page) => page.items.includes(id))) {
      return collection;
    }
    const [first, ...rest] = collection.pages;
    return { pages: [{ ...first, items: [id, ...first.items] }, ...rest] };
  };
}

function removeItem(id) {
  return (collection) => ({
    pages: collection.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item !== id),
    })),
  });
}

function normalizePage({ items, cursor }) {
  return { items, cursor: cursor || null };
}
