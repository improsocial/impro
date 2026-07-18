import { Signal, untrack } from "/js/signals.js";

const DEVICE_ID_STORAGE_KEY = "improDraftDeviceId";

export function getDraftDeviceId() {
  let deviceId = localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_STORAGE_KEY, deviceId);
  }
  return deviceId;
}

const DB_NAME = "impro-draft-media";

class KVIndexedDB {
  constructor(dbName, storeName) {
    this._dbName = dbName;
    this._storeName = storeName;
    this._dbPromise = null;
  }

  async _open() {
    if (this._dbPromise) return this._dbPromise;
    this._dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(this._dbName, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(this._storeName);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this._dbPromise;
  }

  async _request(mode, callback) {
    const db = await this._open();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this._storeName, mode);
      const request = callback(transaction.objectStore(this._storeName));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async get(key) {
    return this._request("readonly", (store) => store.get(key));
  }

  async has(key) {
    return this._request("readonly", (store) => store.getKey(key)).then(
      (foundKey) => foundKey !== undefined,
    );
  }

  async put(key, value) {
    return this._request("readwrite", (store) => store.put(value, key));
  }

  async delete(key) {
    return this._request("readwrite", (store) => store.delete(key));
  }
}

// Stores blobs in indexeddb
class IDBBlobStore {
  constructor(dbName, storeName = "blobs") {
    this._db = new KVIndexedDB(dbName, storeName);
  }

  async put(path, blob) {
    await this._db.put(path, {
      blob,
      createdAt: new Date().toISOString(),
    });
  }

  async getBlob(path) {
    const record = await this._db.get(path);
    return record?.blob ?? null;
  }

  async has(path) {
    return this._db.has(path);
  }

  async delete(path) {
    return this._db.delete(path);
  }
}

const VIDEO_MIME_TO_EXT = {
  "video/mp4": "mp4",
  "video/mpeg": "mpeg",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "image/gif": "gif",
};

function isVideoPath(path) {
  return path.startsWith("video:");
}

async function sourceToBlob(source) {
  if (source instanceof Blob) {
    return source;
  }
  if (typeof source === "string") {
    const res = await fetch(source);
    return res.blob();
  }
  throw new Error("Unsupported media source");
}

export class DraftMediaStore {
  static createImageLocalRef() {
    return `image:${crypto.randomUUID()}`;
  }

  // Video keys encode the mime type: `video:${mimeType}:${id}.${ext}`. They
  // are never reused - every re-save mints a new key
  static createVideoLocalRef(mimeType) {
    const mime = VIDEO_MIME_TO_EXT[mimeType] ? mimeType : "video/mp4";
    const ext = VIDEO_MIME_TO_EXT[mime];
    return `video:${mime}:${crypto.randomUUID()}.${ext}`;
  }

  // Legacy keys (`video:${id}`) predate the mime segment and default to mp4.
  static parseVideoMimeType(path) {
    const segments = path.split(":");
    if (segments.length >= 3 && VIDEO_MIME_TO_EXT[segments[1]]) {
      return segments[1];
    }
    return "video/mp4";
  }

  static parseVideoExtension(path) {
    return VIDEO_MIME_TO_EXT[this.parseVideoMimeType(path)];
  }

  constructor(dbName = DB_NAME) {
    this._blobStore = new IDBBlobStore(dbName);
    this.$media = new Signal.State({}); // path -> { url } | null
  }

  // Merges entries into $media, revoking object URLs that get replaced or
  // removed in the process
  _patchMedia(entries) {
    const current = untrack(() => this.$media.get());
    for (const [path, entry] of Object.entries(entries)) {
      const previousUrl = current[path]?.url;
      if (previousUrl && previousUrl !== entry?.url) {
        URL.revokeObjectURL(previousUrl);
      }
    }
    this.$media.set({ ...current, ...entries });
  }

