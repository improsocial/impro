import { Signal, untrack } from "/js/signals.js";
import { KVIndexedDB } from "/js/utils.js";

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

function buildDraftPostFromSnapshot(postSnapshot, media) {
  const draftPost = {
    $type: "app.bsky.draft.defs#draftPost",
    text: postSnapshot.postText,
  };
  if (postSnapshot.labels) {
    draftPost.labels = postSnapshot.labels;
  }
  if (postSnapshot.images?.length > 0) {
    draftPost.embedGallery = {
      $type: "app.bsky.draft.defs#draftEmbedGallery",
      items: postSnapshot.images.map((image) => {
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
  } else if (postSnapshot.unrestoredImages?.length > 0) {
    draftPost.embedGallery = {
      $type: "app.bsky.draft.defs#draftEmbedGallery",
      items: postSnapshot.unrestoredImages,
    };
  }
  if (postSnapshot.video) {
    const path = DraftMediaStore.createVideoLocalRef(
      postSnapshot.video.file?.type || "video/mp4",
    );
    media.push({ path, source: postSnapshot.video.file });
    const videoEmbed = {
      $type: "app.bsky.draft.defs#draftEmbedVideo",
      localRef: { $type: "app.bsky.draft.defs#draftEmbedLocalRef", path },
    };
    if (postSnapshot.video.alt) {
      videoEmbed.alt = postSnapshot.video.alt;
    }
    if (postSnapshot.video.captions?.length > 0) {
      videoEmbed.captions = postSnapshot.video.captions;
    }
    draftPost.embedVideos = [videoEmbed];
  } else if (postSnapshot.unrestoredVideo) {
    draftPost.embedVideos = [postSnapshot.unrestoredVideo];
  }
  if (postSnapshot.external) {
    draftPost.embedExternals = [
      {
        $type: "app.bsky.draft.defs#draftEmbedExternal",
        uri: postSnapshot.external.url,
      },
    ];
  }
  if (postSnapshot.quotedRecord) {
    draftPost.embedRecords = [
      {
        $type: "app.bsky.draft.defs#draftEmbedRecord",
        record: {
          uri: postSnapshot.quotedRecord.uri,
          cid: postSnapshot.quotedRecord.cid,
        },
      },
    ];
  }
  return draftPost;
}

export function buildDraftFromComposerSnapshot(snapshot) {
  const media = [];
  const draft = {
    $type: "app.bsky.draft.defs#draft",
    deviceId: getDraftDeviceId(),
    deviceName: "Web", // match social-app
    posts: snapshot.posts.map((postSnapshot) =>
      buildDraftPostFromSnapshot(postSnapshot, media),
    ),
  };
  if (snapshot.threadgateAllow) {
    draft.threadgateAllow = snapshot.threadgateAllow;
  }
  if (snapshot.postgateEmbeddingRules?.length > 0) {
    draft.postgateEmbeddingRules = snapshot.postgateEmbeddingRules;
  }
  return { draft, media };
}
