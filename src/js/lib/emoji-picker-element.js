// v1.27.0 https://github.com/nolanlawson/emoji-picker-element

function assertNonEmptyString(str) {
  if (typeof str !== "string" || !str) {
    throw new Error("expected a non-empty string, got: " + str);
  }
}
function assertNumber(number) {
  if (typeof number !== "number") {
    throw new Error("expected a number, got: " + number);
  }
}
var DB_VERSION_CURRENT = 1;
var DB_VERSION_INITIAL = 1;
var STORE_EMOJI = "emoji";
var STORE_KEYVALUE = "keyvalue";
var STORE_FAVORITES = "favorites";
var FIELD_TOKENS = "tokens";
var INDEX_TOKENS = "tokens";
var FIELD_UNICODE = "unicode";
var INDEX_COUNT = "count";
var FIELD_GROUP = "group";
var FIELD_ORDER = "order";
var INDEX_GROUP_AND_ORDER = "group-order";
var KEY_ETAG = "eTag";
var KEY_URL = "url";
var KEY_PREFERRED_SKINTONE = "skinTone";
var MODE_READONLY = "readonly";
var MODE_READWRITE = "readwrite";
var INDEX_SKIN_UNICODE = "skinUnicodes";
var FIELD_SKIN_UNICODE = "skinUnicodes";
var DEFAULT_DATA_SOURCE = "https://cdn.jsdelivr.net/npm/emoji-picker-element-data@^1/en/emojibase/data.json";
var DEFAULT_LOCALE = "en";
function uniqBy(arr, func) {
  const set2 = /* @__PURE__ */ new Set();
  const res = [];
  for (const item of arr) {
    const key = func(item);
    if (!set2.has(key)) {
      set2.add(key);
      res.push(item);
    }
  }
  return res;
}
function uniqEmoji(emojis) {
  return uniqBy(emojis, (_) => _.unicode);
}
function initialMigration(db) {
  function createObjectStore(name, keyPath, indexes) {
    const store = keyPath ? db.createObjectStore(name, { keyPath }) : db.createObjectStore(name);
    if (indexes) {
      for (const [indexName, [keyPath2, multiEntry]] of Object.entries(indexes)) {
        store.createIndex(indexName, keyPath2, { multiEntry });
      }
    }
    return store;
  }
  createObjectStore(STORE_KEYVALUE);
  createObjectStore(
    STORE_EMOJI,
    /* keyPath */
    FIELD_UNICODE,
    {
      [INDEX_TOKENS]: [
        FIELD_TOKENS,
        /* multiEntry */
        true
      ],
      [INDEX_GROUP_AND_ORDER]: [[FIELD_GROUP, FIELD_ORDER]],
      [INDEX_SKIN_UNICODE]: [
        FIELD_SKIN_UNICODE,
        /* multiEntry */
        true
      ]
    }
  );
  createObjectStore(STORE_FAVORITES, void 0, {
    [INDEX_COUNT]: [""]
  });
}
var openIndexedDBRequests = {};
var databaseCache = {};
var onCloseListeners = {};
function handleOpenOrDeleteReq(resolve, reject, req) {
  req.onerror = () => reject(req.error);
  req.onblocked = () => reject(new Error("IDB blocked"));
  req.onsuccess = () => resolve(req.result);
}
async function createDatabase(dbName) {
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, DB_VERSION_CURRENT);
    openIndexedDBRequests[dbName] = req;
    req.onupgradeneeded = (e) => {
      if (e.oldVersion < DB_VERSION_INITIAL) {
        initialMigration(req.result);
      }
    };
    handleOpenOrDeleteReq(resolve, reject, req);
  });
  db.onclose = () => closeDatabase(dbName);
  return db;
}
function openDatabase(dbName) {
  if (!databaseCache[dbName]) {
    databaseCache[dbName] = createDatabase(dbName);
  }
  return databaseCache[dbName];
}
function dbPromise(db, storeName, readOnlyOrReadWrite, cb) {
  return new Promise((resolve, reject) => {
    const txn = db.transaction(storeName, readOnlyOrReadWrite, { durability: "relaxed" });
    const store = typeof storeName === "string" ? txn.objectStore(storeName) : storeName.map((name) => txn.objectStore(name));
    let res;
    cb(store, txn, (result) => {
      res = result;
    });
    txn.oncomplete = () => resolve(res);
    txn.onerror = () => reject(txn.error);
  });
}
function closeDatabase(dbName) {
  const req = openIndexedDBRequests[dbName];
  const db = req && req.result;
  if (db) {
    db.close();
    const listeners = onCloseListeners[dbName];
    if (listeners) {
      for (const listener of listeners) {
        listener();
      }
    }
  }
  delete openIndexedDBRequests[dbName];
  delete databaseCache[dbName];
  delete onCloseListeners[dbName];
}
function deleteDatabase(dbName) {
  return new Promise((resolve, reject) => {
    closeDatabase(dbName);
    const req = indexedDB.deleteDatabase(dbName);
    handleOpenOrDeleteReq(resolve, reject, req);
  });
}
function addOnCloseListener(dbName, listener) {
  let listeners = onCloseListeners[dbName];
  if (!listeners) {
    listeners = onCloseListeners[dbName] = [];
  }
  listeners.push(listener);
}
var irregularEmoticons = /* @__PURE__ */ new Set([
  ":D",
  "XD",
  ":'D",
  "O:)",
  ":X",
  ":P",
  ";P",
  "XP",
  ":L",
  ":Z",
  ":j",
  "8D",
  "XO",
  "8)",
  ":B",
  ":O",
  ":S",
  ":'o",
  "Dx",
  "X(",
  "D:",
  ":C",
  ">0)",
  ":3",
  "</3",
  "<3",
  "\\M/",
  ":E",
  "8#"
]);
function extractTokens(str) {
  return str.split(/[\s_]+/).map((word) => {
    if (!word.match(/\w/) || irregularEmoticons.has(word)) {
      return word.toLowerCase();
    }
    return word.replace(/[)(:,]/g, "").replace(/’/g, "'").toLowerCase();
  }).filter(Boolean);
}
var MIN_SEARCH_TEXT_LENGTH = 2;
function normalizeTokens(str) {
  return str.filter(Boolean).map((_) => _.toLowerCase()).filter((_) => _.length >= MIN_SEARCH_TEXT_LENGTH);
}
function transformEmojiData(emojiData) {
  const res = emojiData.map(({ annotation, emoticon, group, order, shortcodes, skins, tags, emoji, version }) => {
    const tokens = [...new Set(
      normalizeTokens([
        ...(shortcodes || []).map(extractTokens).flat(),
        ...(tags || []).map(extractTokens).flat(),
        ...extractTokens(annotation),
        emoticon
      ])
    )].sort();
    const res2 = {
      annotation,
      group,
      order,
      tags,
      tokens,
      unicode: emoji,
      version
    };
    if (emoticon) {
      res2.emoticon = emoticon;
    }
    if (shortcodes) {
      res2.shortcodes = shortcodes;
    }
    if (skins) {
      res2.skinTones = [];
      res2.skinUnicodes = [];
      res2.skinVersions = [];
      for (const { tone, emoji: emoji2, version: version2 } of skins) {
        res2.skinTones.push(tone);
        res2.skinUnicodes.push(emoji2);
        res2.skinVersions.push(version2);
      }
    }
    return res2;
  });
  return res;
}
function callStore(store, method, key, cb) {
  store[method](key).onsuccess = (e) => cb && cb(e.target.result);
}
function getIDB(store, key, cb) {
  callStore(store, "get", key, cb);
}
function getAllIDB(store, key, cb) {
  callStore(store, "getAll", key, cb);
}
function commit(txn) {
  if (txn.commit) {
    txn.commit();
  }
}
function minBy(array, func) {
  let minItem = array[0];
  for (let i = 1; i < array.length; i++) {
    const item = array[i];
    if (func(minItem) > func(item)) {
      minItem = item;
    }
  }
  return minItem;
}
function findCommonMembers(arrays, uniqByFunc) {
  const shortestArray = minBy(arrays, (_) => _.length);
  const results = [];
  for (const item of shortestArray) {
    if (!arrays.some((array) => array.findIndex((_) => uniqByFunc(_) === uniqByFunc(item)) === -1)) {
      results.push(item);
    }
  }
  return results;
}
async function isEmpty(db) {
  return !await get(db, STORE_KEYVALUE, KEY_URL);
}
async function hasData(db, url, eTag) {
  const [oldETag, oldUrl] = await Promise.all([KEY_ETAG, KEY_URL].map((key) => get(db, STORE_KEYVALUE, key)));
  return oldETag === eTag && oldUrl === url;
}
async function doFullDatabaseScanForSingleResult(db, predicate) {
  const BATCH_SIZE = 50;
  return dbPromise(db, STORE_EMOJI, MODE_READONLY, (emojiStore, txn, cb) => {
    let lastKey;
    const processNextBatch = () => {
      emojiStore.getAll(lastKey && IDBKeyRange.lowerBound(lastKey, true), BATCH_SIZE).onsuccess = (e) => {
        const results = e.target.result;
        for (const result of results) {
          lastKey = result.unicode;
          if (predicate(result)) {
            return cb(result);
          }
        }
        if (results.length < BATCH_SIZE) {
          return cb();
        }
        processNextBatch();
      };
    };
    processNextBatch();
  });
}
async function loadData(db, emojiData, url, eTag) {
  try {
    const transformedData = transformEmojiData(emojiData);
    await dbPromise(db, [STORE_EMOJI, STORE_KEYVALUE], MODE_READWRITE, ([emojiStore, metaStore], txn) => {
      let oldETag;
      let oldUrl;
      let todo = 0;
      function checkFetched() {
        if (++todo === 2) {
          onFetched();
        }
      }
      function onFetched() {
        if (oldETag === eTag && oldUrl === url) {
          return;
        }
        emojiStore.clear();
        for (const data of transformedData) {
          emojiStore.put(data);
        }
        metaStore.put(eTag, KEY_ETAG);
        metaStore.put(url, KEY_URL);
        commit(txn);
      }
      getIDB(metaStore, KEY_ETAG, (result) => {
        oldETag = result;
        checkFetched();
      });
      getIDB(metaStore, KEY_URL, (result) => {
        oldUrl = result;
        checkFetched();
      });
    });
  } finally {
  }
}
async function getEmojiByGroup(db, group) {
  return dbPromise(db, STORE_EMOJI, MODE_READONLY, (emojiStore, txn, cb) => {
    const range = IDBKeyRange.bound([group, 0], [group + 1, 0], false, true);
    getAllIDB(emojiStore.index(INDEX_GROUP_AND_ORDER), range, cb);
  });
}
async function getEmojiBySearchQuery(db, query) {
  const tokens = normalizeTokens(extractTokens(query));
  if (!tokens.length) {
    return [];
  }
  return dbPromise(db, STORE_EMOJI, MODE_READONLY, (emojiStore, txn, cb) => {
    const intermediateResults = [];
    const checkDone = () => {
      if (intermediateResults.length === tokens.length) {
        onDone();
      }
    };
    const onDone = () => {
      const results = findCommonMembers(intermediateResults, (_) => _.unicode);
      cb(results.sort((a, b) => a.order < b.order ? -1 : 1));
    };
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const range = i === tokens.length - 1 ? IDBKeyRange.bound(token, token + "\uFFFF", false, true) : IDBKeyRange.only(token);
      getAllIDB(emojiStore.index(INDEX_TOKENS), range, (result) => {
        intermediateResults.push(result);
        checkDone();
      });
    }
  });
}
async function getEmojiByShortcode(db, shortcode) {
  const emojis = await getEmojiBySearchQuery(db, shortcode);
  if (!emojis.length) {
    const predicate = (_) => (_.shortcodes || []).includes(shortcode.toLowerCase());
    return await doFullDatabaseScanForSingleResult(db, predicate) || null;
  }
  return emojis.filter((_) => {
    const lowerShortcodes = (_.shortcodes || []).map((_2) => _2.toLowerCase());
    return lowerShortcodes.includes(shortcode.toLowerCase());
  })[0] || null;
}
async function getEmojiByUnicode(db, unicode) {
  return dbPromise(db, STORE_EMOJI, MODE_READONLY, (emojiStore, txn, cb) => getIDB(emojiStore, unicode, (result) => {
    if (result) {
      return cb(result);
    }
    getIDB(emojiStore.index(INDEX_SKIN_UNICODE), unicode, (result2) => cb(result2 || null));
  }));
}
function get(db, storeName, key) {
  return dbPromise(db, storeName, MODE_READONLY, (store, txn, cb) => getIDB(store, key, cb));
}
function set(db, storeName, key, value) {
  return dbPromise(db, storeName, MODE_READWRITE, (store, txn) => {
    store.put(value, key);
    commit(txn);
  });
}
function incrementFavoriteEmojiCount(db, unicode) {
  return dbPromise(db, STORE_FAVORITES, MODE_READWRITE, (store, txn) => getIDB(store, unicode, (result) => {
    store.put((result || 0) + 1, unicode);
    commit(txn);
  }));
}
function getTopFavoriteEmoji(db, customEmojiIndex2, limit) {
  if (limit === 0) {
    return [];
  }
  return dbPromise(db, [STORE_FAVORITES, STORE_EMOJI], MODE_READONLY, ([favoritesStore, emojiStore], txn, cb) => {
    const results = [];
    favoritesStore.index(INDEX_COUNT).openCursor(void 0, "prev").onsuccess = (e) => {
      const cursor = e.target.result;
      if (!cursor) {
        return cb(results);
      }
      function addResult(result) {
        results.push(result);
        if (results.length === limit) {
          return cb(results);
        }
        cursor.continue();
      }
      const unicodeOrName = cursor.primaryKey;
      const custom = customEmojiIndex2.byName(unicodeOrName);
      if (custom) {
        return addResult(custom);
      }
      getIDB(emojiStore, unicodeOrName, (emoji) => {
        if (emoji) {
          return addResult(emoji);
        }
        cursor.continue();
      });
    };
  });
}
var CODA_MARKER = "";
function trie(arr, itemToTokens) {
  const map = /* @__PURE__ */ new Map();
  for (const item of arr) {
    const tokens = itemToTokens(item);
    for (const token of tokens) {
      let currentMap = map;
      for (let i = 0; i < token.length; i++) {
        const char = token.charAt(i);
        let nextMap = currentMap.get(char);
        if (!nextMap) {
          nextMap = /* @__PURE__ */ new Map();
          currentMap.set(char, nextMap);
        }
        currentMap = nextMap;
      }
      let valuesAtCoda = currentMap.get(CODA_MARKER);
      if (!valuesAtCoda) {
        valuesAtCoda = [];
        currentMap.set(CODA_MARKER, valuesAtCoda);
      }
      valuesAtCoda.push(item);
    }
  }
  const search = (query, exact) => {
    let currentMap = map;
    for (let i = 0; i < query.length; i++) {
      const char = query.charAt(i);
      const nextMap = currentMap.get(char);
      if (nextMap) {
        currentMap = nextMap;
      } else {
        return [];
      }
    }
    if (exact) {
      const results2 = currentMap.get(CODA_MARKER);
      return results2 || [];
    }
    const results = [];
    const queue = [currentMap];
    while (queue.length) {
      const currentMap2 = queue.shift();
      const entriesSortedByKey = [...currentMap2.entries()].sort((a, b) => a[0] < b[0] ? -1 : 1);
      for (const [key, value] of entriesSortedByKey) {
        if (key === CODA_MARKER) {
          results.push(...value);
        } else {
          queue.push(value);
        }
      }
    }
    return results;
  };
  return search;
}
var requiredKeys$1 = [
  "name",
  "url"
];
function assertCustomEmojis(customEmojis) {
  const isArray = customEmojis && Array.isArray(customEmojis);
  const firstItemIsFaulty = isArray && customEmojis.length && (!customEmojis[0] || requiredKeys$1.some((key) => !(key in customEmojis[0])));
  if (!isArray || firstItemIsFaulty) {
    throw new Error("Custom emojis are in the wrong format");
  }
}
function customEmojiIndex(customEmojis) {
  assertCustomEmojis(customEmojis);
  const sortByName = (a, b) => a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1;
  const all = customEmojis.sort(sortByName);
  const emojiToTokens = (emoji) => {
    const set2 = /* @__PURE__ */ new Set();
    if (emoji.shortcodes) {
      for (const shortcode of emoji.shortcodes) {
        for (const token of extractTokens(shortcode)) {
          set2.add(token);
        }
      }
    }
    return set2;
  };
  const searchTrie = trie(customEmojis, emojiToTokens);
  const searchByExactMatch = (_) => searchTrie(_, true);
  const searchByPrefix = (_) => searchTrie(_, false);
  const search = (query) => {
    const tokens = extractTokens(query);
    const intermediateResults = tokens.map((token, i) => (i < tokens.length - 1 ? searchByExactMatch : searchByPrefix)(token));
    return findCommonMembers(intermediateResults, (_) => _.name).sort(sortByName);
  };
  const shortcodeToEmoji = /* @__PURE__ */ new Map();
  const nameToEmoji = /* @__PURE__ */ new Map();
  for (const customEmoji of customEmojis) {
    nameToEmoji.set(customEmoji.name.toLowerCase(), customEmoji);
    for (const shortcode of customEmoji.shortcodes || []) {
      shortcodeToEmoji.set(shortcode.toLowerCase(), customEmoji);
    }
  }
  const byShortcode = (shortcode) => shortcodeToEmoji.get(shortcode.toLowerCase());
  const byName = (name) => nameToEmoji.get(name.toLowerCase());
  return {
    all,
    search,
    byShortcode,
    byName
  };
}
var isFirefoxContentScript = typeof wrappedJSObject !== "undefined";
function cleanEmoji(emoji) {
  if (!emoji) {
    return emoji;
  }
  if (isFirefoxContentScript) {
    emoji = structuredClone(emoji);
  }
  delete emoji.tokens;
  if (emoji.skinTones) {
    const len = emoji.skinTones.length;
    emoji.skins = Array(len);
    for (let i = 0; i < len; i++) {
      emoji.skins[i] = {
        tone: emoji.skinTones[i],
        unicode: emoji.skinUnicodes[i],
        version: emoji.skinVersions[i]
      };
    }
    delete emoji.skinTones;
    delete emoji.skinUnicodes;
    delete emoji.skinVersions;
  }
  return emoji;
}
function warnETag(eTag) {
  if (!eTag) {
    console.warn("emoji-picker-element is more efficient if the dataSource server exposes an ETag header.");
  }
}
var requiredKeys = [
  "annotation",
  "emoji",
  "group",
  "order",
  "version"
];
function assertEmojiData(emojiData) {
  if (!emojiData || !Array.isArray(emojiData) || !emojiData[0] || typeof emojiData[0] !== "object" || requiredKeys.some((key) => !(key in emojiData[0]))) {
    throw new Error("Emoji data is in the wrong format");
  }
}
function assertStatus(response, dataSource) {
  if (Math.floor(response.status / 100) !== 2) {
    throw new Error("Failed to fetch: " + dataSource + ":  " + response.status);
  }
}
async function getETag(dataSource) {
  const response = await fetch(dataSource, { method: "HEAD" });
  assertStatus(response, dataSource);
  const eTag = response.headers.get("etag");
  warnETag(eTag);
  return eTag;
}
async function getETagAndData(dataSource) {
  const response = await fetch(dataSource);
  assertStatus(response, dataSource);
  const eTag = response.headers.get("etag");
  warnETag(eTag);
  const emojiData = await response.json();
  assertEmojiData(emojiData);
  return [eTag, emojiData];
}
function arrayBufferToBinaryString(buffer) {
  var binary = "";
  var bytes = new Uint8Array(buffer);
  var length = bytes.byteLength;
  var i = -1;
  while (++i < length) {
    binary += String.fromCharCode(bytes[i]);
  }
  return binary;
}
function binaryStringToArrayBuffer(binary) {
  var length = binary.length;
  var buf = new ArrayBuffer(length);
  var arr = new Uint8Array(buf);
  var i = -1;
  while (++i < length) {
    arr[i] = binary.charCodeAt(i);
  }
  return buf;
}
async function jsonChecksum(object) {
  const inString = JSON.stringify(object);
  let inBuffer = binaryStringToArrayBuffer(inString);
  const outBuffer = await crypto.subtle.digest("SHA-1", inBuffer);
  const outBinString = arrayBufferToBinaryString(outBuffer);
  const res = btoa(outBinString);
  return res;
}
async function doCheckForUpdates(db, dataSource) {
  let emojiData;
  let eTag = await getETag(dataSource);
  if (!eTag) {
    const eTagAndData = await getETagAndData(dataSource);
    eTag = eTagAndData[0];
    emojiData = eTagAndData[1];
    if (!eTag) {
      eTag = await jsonChecksum(emojiData);
    }
  }
  if (await hasData(db, dataSource, eTag)) ;
  else {
    if (!emojiData) {
      const eTagAndData = await getETagAndData(dataSource);
      emojiData = eTagAndData[1];
    }
    await loadData(db, emojiData, dataSource, eTag);
  }
}
async function loadDataForFirstTime(db, dataSource) {
  let [eTag, emojiData] = await getETagAndData(dataSource);
  if (!eTag) {
    eTag = await jsonChecksum(emojiData);
  }
  await loadData(db, emojiData, dataSource, eTag);
}
async function checkForUpdates(db, dataSource) {
  try {
    await doCheckForUpdates(db, dataSource);
  } catch (err) {
    if (err.name !== "InvalidStateError") {
      throw err;
    }
  }
}
var Database = class {
  constructor({ dataSource = DEFAULT_DATA_SOURCE, locale = DEFAULT_LOCALE, customEmoji = [] } = {}) {
    this.dataSource = dataSource;
    this.locale = locale;
    this._dbName = `emoji-picker-element-${this.locale}`;
    this._db = void 0;
    this._lazyUpdate = void 0;
    this._custom = customEmojiIndex(customEmoji);
    this._clear = this._clear.bind(this);
    this._ready = this._init();
  }
  async _init() {
    const db = this._db = await openDatabase(this._dbName);
    addOnCloseListener(this._dbName, this._clear);
    const dataSource = this.dataSource;
    const empty = await isEmpty(db);
    if (empty) {
      await loadDataForFirstTime(db, dataSource);
    } else {
      this._lazyUpdate = checkForUpdates(db, dataSource);
    }
  }
  async ready() {
    const checkReady = async () => {
      if (!this._ready) {
        this._ready = this._init();
      }
      return this._ready;
    };
    await checkReady();
    if (!this._db) {
      await checkReady();
    }
  }
  async getEmojiByGroup(group) {
    assertNumber(group);
    await this.ready();
    return uniqEmoji(await getEmojiByGroup(this._db, group)).map(cleanEmoji);
  }
  async getEmojiBySearchQuery(query) {
    assertNonEmptyString(query);
    await this.ready();
    const customs = this._custom.search(query);
    const natives = uniqEmoji(await getEmojiBySearchQuery(this._db, query)).map(cleanEmoji);
    return [
      ...customs,
      ...natives
    ];
  }
  async getEmojiByShortcode(shortcode) {
    assertNonEmptyString(shortcode);
    await this.ready();
    const custom = this._custom.byShortcode(shortcode);
    if (custom) {
      return custom;
    }
    return cleanEmoji(await getEmojiByShortcode(this._db, shortcode));
  }
  async getEmojiByUnicodeOrName(unicodeOrName) {
    assertNonEmptyString(unicodeOrName);
    await this.ready();
    const custom = this._custom.byName(unicodeOrName);
    if (custom) {
      return custom;
    }
    return cleanEmoji(await getEmojiByUnicode(this._db, unicodeOrName));
  }
  async getPreferredSkinTone() {
    await this.ready();
    return await get(this._db, STORE_KEYVALUE, KEY_PREFERRED_SKINTONE) || 0;
  }
  async setPreferredSkinTone(skinTone) {
    assertNumber(skinTone);
    await this.ready();
    return set(this._db, STORE_KEYVALUE, KEY_PREFERRED_SKINTONE, skinTone);
  }
  async incrementFavoriteEmojiCount(unicodeOrName) {
    assertNonEmptyString(unicodeOrName);
    await this.ready();
    return incrementFavoriteEmojiCount(this._db, unicodeOrName);
  }
  async getTopFavoriteEmoji(limit) {
    assertNumber(limit);
    await this.ready();
    return (await getTopFavoriteEmoji(this._db, this._custom, limit)).map(cleanEmoji);
  }
  set customEmoji(customEmojis) {
    this._custom = customEmojiIndex(customEmojis);
  }
  get customEmoji() {
    return this._custom.all;
  }
  async _shutdown() {
    await this.ready();
    try {
      await this._lazyUpdate;
    } catch (err) {
    }
  }
  // clear references to IDB, e.g. during a close event
  _clear() {
    this._db = this._ready = this._lazyUpdate = void 0;
  }
  async close() {
    await this._shutdown();
    await closeDatabase(this._dbName);
  }
  async delete() {
    await this._shutdown();
    await deleteDatabase(this._dbName);
  }
};