  // Loads paths that aren't yet in $media
  async load(paths) {
    const known = untrack(() => this.$media.get());
    const newPaths = [...new Set(paths)].filter((path) => !(path in known));
    const entries = {};
    for (const path of newPaths) {
      entries[path] = await this.loadPath(path);
    }
    this._patchMedia(entries);
  }

  async loadPath(path) {
    if (!(await this._blobStore.has(path))) {
      return null;
    }
    if (isVideoPath(path)) {
      return { url: null };
    }
    const blob = await this._blobStore.getBlob(path);
    return { url: URL.createObjectURL(blob) };
  }

  async save(path, source) {
    const blob = await sourceToBlob(source);
    await this._blobStore.put(path, blob);
    this._patchMedia({
      [path]: isVideoPath(path)
        ? { url: null }
        : { url: URL.createObjectURL(blob) },
    });
  }

  async readBlob(path) {
    return this._blobStore.getBlob(path);
  }

  async delete(path) {
    await this._blobStore.delete(path);
    this._patchMedia({ [path]: null });
  }
}

export function buildDraftFromComposerSnapshot(snapshot) {
  const media = [];
  const draftPost = {
    $type: "app.bsky.draft.defs#draftPost",
    text: snapshot.postText,
  };
  if (snapshot.labels) {
    draftPost.labels = snapshot.labels;
  }
  if (snapshot.images?.length > 0) {
    draftPost.embedGallery = {
      $type: "app.bsky.draft.defs#draftEmbedGallery",
      items: snapshot.images.map((image) => {
        const path =
          image.localRefPath ?? DraftMediaStore.createImageLocalRef();
        media.push({ path, source: image.file });
        const item = {
          $type: "app.bsky.draft.defs#draftEmbedImage",
          localRef: { $type: "app.bsky.draft.defs#draftEmbedLocalRef", path },
        };
        if (image.alt) {
          item.alt = image.alt;
        }
        return item;
      }),
    };
  } else if (snapshot.unrestoredImages?.length > 0) {
    draftPost.embedGallery = {
      $type: "app.bsky.draft.defs#draftEmbedGallery",
      items: snapshot.unrestoredImages,
    };
  }
  if (snapshot.video) {
    const path = DraftMediaStore.createVideoLocalRef(
      snapshot.video.file?.type || "video/mp4",
    );
    media.push({ path, source: snapshot.video.file });
    const videoEmbed = {
      $type: "app.bsky.draft.defs#draftEmbedVideo",
      localRef: { $type: "app.bsky.draft.defs#draftEmbedLocalRef", path },
    };
    if (snapshot.video.alt) {
      videoEmbed.alt = snapshot.video.alt;
    }
    if (snapshot.video.captions?.length > 0) {
      videoEmbed.captions = snapshot.video.captions;
    }
    draftPost.embedVideos = [videoEmbed];
  } else if (snapshot.unrestoredVideo) {
    draftPost.embedVideos = [snapshot.unrestoredVideo];
  }
  if (snapshot.external) {
    draftPost.embedExternals = [
      {
        $type: "app.bsky.draft.defs#draftEmbedExternal",
        uri: snapshot.external.url,
      },
    ];
  }
  if (snapshot.quotedRecord) {
    draftPost.embedRecords = [
      {
        $type: "app.bsky.draft.defs#draftEmbedRecord",
        record: {
          uri: snapshot.quotedRecord.uri,
          cid: snapshot.quotedRecord.cid,
        },
      },
    ];
  }
  const draft = {
    $type: "app.bsky.draft.defs#draft",
    deviceId: getDraftDeviceId(),
    deviceName: "Web", // match social-app
    posts: [draftPost],
  };
  if (snapshot.threadgateAllow) {
    draft.threadgateAllow = snapshot.threadgateAllow;
  }
  if (snapshot.postgateEmbeddingRules?.length > 0) {
    draft.postgateEmbeddingRules = snapshot.postgateEmbeddingRules;
  }
  return { draft, media };
}