var allGroups = [
  [-1, "\u2728", "custom"],
  [0, "\u{1F600}", "smileys-emotion"],
  [1, "\u{1F44B}", "people-body"],
  [3, "\u{1F431}", "animals-nature"],
  [4, "\u{1F34E}", "food-drink"],
  [5, "\u{1F3E0}\uFE0F", "travel-places"],
  [6, "\u26BD", "activities"],
  [7, "\u{1F4DD}", "objects"],
  [8, "\u26D4\uFE0F", "symbols"],
  [9, "\u{1F3C1}", "flags"]
].map(([id, emoji, name]) => ({ id, emoji, name }));
var groups = allGroups.slice(1);
var MIN_SEARCH_TEXT_LENGTH2 = 2;
var NUM_SKIN_TONES = 6;
var rIC = typeof requestIdleCallback === "function" ? requestIdleCallback : setTimeout;
function hasZwj(emoji) {
  return emoji.unicode.includes("\u200D");
}
var versionsAndTestEmoji = {
  "\u{1FAE9}": 16,
  // face with bags under eyes
  "\u{1FAE8}": 15.1,
  // shaking head, technically from v15 but see note above
  "\u{1FAE0}": 14,
  "\u{1F972}": 13.1,
  // smiling face with tear, technically from v13 but see note above
  "\u{1F97B}": 12.1,
  // sari, technically from v12 but see note above
  "\u{1F970}": 11,
  "\u{1F929}": 5,
  "\u{1F471}\u200D\u2640\uFE0F": 4,
  "\u{1F923}": 3,
  "\u{1F441}\uFE0F\u200D\u{1F5E8}\uFE0F": 2,
  "\u{1F600}": 1,
  "\u{1F610}\uFE0F": 0.7,
  "\u{1F603}": 0.6
};
var TIMEOUT_BEFORE_LOADING_MESSAGE = 1e3;
var DEFAULT_SKIN_TONE_EMOJI = "\u{1F590}\uFE0F";
var DEFAULT_NUM_COLUMNS = 8;
var MOST_COMMONLY_USED_EMOJI = [
  "\u{1F60A}",
  "\u{1F612}",
  "\u2764\uFE0F",
  "\u{1F44D}\uFE0F",
  "\u{1F60D}",
  "\u{1F602}",
  "\u{1F62D}",
  "\u263A\uFE0F",
  "\u{1F614}",
  "\u{1F629}",
  "\u{1F60F}",
  "\u{1F495}",
  "\u{1F64C}",
  "\u{1F618}"
];
var FONT_FAMILY = '"Twemoji Mozilla","Apple Color Emoji","Segoe UI Emoji","Segoe UI Symbol","Noto Color Emoji","EmojiOne Color","Android Emoji",sans-serif';
var DEFAULT_CATEGORY_SORTING = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var getTextFeature = (text, color) => {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", {
    // Improves the performance of `getImageData()`
    // https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/getContextAttributes#willreadfrequently
    willReadFrequently: true
  });
  ctx.textBaseline = "top";
  ctx.font = `100px ${FONT_FAMILY}`;
  ctx.fillStyle = color;
  ctx.scale(0.01, 0.01);
  ctx.fillText(text, 0, 0);
  return ctx.getImageData(0, 0, 1, 1).data;
};
var compareFeatures = (feature1, feature2) => {
  const feature1Str = [...feature1].join(",");
  const feature2Str = [...feature2].join(",");
  return feature1Str === feature2Str && !feature1Str.startsWith("0,0,0,");
};
function testColorEmojiSupported(text) {
  const feature1 = getTextFeature(text, "#000");
  const feature2 = getTextFeature(text, "#fff");
  return feature1 && feature2 && compareFeatures(feature1, feature2);
}
function determineEmojiSupportLevel() {
  const entries = Object.entries(versionsAndTestEmoji);
  try {
    for (const [emoji, version] of entries) {
      if (testColorEmojiSupported(emoji)) {
        return version;
      }
    }
  } catch (e) {
  } finally {
  }
  return entries[0][1];
}
var promise;
var detectEmojiSupportLevel = () => {
  if (!promise) {
    promise = new Promise((resolve) => rIC(() => resolve(determineEmojiSupportLevel())));
  }
  return promise;
};
var supportedZwjEmojis = /* @__PURE__ */ new Map();
var VARIATION_SELECTOR = "\uFE0F";
var SKINTONE_MODIFIER = "\uD83C";
var ZWJ = "\u200D";
var LIGHT_SKIN_TONE = 127995;
var LIGHT_SKIN_TONE_MODIFIER = 57339;
function applySkinTone(str, skinTone) {
  if (skinTone === 0) {
    return str;
  }
  const zwjIndex = str.indexOf(ZWJ);
  if (zwjIndex !== -1) {
    return str.substring(0, zwjIndex) + String.fromCodePoint(LIGHT_SKIN_TONE + skinTone - 1) + str.substring(zwjIndex);
  }
  if (str.endsWith(VARIATION_SELECTOR)) {
    str = str.substring(0, str.length - 1);
  }
  return str + SKINTONE_MODIFIER + String.fromCodePoint(LIGHT_SKIN_TONE_MODIFIER + skinTone - 1);
}
function halt(event) {
  event.preventDefault();
  event.stopPropagation();
}
function incrementOrDecrement(decrement, val, arr) {
  val += decrement ? -1 : 1;
  if (val < 0) {
    val = arr.length - 1;
  } else if (val >= arr.length) {
    val = 0;
  }
  return val;
}
function uniqBy2(arr, func) {
  const set2 = /* @__PURE__ */ new Set();
  const res = [];
  for (const item of arr) {
    const key = func(item);
    if (!set2.has(key)) {
      set2.add(key);
      res.push(item);
    }
  }
  return res;
}
function summarizeEmojisForUI(emojis, emojiSupportLevel) {
  const toSimpleSkinsMap = (skins) => {
    const res = {};
    for (const skin of skins) {
      if (typeof skin.tone === "number" && skin.version <= emojiSupportLevel) {
        res[skin.tone] = skin.unicode;
      }
    }
    return res;
  };
  return emojis.map(({ unicode, skins, shortcodes, url, name, category, annotation }) => ({
    unicode,
    name,
    shortcodes,
    url,
    category,
    annotation,
    id: unicode || name,
    skins: skins && toSimpleSkinsMap(skins)
  }));
}
var rAF = requestAnimationFrame;
var resizeObserverSupported = typeof ResizeObserver === "function";
function resizeObserverAction(node, abortSignal, onUpdate) {
  let resizeObserver;
  if (resizeObserverSupported) {
    resizeObserver = new ResizeObserver(onUpdate);
    resizeObserver.observe(node);
  } else {
    rAF(onUpdate);
  }
  abortSignal.addEventListener("abort", () => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
}
function calculateTextWidth(node) {
  {
    const range = document.createRange();
    range.selectNode(node.firstChild);
    return range.getBoundingClientRect().width;
  }
}
var baselineEmojiWidth;
function checkZwjSupport(zwjEmojisToCheck, baselineEmoji, emojiToDomNode) {
  let allSupported = true;
  for (const emoji of zwjEmojisToCheck) {
    const domNode = emojiToDomNode(emoji);
    if (!domNode) {
      continue;
    }
    const emojiWidth = calculateTextWidth(domNode);
    if (typeof baselineEmojiWidth === "undefined") {
      baselineEmojiWidth = calculateTextWidth(baselineEmoji);
    }
    const supported = emojiWidth / 1.8 < baselineEmojiWidth;
    supportedZwjEmojis.set(emoji.unicode, supported);
    if (!supported) {
      allSupported = false;
    }
  }
  return allSupported;
}
function uniq(arr) {
  return uniqBy2(arr, (_) => _);
}
function resetScrollTopIfPossible(element) {
  if (element) {
    element.scrollTop = 0;
  }
}
function getFromMap(cache, key, func) {
  let cached = cache.get(key);
  if (!cached) {
    cached = func();
    cache.set(key, cached);
  }
  return cached;
}
function toString(value) {
  return "" + value;
}
function parseTemplate(htmlString) {
  const template = document.createElement("template");
  template.innerHTML = htmlString;
  return template;
}
var parseCache = /* @__PURE__ */ new WeakMap();
var domInstancesCache = /* @__PURE__ */ new WeakMap();
var unkeyedSymbol = Symbol("un-keyed");
var hasReplaceChildren = "replaceChildren" in Element.prototype;
function replaceChildren(parentNode, newChildren) {
  if (hasReplaceChildren) {
    parentNode.replaceChildren(...newChildren);
  } else {
    parentNode.innerHTML = "";
    parentNode.append(...newChildren);
  }
}
function doChildrenNeedRerender(parentNode, newChildren) {
  let oldChild = parentNode.firstChild;
  let oldChildrenCount = 0;
  while (oldChild) {
    const newChild = newChildren[oldChildrenCount];
    if (newChild !== oldChild) {
      return true;
    }
    oldChild = oldChild.nextSibling;
    oldChildrenCount++;
  }
  return oldChildrenCount !== newChildren.length;
}
function patchChildren(newChildren, instanceBinding) {
  const { targetNode } = instanceBinding;
  let { targetParentNode } = instanceBinding;
  let needsRerender = false;
  if (targetParentNode) {
    needsRerender = doChildrenNeedRerender(targetParentNode, newChildren);
  } else {
    needsRerender = true;
    instanceBinding.targetNode = void 0;
    instanceBinding.targetParentNode = targetParentNode = targetNode.parentNode;
  }
  if (needsRerender) {
    replaceChildren(targetParentNode, newChildren);
  }
}
function patch(expressions, instanceBindings) {
  for (const instanceBinding of instanceBindings) {
    const {
      targetNode,
      currentExpression,
      binding: {
        expressionIndex,
        attributeName,
        attributeValuePre,
        attributeValuePost
      }
    } = instanceBinding;
    const expression = expressions[expressionIndex];
    if (currentExpression === expression) {
      continue;
    }
    instanceBinding.currentExpression = expression;
    if (attributeName) {
      if (expression === null) {
        targetNode.removeAttribute(attributeName);
      } else {
        const newValue = attributeValuePre + toString(expression) + attributeValuePost;
        targetNode.setAttribute(attributeName, newValue);
      }
    } else {
      let newNode;
      if (Array.isArray(expression)) {
        patchChildren(expression, instanceBinding);
      } else if (expression instanceof Element) {
        newNode = expression;
        targetNode.replaceWith(newNode);
      } else {
        targetNode.nodeValue = toString(expression);
      }
      if (newNode) {
        instanceBinding.targetNode = newNode;
      }
    }
  }
}
function parse(tokens) {
  let htmlString = "";
  let withinTag = false;
  let withinAttribute = false;
  let elementIndexCounter = -1;
  const elementsToBindings = /* @__PURE__ */ new Map();
  const elementIndexes = [];
  let skipTokenChars = 0;
  for (let i = 0, len = tokens.length; i < len; i++) {
    const token = tokens[i];
    htmlString += token.slice(skipTokenChars);
    if (i === len - 1) {
      break;
    }
    for (let j = 0; j < token.length; j++) {
      const char = token.charAt(j);
      switch (char) {
        case "<": {
          const nextChar = token.charAt(j + 1);
          if (nextChar === "/") {
            elementIndexes.pop();
          } else {
            withinTag = true;
            elementIndexes.push(++elementIndexCounter);
          }
          break;
        }
        case ">": {
          withinTag = false;
          withinAttribute = false;
          break;
        }
        case "=": {
          withinAttribute = true;
          break;
        }
      }
    }
    const elementIndex = elementIndexes[elementIndexes.length - 1];
    const bindings = getFromMap(elementsToBindings, elementIndex, () => []);
    let attributeName;
    let attributeValuePre;
    let attributeValuePost;
    if (withinAttribute) {
      const attributePreMatch = /(\S+)="?([^"=]*)$/.exec(token);
      attributeName = attributePreMatch[1];
      attributeValuePre = attributePreMatch[2];
      const attributePostMatch = /^([^">]*)("?)/.exec(tokens[i + 1]);
      attributeValuePost = attributePostMatch[1];
      htmlString = htmlString.slice(0, -1 * attributePreMatch[0].length);
      skipTokenChars = attributePostMatch[0].length;
    } else {
      skipTokenChars = 0;
    }
    const binding = {
      attributeName,
      attributeValuePre,
      attributeValuePost,
      expressionIndex: i
    };
    bindings.push(binding);
    if (!withinTag && !withinAttribute) {
      htmlString += " ";
    }
  }
  const template = parseTemplate(htmlString);
  return {
    template,
    elementsToBindings
  };
}
function applyBindings(bindings, element, instanceBindings) {
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i];
    const targetNode = binding.attributeName ? element : element.firstChild;
    const instanceBinding = {
      binding,
      targetNode,
      targetParentNode: void 0,
      currentExpression: void 0
    };
    instanceBindings.push(instanceBinding);
  }
}
function traverseAndSetupBindings(rootElement, elementsToBindings) {
  const instanceBindings = [];
  let topLevelBindings;
  if (elementsToBindings.size === 1 && (topLevelBindings = elementsToBindings.get(0))) {
    applyBindings(topLevelBindings, rootElement, instanceBindings);
  } else {
    const treeWalker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT);
    let element = rootElement;
    let elementIndex = -1;
    do {
      const bindings = elementsToBindings.get(++elementIndex);
      if (bindings) {
        applyBindings(bindings, element, instanceBindings);
      }
    } while (element = treeWalker.nextNode());
  }
  return instanceBindings;
}
function parseHtml(tokens) {
  const { template, elementsToBindings } = getFromMap(parseCache, tokens, () => parse(tokens));
  const dom = template.cloneNode(true).content.firstElementChild;
  const instanceBindings = traverseAndSetupBindings(dom, elementsToBindings);
  return function updateDomInstance(expressions) {
    patch(expressions, instanceBindings);
    return dom;
  };
}
function createFramework(state) {
  const domInstances = getFromMap(domInstancesCache, state, () => /* @__PURE__ */ new Map());
  let domInstanceCacheKey = unkeyedSymbol;
  function html(tokens, ...expressions) {
    const domInstancesForTokens = getFromMap(domInstances, tokens, () => /* @__PURE__ */ new Map());
    const updateDomInstance = getFromMap(domInstancesForTokens, domInstanceCacheKey, () => parseHtml(tokens));
    return updateDomInstance(expressions);
  }
  function map(array, callback, keyFunction) {
    return array.map((item, index) => {
      const originalCacheKey = domInstanceCacheKey;
      domInstanceCacheKey = keyFunction(item);
      try {
        return callback(item, index);
      } finally {
        domInstanceCacheKey = originalCacheKey;
      }
    });
  }
  return { map, html };
}
function render(container, state, helpers, events, actions, refs, abortSignal, actionContext, firstRender) {
  const { labelWithSkin, titleForEmoji, unicodeWithSkin } = helpers;
  const { html, map } = createFramework(state);
  function emojiList(emojis, searchMode, prefix) {
    return map(emojis, (emoji, i) => {
      return html`<button role="${searchMode ? "option" : "menuitem"}" aria-selected="${searchMode ? i === state.activeSearchItem : null}" aria-label="${labelWithSkin(emoji, state.currentSkinTone)}" title="${titleForEmoji(emoji)}" class="${"emoji" + (searchMode && i === state.activeSearchItem ? " active" : "") + (emoji.unicode ? "" : " custom-emoji")}" id="${`${prefix}-${emoji.id}`}" style="${emoji.unicode ? null : `--custom-emoji-background: url(${JSON.stringify(emoji.url)})`}">${emoji.unicode ? unicodeWithSkin(emoji, state.currentSkinTone) : ""}</button>`;
    }, (emoji) => `${prefix}-${emoji.id}`);
  }
  const section = () => {
    return html`<section data-ref="rootElement" class="picker" aria-label="${state.i18n.regionLabel}" style="${state.pickerStyle || ""}"><div class="pad-top"></div><div class="search-row"><div class="search-wrapper"><input id="search" class="search" type="search" role="combobox" enterkeyhint="search" placeholder="${state.i18n.searchLabel}" autocapitalize="none" autocomplete="off" spellcheck="true" aria-expanded="${!!(state.searchMode && state.currentEmojis.length)}" aria-controls="search-results" aria-describedby="search-description" aria-autocomplete="list" aria-activedescendant="${state.activeSearchItemId ? `emo-${state.activeSearchItemId}` : null}" data-ref="searchElement" data-on-input="onSearchInput" data-on-keydown="onSearchKeydown"><label class="sr-only" for="search">${state.i18n.searchLabel}</label> <span id="search-description" class="sr-only">${state.i18n.searchDescription}</span></div><div class="skintone-button-wrapper ${state.skinTonePickerExpandedAfterAnimation ? "expanded" : ""}"><button id="skintone-button" class="emoji ${state.skinTonePickerExpanded ? "hide-focus" : ""}" aria-label="${state.skinToneButtonLabel}" title="${state.skinToneButtonLabel}" aria-describedby="skintone-description" aria-haspopup="listbox" aria-expanded="${state.skinTonePickerExpanded}" aria-controls="skintone-list" data-on-click="onClickSkinToneButton">${state.skinToneButtonText || ""}</button></div><span id="skintone-description" class="sr-only">${state.i18n.skinToneDescription}</span><div data-ref="skinToneDropdown" id="skintone-list" class="skintone-list hide-focus ${state.skinTonePickerExpanded ? "" : "hidden no-animate"}" style="transform:translateY(${state.skinTonePickerExpanded ? 0 : "calc(-1 * var(--num-skintones) * var(--total-emoji-size))"})" role="listbox" aria-label="${state.i18n.skinTonesLabel}" aria-activedescendant="skintone-${state.activeSkinTone}" aria-hidden="${!state.skinTonePickerExpanded}" tabIndex="-1" data-on-focusout="onSkinToneOptionsFocusOut" data-on-click="onSkinToneOptionsClick" data-on-keydown="onSkinToneOptionsKeydown" data-on-keyup="onSkinToneOptionsKeyup">${map(state.skinTones, (skinTone, i) => {
      return html`<div id="skintone-${i}" class="emoji ${i === state.activeSkinTone ? "active" : ""}" aria-selected="${i === state.activeSkinTone}" role="option" title="${state.i18n.skinTones[i]}" aria-label="${state.i18n.skinTones[i]}">${skinTone}</div>`;
    }, (skinTone) => skinTone)}</div></div><div class="nav" role="tablist" style="grid-template-columns:repeat(${state.groups.length},1fr)" aria-label="${state.i18n.categoriesLabel}" data-on-keydown="onNavKeydown" data-on-click="onNavClick">${map(state.groups, (group) => {
      return html`<button role="tab" class="nav-button" aria-controls="tab-${group.id}" aria-label="${state.i18n.categories[group.name]}" aria-selected="${!state.searchMode && state.currentGroup.id === group.id}" title="${state.i18n.categories[group.name]}" data-group-id="${group.id}"><div class="nav-emoji emoji">${group.emoji}</div></button>`;
    }, (group) => group.id)}</div><div class="indicator-wrapper"><div class="indicator" style="transform:translateX(${/* istanbul ignore next */
    (state.isRtl ? -1 : 1) * state.currentGroupIndex * 100}%)"></div></div><div class="message ${state.message ? "" : "gone"}" role="alert" aria-live="polite">${state.message || ""}</div><div data-ref="tabpanelElement" class="tabpanel ${!state.databaseLoaded || state.message ? "gone" : ""}" role="${state.searchMode ? "region" : "tabpanel"}" aria-label="${state.searchMode ? state.i18n.searchResultsLabel : state.i18n.categories[state.currentGroup.name]}" id="${state.searchMode ? null : `tab-${state.currentGroup.id}`}" tabIndex="0" data-on-click="onEmojiClick"><div data-action="calculateEmojiGridStyle">${map(state.currentEmojisWithCategories, (emojiWithCategory, i) => {
      return html`<div><div id="menu-label-${i}" class="category ${state.currentEmojisWithCategories.length === 1 && state.currentEmojisWithCategories[0].category === "" ? "gone" : ""}" aria-hidden="true">${state.searchMode ? state.i18n.searchResultsLabel : emojiWithCategory.category ? emojiWithCategory.category : state.currentEmojisWithCategories.length > 1 ? state.i18n.categories.custom : state.i18n.categories[state.currentGroup.name]}</div><div class="emoji-menu ${i !== 0 && !state.searchMode && state.currentGroup.id === -1 ? "visibility-auto" : ""}" style="${`--num-rows: ${Math.ceil(emojiWithCategory.emojis.length / state.numColumns)}`}" data-action="updateOnIntersection" role="${state.searchMode ? "listbox" : "menu"}" aria-labelledby="menu-label-${i}" id="${state.searchMode ? "search-results" : null}">${emojiList(
        emojiWithCategory.emojis,
        state.searchMode,
        /* prefix */
        "emo"
      )}</div></div>`;
    }, (emojiWithCategory) => emojiWithCategory.category)}</div></div><div class="favorites onscreen emoji-menu ${state.message ? "gone" : ""}" role="menu" aria-label="${state.i18n.favoritesLabel}" data-on-click="onEmojiClick">${emojiList(
      state.currentFavorites,
      /* searchMode */
      false,
      /* prefix */
      "fav"
    )}</div><button data-ref="baselineEmoji" aria-hidden="true" tabindex="-1" class="abs-pos hidden emoji baseline-emoji">😀</button></section>`;
  };
  const rootDom = section();
  const forElementWithAttribute = (attributeName, callback) => {
    for (const element of container.querySelectorAll(`[${attributeName}]`)) {
      callback(element, element.getAttribute(attributeName));
    }
  };
  if (firstRender) {
    container.appendChild(rootDom);
    for (const eventName of ["click", "focusout", "input", "keydown", "keyup"]) {
      forElementWithAttribute(`data-on-${eventName}`, (element, listenerName) => {
        element.addEventListener(eventName, events[listenerName]);
      });
    }
    forElementWithAttribute("data-ref", (element, ref) => {
      refs[ref] = element;
    });
    abortSignal.addEventListener("abort", () => {
      container.removeChild(rootDom);
    });
  }
  forElementWithAttribute("data-action", (element, action) => {
    let boundActions = actionContext.get(action);
    if (!boundActions) {
      actionContext.set(action, boundActions = /* @__PURE__ */ new WeakSet());
    }
    if (!boundActions.has(element)) {
      boundActions.add(element);
      actions[action](element);
    }
  });
}
var qM = typeof queueMicrotask === "function" ? queueMicrotask : (callback) => Promise.resolve().then(callback);
function createState(abortSignal) {
  let destroyed = false;
  let currentObserver;
  const propsToObservers = /* @__PURE__ */ new Map();
  const dirtyObservers = /* @__PURE__ */ new Set();
  let queued;
  const flush = () => {
    if (destroyed) {
      return;
    }
    const observersToRun = [...dirtyObservers];
    dirtyObservers.clear();
    try {
      for (const observer of observersToRun) {
        observer();
      }
    } finally {
      queued = false;
      if (dirtyObservers.size) {
        queued = true;
        qM(flush);
      }
    }
  };
  const state = new Proxy({}, {
    get(target, prop) {
      if (currentObserver) {
        let observers = propsToObservers.get(prop);
        if (!observers) {
          observers = /* @__PURE__ */ new Set();
          propsToObservers.set(prop, observers);
        }
        observers.add(currentObserver);
      }
      return target[prop];
    },
    set(target, prop, newValue) {
      if (target[prop] !== newValue) {
        target[prop] = newValue;
        const observers = propsToObservers.get(prop);
        if (observers) {
          for (const observer of observers) {
            dirtyObservers.add(observer);
          }
          if (!queued) {
            queued = true;
            qM(flush);
          }
        }
      }
      return true;
    }
  });
  const createEffect = (callback) => {
    const runnable = () => {
      const oldObserver = currentObserver;
      currentObserver = runnable;
      try {
        return callback();
      } finally {
        currentObserver = oldObserver;
      }
    };
    return runnable();
  };
  abortSignal.addEventListener("abort", () => {
    destroyed = true;
  });
  return {
    state,
    createEffect
  };
}
function arraysAreEqualByFunction(left, right, areEqualFunc) {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i++) {
    if (!areEqualFunc(left[i], right[i])) {
      return false;
    }
  }
  return true;
}
var intersectionObserverCache = /* @__PURE__ */ new WeakMap();
function intersectionObserverAction(node, abortSignal, listener) {
  {
    const root = node.closest(".tabpanel");
    let observer = intersectionObserverCache.get(root);
    if (!observer) {
      observer = new IntersectionObserver(listener, {
        root,
        // trigger if we are 1/2 scroll container height away so that the images load a bit quicker while scrolling
        rootMargin: "50% 0px 50% 0px",
        // trigger if any part of the emoji grid is intersecting
        threshold: 0
      });
      intersectionObserverCache.set(root, observer);
      abortSignal.addEventListener("abort", () => {
        observer.disconnect();
      });
    }
    observer.observe(node);
  }
}
var EMPTY_ARRAY = [];
var { assign } = Object;
function createRoot(shadowRoot, props) {
  const refs = {};
  const abortController = new AbortController();
  const abortSignal = abortController.signal;
  const { state, createEffect } = createState(abortSignal);
  const actionContext = /* @__PURE__ */ new Map();
  assign(state, {
    skinToneEmoji: void 0,
    i18n: void 0,
    database: void 0,
    customEmoji: void 0,
    customCategorySorting: void 0,
    emojiVersion: void 0
  });
  assign(state, props);
  assign(state, {
    initialLoad: true,
    currentEmojis: [],
    currentEmojisWithCategories: [],
    rawSearchText: "",
    searchText: "",
    searchMode: false,
    activeSearchItem: -1,
    message: void 0,
    skinTonePickerExpanded: false,
    skinTonePickerExpandedAfterAnimation: false,
    currentSkinTone: 0,
    activeSkinTone: 0,
    skinToneButtonText: void 0,
    pickerStyle: void 0,
    skinToneButtonLabel: "",
    skinTones: [],
    currentFavorites: [],
    defaultFavoriteEmojis: void 0,
    numColumns: DEFAULT_NUM_COLUMNS,
    isRtl: false,
    currentGroupIndex: 0,
    groups,
    databaseLoaded: false,
    activeSearchItemId: void 0
  });
  createEffect(() => {
    if (state.currentGroup !== state.groups[state.currentGroupIndex]) {
      state.currentGroup = state.groups[state.currentGroupIndex];
    }
  });
  const focus = (id) => {
    shadowRoot.getElementById(id).focus();
  };
  const emojiToDomNode = (emoji) => shadowRoot.getElementById(`emo-${emoji.id}`);
  const fireEvent = (name, detail) => {
    refs.rootElement.dispatchEvent(new CustomEvent(name, {
      detail,
      bubbles: true,
      composed: true
    }));
  };
  const compareEmojiArrays = (a, b) => a.id === b.id;
  const compareCurrentEmojisWithCategories = (a, b) => {
    const { category: aCategory, emojis: aEmojis } = a;
    const { category: bCategory, emojis: bEmojis } = b;
    if (aCategory !== bCategory) {
      return false;
    }
    return arraysAreEqualByFunction(aEmojis, bEmojis, compareEmojiArrays);
  };
  const updateCurrentEmojis = (newEmojis) => {
    if (!arraysAreEqualByFunction(state.currentEmojis, newEmojis, compareEmojiArrays)) {
      state.currentEmojis = newEmojis;
    }
  };
  const updateSearchMode = (newSearchMode) => {
    if (state.searchMode !== newSearchMode) {
      state.searchMode = newSearchMode;
    }
  };
  const updateCurrentEmojisWithCategories = (newEmojisWithCategories) => {
    if (!arraysAreEqualByFunction(state.currentEmojisWithCategories, newEmojisWithCategories, compareCurrentEmojisWithCategories)) {
      state.currentEmojisWithCategories = newEmojisWithCategories;
    }
  };
  const unicodeWithSkin = (emoji, currentSkinTone) => currentSkinTone && emoji.skins && emoji.skins[currentSkinTone] || emoji.unicode;
  const labelWithSkin = (emoji, currentSkinTone) => uniq([
    emoji.name || unicodeWithSkin(emoji, currentSkinTone),
    emoji.annotation,
    ...emoji.shortcodes || EMPTY_ARRAY
  ].filter(Boolean)).join(", ");
  const titleForEmoji = (emoji) => emoji.annotation || (emoji.shortcodes || EMPTY_ARRAY).join(", ");
  const helpers = {
    labelWithSkin,
    titleForEmoji,
    unicodeWithSkin
  };
  const events = {
    onClickSkinToneButton,
    onEmojiClick,
    onNavClick,
    onNavKeydown,
    onSearchKeydown,
    onSkinToneOptionsClick,
    onSkinToneOptionsFocusOut,
    onSkinToneOptionsKeydown,
    onSkinToneOptionsKeyup,
    onSearchInput
  };
  const actions = {
    calculateEmojiGridStyle,
    updateOnIntersection
  };
  let firstRender = true;
  createEffect(() => {
    render(shadowRoot, state, helpers, events, actions, refs, abortSignal, actionContext, firstRender);
    firstRender = false;
  });
  if (!state.emojiVersion) {
    detectEmojiSupportLevel().then((level) => {
      if (!level) {
        state.message = state.i18n.emojiUnsupportedMessage;
      }
    });
  }
  createEffect(() => {
    async function handleDatabaseLoading() {
      let showingLoadingMessage = false;
      const timeoutHandle = setTimeout(() => {
        showingLoadingMessage = true;
        state.message = state.i18n.loadingMessage;
      }, TIMEOUT_BEFORE_LOADING_MESSAGE);
      try {
        await state.database.ready();
        state.databaseLoaded = true;
      } catch (err) {
        console.error(err);
        state.message = state.i18n.networkErrorMessage;
      } finally {
        clearTimeout(timeoutHandle);
        if (showingLoadingMessage) {
          showingLoadingMessage = false;
          state.message = "";
        }
      }
    }
    if (state.database) {
      handleDatabaseLoading();
    }
  });
  createEffect(() => {
    state.pickerStyle = `
      --num-groups: ${state.groups.length}; 
      --indicator-opacity: ${state.searchMode ? 0 : 1}; 
      --num-skintones: ${NUM_SKIN_TONES};`;
  });
  createEffect(() => {
    if (state.customEmoji && state.database) {
      updateCustomEmoji();
    }
  });
  createEffect(() => {
    if (state.customEmoji && state.customEmoji.length) {
      if (state.groups !== allGroups) {
        state.groups = allGroups;
      }
    } else if (state.groups !== groups) {
      if (state.currentGroupIndex) {
        state.currentGroupIndex--;
      }
      state.groups = groups;
    }
  });
  createEffect(() => {
    async function updatePreferredSkinTone() {
      if (state.databaseLoaded) {
        state.currentSkinTone = await state.database.getPreferredSkinTone();
      }
    }
    updatePreferredSkinTone();
  });
  createEffect(() => {
    state.skinTones = Array(NUM_SKIN_TONES).fill().map((_, i) => applySkinTone(state.skinToneEmoji, i));
  });
  createEffect(() => {
    state.skinToneButtonText = state.skinTones[state.currentSkinTone];
  });
  createEffect(() => {
    state.skinToneButtonLabel = state.i18n.skinToneLabel.replace("{skinTone}", state.i18n.skinTones[state.currentSkinTone]);
  });
  createEffect(() => {
    async function updateDefaultFavoriteEmojis() {
      const { database } = state;
      const favs = (await Promise.all(MOST_COMMONLY_USED_EMOJI.map((unicode) => database.getEmojiByUnicodeOrName(unicode)))).filter(Boolean);
      state.defaultFavoriteEmojis = favs;
    }
    if (state.databaseLoaded) {
      updateDefaultFavoriteEmojis();
    }
  });
  function updateCustomEmoji() {
    const { customEmoji, database } = state;
    const databaseCustomEmoji = customEmoji || EMPTY_ARRAY;
    if (database.customEmoji !== databaseCustomEmoji) {
      database.customEmoji = databaseCustomEmoji;
    }
  }
  createEffect(() => {
    async function updateFavorites() {
      updateCustomEmoji();
      const { database, defaultFavoriteEmojis, numColumns } = state;
      const dbFavorites = await database.getTopFavoriteEmoji(numColumns);
      const favorites = await summarizeEmojis(uniqBy2([
        ...dbFavorites,
        ...defaultFavoriteEmojis
      ], (_) => _.unicode || _.name).slice(0, numColumns));
      state.currentFavorites = favorites;
    }
    if (state.databaseLoaded && state.defaultFavoriteEmojis) {
      updateFavorites();
    }
  });
  function calculateEmojiGridStyle(node) {
    resizeObserverAction(node, abortSignal, () => {
      {
        const style = getComputedStyle(refs.rootElement);
        const newNumColumns = parseInt(style.getPropertyValue("--num-columns"), 10);
        const newIsRtl = style.getPropertyValue("direction") === "rtl";
        state.numColumns = newNumColumns;
        state.isRtl = newIsRtl;
      }
    });
  }
  function updateOnIntersection(node) {
    intersectionObserverAction(node, abortSignal, (entries) => {
      for (const { target, isIntersecting } of entries) {
        target.classList.toggle("onscreen", isIntersecting);
      }
    });
  }
  createEffect(() => {
    async function updateEmojis() {
      const { searchText, currentGroup, databaseLoaded, customEmoji } = state;
      if (!databaseLoaded) {
        state.currentEmojis = [];
        state.searchMode = false;
      } else if (searchText.length >= MIN_SEARCH_TEXT_LENGTH2) {
        const newEmojis = await getEmojisBySearchQuery(searchText);
        if (state.searchText === searchText) {
          updateCurrentEmojis(newEmojis);
          updateSearchMode(true);
        }
      } else {
        const { id: currentGroupId } = currentGroup;
        if (currentGroupId !== -1 || customEmoji && customEmoji.length) {
          const newEmojis = await getEmojisByGroup(currentGroupId);
          if (state.currentGroup.id === currentGroupId) {
            updateCurrentEmojis(newEmojis);
            updateSearchMode(false);
          }
        }
      }
    }
    updateEmojis();
  });
  const resetScrollTopInRaf = () => {
    rAF(() => resetScrollTopIfPossible(refs.tabpanelElement));
  };
  createEffect(() => {
    const { currentEmojis, emojiVersion } = state;
    const zwjEmojisToCheck = currentEmojis.filter((emoji) => emoji.unicode).filter((emoji) => hasZwj(emoji) && !supportedZwjEmojis.has(emoji.unicode));
    if (!emojiVersion && zwjEmojisToCheck.length) {
      updateCurrentEmojis(currentEmojis);
      rAF(() => checkZwjSupportAndUpdate(zwjEmojisToCheck));
    } else {
      const newEmojis = emojiVersion ? currentEmojis : currentEmojis.filter(isZwjSupported);
      updateCurrentEmojis(newEmojis);
      resetScrollTopInRaf();
    }
  });
  function checkZwjSupportAndUpdate(zwjEmojisToCheck) {
    const allSupported = checkZwjSupport(zwjEmojisToCheck, refs.baselineEmoji, emojiToDomNode);
    if (allSupported) {
      resetScrollTopInRaf();
    } else {
      state.currentEmojis = [...state.currentEmojis];
    }
  }
  function isZwjSupported(emoji) {
    return !emoji.unicode || !hasZwj(emoji) || supportedZwjEmojis.get(emoji.unicode);
  }
  async function filterEmojisByVersion(emojis) {
    const emojiSupportLevel = state.emojiVersion || await detectEmojiSupportLevel();
    return emojis.filter(({ version }) => !version || version <= emojiSupportLevel);
  }
  async function summarizeEmojis(emojis) {
    return summarizeEmojisForUI(emojis, state.emojiVersion || await detectEmojiSupportLevel());
  }
  async function getEmojisByGroup(group) {
    const emoji = group === -1 ? state.customEmoji : await state.database.getEmojiByGroup(group);
    return summarizeEmojis(await filterEmojisByVersion(emoji));
  }
  async function getEmojisBySearchQuery(query) {
    return summarizeEmojis(await filterEmojisByVersion(await state.database.getEmojiBySearchQuery(query)));
  }
  createEffect(() => {
  });
  createEffect(() => {
    function calculateCurrentEmojisWithCategories() {
      const { searchMode, currentEmojis } = state;
      if (searchMode) {
        return [
          {
            category: "",
            emojis: currentEmojis
          }
        ];
      }
      const categoriesToEmoji = /* @__PURE__ */ new Map();
      for (const emoji of currentEmojis) {
        const category = emoji.category || "";
        let emojis = categoriesToEmoji.get(category);
        if (!emojis) {
          emojis = [];
          categoriesToEmoji.set(category, emojis);
        }
        emojis.push(emoji);
      }
      return [...categoriesToEmoji.entries()].map(([category, emojis]) => ({ category, emojis })).sort((a, b) => state.customCategorySorting(a.category, b.category));
    }
    const newEmojisWithCategories = calculateCurrentEmojisWithCategories();
    updateCurrentEmojisWithCategories(newEmojisWithCategories);
  });
  createEffect(() => {
    state.activeSearchItemId = state.activeSearchItem !== -1 && state.currentEmojis[state.activeSearchItem].id;
  });
  createEffect(() => {
    const { rawSearchText } = state;
    rIC(() => {
      state.searchText = (rawSearchText || "").trim();
      state.activeSearchItem = -1;
    });
  });
  function onSearchKeydown(event) {
    if (!state.searchMode || !state.currentEmojis.length) {
      return;
    }
    const goToNextOrPrevious = (previous) => {
      halt(event);
      state.activeSearchItem = incrementOrDecrement(previous, state.activeSearchItem, state.currentEmojis);
    };
    switch (event.key) {
      case "ArrowDown":
        return goToNextOrPrevious(false);
      case "ArrowUp":
        return goToNextOrPrevious(true);
      case "Enter":
        if (state.activeSearchItem === -1) {
          state.activeSearchItem = 0;
        } else {
          halt(event);
          return clickEmoji(state.currentEmojis[state.activeSearchItem].id);
        }
    }
  }
  function onNavClick(event) {
    const { target } = event;
    const closestTarget = target.closest(".nav-button");
    if (!closestTarget) {
      return;
    }
    const groupId = parseInt(closestTarget.dataset.groupId, 10);
    refs.searchElement.value = "";
    state.rawSearchText = "";
    state.searchText = "";
    state.activeSearchItem = -1;
    state.currentGroupIndex = state.groups.findIndex((_) => _.id === groupId);
  }
  function onNavKeydown(event) {
    const { target, key } = event;
    const doFocus = (el) => {
      if (el) {
        halt(event);
        el.focus();
      }
    };
    switch (key) {
      case "ArrowLeft":
        return doFocus(target.previousElementSibling);
      case "ArrowRight":
        return doFocus(target.nextElementSibling);
      case "Home":
        return doFocus(target.parentElement.firstElementChild);
      case "End":
        return doFocus(target.parentElement.lastElementChild);
    }
  }
  async function getDetailForClickEvent(unicodeOrName) {
    const emoji = await state.database.getEmojiByUnicodeOrName(unicodeOrName);
    const emojiSummary = [...state.currentEmojis, ...state.currentFavorites].find((_) => _.id === unicodeOrName);
    const skinTonedUnicode = emojiSummary.unicode && unicodeWithSkin(emojiSummary, state.currentSkinTone);
    await state.database.incrementFavoriteEmojiCount(unicodeOrName);
    return {
      emoji,
      skinTone: state.currentSkinTone,
      ...skinTonedUnicode && { unicode: skinTonedUnicode },
      ...emojiSummary.name && { name: emojiSummary.name }
    };
  }
  async function clickEmoji(unicodeOrName) {
    const promiseForDetail = getDetailForClickEvent(unicodeOrName);
    fireEvent("emoji-click-sync", promiseForDetail);
    fireEvent("emoji-click", await promiseForDetail);
  }
  function onEmojiClick(event) {
    const { target } = event;
    if (!target.classList.contains("emoji")) {
      return;
    }
    halt(event);
    const id = target.id.substring(4);
    clickEmoji(id);
  }
  function changeSkinTone(skinTone) {
    state.currentSkinTone = skinTone;
    state.skinTonePickerExpanded = false;
    focus("skintone-button");
    fireEvent("skin-tone-change", { skinTone });
    state.database.setPreferredSkinTone(skinTone);
  }
  function onSkinToneOptionsClick(event) {
    const { target: { id } } = event;
    const match = id && id.match(/^skintone-(\d)/);
    if (!match) {
      return;
    }
    halt(event);
    const skinTone = parseInt(match[1], 10);
    changeSkinTone(skinTone);
  }
  function onClickSkinToneButton(event) {
    state.skinTonePickerExpanded = !state.skinTonePickerExpanded;
    state.activeSkinTone = state.currentSkinTone;
    if (state.skinTonePickerExpanded) {
      halt(event);
      rAF(() => focus("skintone-list"));
    }
  }
  createEffect(() => {
    if (state.skinTonePickerExpanded) {
      refs.skinToneDropdown.addEventListener("transitionend", () => {
        state.skinTonePickerExpandedAfterAnimation = true;
      }, { once: true });
    } else {
      state.skinTonePickerExpandedAfterAnimation = false;
    }
  });
  function onSkinToneOptionsKeydown(event) {
    if (!state.skinTonePickerExpanded) {
      return;
    }
    const changeActiveSkinTone = async (nextSkinTone) => {
      halt(event);
      state.activeSkinTone = nextSkinTone;
    };
    switch (event.key) {
      case "ArrowUp":
        return changeActiveSkinTone(incrementOrDecrement(true, state.activeSkinTone, state.skinTones));
      case "ArrowDown":
        return changeActiveSkinTone(incrementOrDecrement(false, state.activeSkinTone, state.skinTones));
      case "Home":
        return changeActiveSkinTone(0);
      case "End":
        return changeActiveSkinTone(state.skinTones.length - 1);
      case "Enter":
        halt(event);
        return changeSkinTone(state.activeSkinTone);
      case "Escape":
        halt(event);
        state.skinTonePickerExpanded = false;
        return focus("skintone-button");
    }
  }
  function onSkinToneOptionsKeyup(event) {
    if (!state.skinTonePickerExpanded) {
      return;
    }
    switch (event.key) {
      case " ":
        halt(event);
        return changeSkinTone(state.activeSkinTone);
    }
  }
  async function onSkinToneOptionsFocusOut(event) {
    const { relatedTarget } = event;
    if (!relatedTarget || relatedTarget.id !== "skintone-list") {
      state.skinTonePickerExpanded = false;
    }
  }
  function onSearchInput(event) {
    state.rawSearchText = event.target.value;
  }
  return {
    $set(newState) {
      assign(state, newState);
    },
    $destroy() {
      abortController.abort();
    }
  };
}
var DEFAULT_DATA_SOURCE2 = "https://cdn.jsdelivr.net/npm/emoji-picker-element-data@^1/en/emojibase/data.json";
var DEFAULT_LOCALE2 = "en";
var enI18n = {
  categoriesLabel: "Categories",
  emojiUnsupportedMessage: "Your browser does not support color emoji.",
  favoritesLabel: "Favorites",
  loadingMessage: "Loading\u2026",
  networkErrorMessage: "Could not load emoji.",
  regionLabel: "Emoji picker",
  searchDescription: "When search results are available, press up or down to select and enter to choose.",
  searchLabel: "Search",
  searchResultsLabel: "Search results",
  skinToneDescription: "When expanded, press up or down to select and enter to choose.",
  skinToneLabel: "Choose a skin tone (currently {skinTone})",
  skinTonesLabel: "Skin tones",
  skinTones: [
    "Default",
    "Light",
    "Medium-Light",
    "Medium",
    "Medium-Dark",
    "Dark"
  ],
  categories: {
    custom: "Custom",
    "smileys-emotion": "Smileys and emoticons",
    "people-body": "People and body",
    "animals-nature": "Animals and nature",
    "food-drink": "Food and drink",
    "travel-places": "Travel and places",
    activities: "Activities",
    objects: "Objects",
    symbols: "Symbols",
    flags: "Flags"
  }
};
var baseStyles = ':host{--emoji-size:1.375rem;--emoji-padding:0.5rem;--category-emoji-size:var(--emoji-size);--category-emoji-padding:var(--emoji-padding);--indicator-height:3px;--input-border-radius:0.5rem;--input-border-size:1px;--input-font-size:1rem;--input-line-height:1.5;--input-padding:0.25rem;--num-columns:8;--outline-size:2px;--border-size:1px;--border-radius:0;--skintone-border-radius:1rem;--category-font-size:1rem;display:flex;width:min-content;height:400px}:host,:host(.light){color-scheme:light;--background:#fff;--border-color:#e0e0e0;--indicator-color:#385ac1;--input-border-color:#999;--input-font-color:#111;--input-placeholder-color:#999;--outline-color:#999;--category-font-color:#111;--button-active-background:#e6e6e6;--button-hover-background:#d9d9d9}:host(.dark){color-scheme:dark;--background:#222;--border-color:#444;--indicator-color:#5373ec;--input-border-color:#ccc;--input-font-color:#efefef;--input-placeholder-color:#ccc;--outline-color:#fff;--category-font-color:#efefef;--button-active-background:#555555;--button-hover-background:#484848}@media (prefers-color-scheme:dark){:host{color-scheme:dark;--background:#222;--border-color:#444;--indicator-color:#5373ec;--input-border-color:#ccc;--input-font-color:#efefef;--input-placeholder-color:#ccc;--outline-color:#fff;--category-font-color:#efefef;--button-active-background:#555555;--button-hover-background:#484848}}:host([hidden]){display:none}button{margin:0;padding:0;border:0;background:0 0;box-shadow:none;-webkit-tap-highlight-color:transparent}button::-moz-focus-inner{border:0}input{padding:0;margin:0;line-height:1.15;font-family:inherit}input[type=search]{-webkit-appearance:none}:focus{outline:var(--outline-color) solid var(--outline-size);outline-offset:calc(-1*var(--outline-size))}:host([data-js-focus-visible]) :focus:not([data-focus-visible-added]){outline:0}:focus:not(:focus-visible){outline:0}.hide-focus{outline:0}*{box-sizing:border-box}.picker{contain:content;display:flex;flex-direction:column;background:var(--background);border:var(--border-size) solid var(--border-color);border-radius:var(--border-radius);width:100%;height:100%;overflow:hidden;--total-emoji-size:calc(var(--emoji-size) + (2 * var(--emoji-padding)));--total-category-emoji-size:calc(var(--category-emoji-size) + (2 * var(--category-emoji-padding)))}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}.hidden{opacity:0;pointer-events:none}.abs-pos{position:absolute;left:0;top:0}.gone{display:none!important}.skintone-button-wrapper,.skintone-list{background:var(--background);z-index:3}.skintone-button-wrapper.expanded{z-index:1}.skintone-list{position:absolute;inset-inline-end:0;top:0;z-index:2;overflow:visible;border-bottom:var(--border-size) solid var(--border-color);border-radius:0 0 var(--skintone-border-radius) var(--skintone-border-radius);will-change:transform;transition:transform .2s ease-in-out;transform-origin:center 0}@media (prefers-reduced-motion:reduce){.skintone-list{transition-duration:.001s}}@supports not (inset-inline-end:0){.skintone-list{right:0}}.skintone-list.no-animate{transition:none}.tabpanel{overflow-y:auto;scrollbar-gutter:stable;-webkit-overflow-scrolling:touch;will-change:transform;min-height:0;flex:1;contain:content}.emoji-menu{display:grid;grid-template-columns:repeat(var(--num-columns),var(--total-emoji-size));justify-content:space-around;align-items:flex-start;width:100%}.emoji-menu.visibility-auto{content-visibility:auto;contain-intrinsic-size:calc(var(--num-columns)*var(--total-emoji-size)) calc(var(--num-rows)*var(--total-emoji-size))}.category{padding:var(--emoji-padding);font-size:var(--category-font-size);color:var(--category-font-color)}.emoji,button.emoji{font-size:var(--emoji-size);display:flex;align-items:center;justify-content:center;border-radius:100%;height:var(--total-emoji-size);width:var(--total-emoji-size);line-height:1;overflow:hidden;font-family:var(--emoji-font-family);cursor:pointer}@media (hover:hover) and (pointer:fine){.emoji:hover,button.emoji:hover{background:var(--button-hover-background)}}.emoji.active,.emoji:active,button.emoji.active,button.emoji:active{background:var(--button-active-background)}.onscreen .custom-emoji::after{content:"";width:var(--emoji-size);height:var(--emoji-size);background-repeat:no-repeat;background-position:center center;background-size:contain;background-image:var(--custom-emoji-background)}.nav,.nav-button{align-items:center}.nav{display:grid;justify-content:space-between;contain:content}.nav-button{display:flex;justify-content:center}.nav-emoji{font-size:var(--category-emoji-size);width:var(--total-category-emoji-size);height:var(--total-category-emoji-size)}.indicator-wrapper{display:flex;border-bottom:1px solid var(--border-color)}.indicator{width:calc(100%/var(--num-groups));height:var(--indicator-height);opacity:var(--indicator-opacity);background-color:var(--indicator-color);will-change:transform,opacity;transition:opacity .1s linear,transform .25s ease-in-out}@media (prefers-reduced-motion:reduce){.indicator{will-change:opacity;transition:opacity .1s linear}}.pad-top,input.search{background:var(--background);width:100%}.pad-top{height:var(--emoji-padding);z-index:3}.search-row{display:flex;align-items:center;position:relative;padding-inline-start:var(--emoji-padding);padding-bottom:var(--emoji-padding)}.search-wrapper{flex:1;min-width:0}input.search{padding:var(--input-padding);border-radius:var(--input-border-radius);border:var(--input-border-size) solid var(--input-border-color);color:var(--input-font-color);font-size:var(--input-font-size);line-height:var(--input-line-height)}input.search::placeholder{color:var(--input-placeholder-color)}.favorites{overflow-y:auto;scrollbar-gutter:stable;display:flex;flex-direction:row;border-top:var(--border-size) solid var(--border-color);contain:content}.message{padding:var(--emoji-padding)}';
var PROPS = [
  "customEmoji",
  "customCategorySorting",
  "database",
  "dataSource",
  "i18n",
  "locale",
  "skinToneEmoji",
  "emojiVersion"
];
var EXTRA_STYLES = `:host{--emoji-font-family:${FONT_FAMILY}}`;
var PickerElement = class extends HTMLElement {
  constructor(props) {
    super();
    this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = baseStyles + EXTRA_STYLES;
    this.shadowRoot.appendChild(style);
    this._ctx = {
      // Set defaults
      locale: DEFAULT_LOCALE2,
      dataSource: DEFAULT_DATA_SOURCE2,
      skinToneEmoji: DEFAULT_SKIN_TONE_EMOJI,
      customCategorySorting: DEFAULT_CATEGORY_SORTING,
      customEmoji: null,
      i18n: enI18n,
      emojiVersion: null,
      ...props
    };
    for (const prop of PROPS) {
      if (prop !== "database" && Object.prototype.hasOwnProperty.call(this, prop)) {
        this._ctx[prop] = this[prop];
        delete this[prop];
      }
    }
    this._dbFlush();
  }
  connectedCallback() {
    if (!this._cmp) {
      this._cmp = createRoot(this.shadowRoot, this._ctx);
    }
  }
  disconnectedCallback() {
    qM(() => {
      if (!this.isConnected && this._cmp) {
        this._cmp.$destroy();
        this._cmp = void 0;
        const { database } = this._ctx;
        database.close().catch((err) => console.error(err));
      }
    });
  }
  static get observedAttributes() {
    return ["locale", "data-source", "skin-tone-emoji", "emoji-version"];
  }
  attributeChangedCallback(attrName, oldValue, newValue) {
    this._set(
      // convert from kebab-case to camelcase
      // see https://github.com/sveltejs/svelte/issues/3852#issuecomment-665037015
      attrName.replace(/-([a-z])/g, (_, up) => up.toUpperCase()),
      // convert string attribute to float if necessary
      attrName === "emoji-version" ? parseFloat(newValue) : newValue
    );
  }
  _set(prop, newValue) {
    this._ctx[prop] = newValue;
    if (this._cmp) {
      this._cmp.$set({ [prop]: newValue });
    }
    if (["locale", "dataSource"].includes(prop)) {
      this._dbFlush();
    }
  }
  _dbCreate() {
    const { locale, dataSource, database } = this._ctx;
    if (!database || database.locale !== locale || database.dataSource !== dataSource) {
      this._set("database", new Database({ locale, dataSource }));
    }
  }
  // Update the Database in one microtask if the locale/dataSource change. We do one microtask
  // so we don't create two Databases if e.g. both the locale and the dataSource change
  _dbFlush() {
    qM(() => this._dbCreate());
  }
};
var definitions = {};
for (const prop of PROPS) {
  definitions[prop] = {
    get() {
      if (prop === "database") {
        this._dbCreate();
      }
      return this._ctx[prop];
    },
    set(val) {
      if (prop === "database") {
        throw new Error("database is read-only");
      }
      this._set(prop, val);
    }
  };
}
Object.defineProperties(PickerElement.prototype, definitions);
if (!customElements.get("emoji-picker")) {
  customElements.define("emoji-picker", PickerElement);
}
