// A fully offline mock of the Tangled infrastructure the host talks to
// when installing a plugin from a `tangled:` repo. It serves every network
// hop in the resolution + asset chain so e2e tests never touch the real
// network (the shared base fixture already fails any unmocked request).
//
// The chain it mocks, mirroring src/js/tangled.js + sourceProvider.js:
//
//   1. Owner identity   resolveEndpoint(ownerHandle)
//        -> Slingshot resolveMiniDoc, falling back to resolveHandle + the
//           owner's PLC DID doc. Both paths are served.
//   2. Repo record      findRepoRecord: legacy `sh.tangled.repo` on the
//        owner's PDS (direct getRecord, then listRecords).
//   3. Repo declaration findRepoDeclaration (the fallback this PR adds):
//        `org.tangled.repo.declaration` on the owner's PDS names a repo
//        DID, whose own PLC doc names the knot via #atproto_pds.
//   4. Knot API         detectKnotApi: describeKnot 200 -> "git",
//        404 -> "legacy".
//   5. Plugin assets    git knot:    org.tangled.git.getBlob (raw bytes)
//                       legacy knot: sh.tangled.repo.blob (raw=true bytes,
//                                    or raw=false JSON-wrapped content)
//
// Repos can be seeded in either shape (legacy record, declaration, or
// both) and served from either knot API, so tests can pin each resolution
// path independently. Everything is in-memory; nothing is fetched.

import { getPagesPluginSource } from "./testPlugins.js";

const DEFAULT_PDS = "https://pds.tangled.mock";
const DEFAULT_KNOT = "knot1.tangled.mock";

// A small, self-contained plugin that registers a page, so an install test
// can prove the fetched bundle actually loaded and ran (not just that the
// manifest parsed). Distinct id/name from the local test-plugin fixture.
const TANGLED_PLUGIN_ID = "tangled-test-plugin";
const TANGLED_PLUGIN_NAME = "Tangled Test Plugin";
const TANGLED_PLUGIN_VERSION = "1.0.0";

function defaultManifest() {
  return {
    id: TANGLED_PLUGIN_ID,
    name: TANGLED_PLUGIN_NAME,
    version: TANGLED_PLUGIN_VERSION,
    author: "Tangled Test Author",
    description: "A plugin served from a mock Tangled repo",
  };
}

// The pages-plugin body registers a "dashboard" page; reuse it so the
// installed plugin renders something assertable.
function defaultSource() {
  return getPagesPluginSource();
}

export class MockTangledProvider {
  constructor({ pds = DEFAULT_PDS, knot = DEFAULT_KNOT } = {}) {
    this.pds = pds;
    this.knot = knot;
    // "ownerHandle/repoName" -> repo descriptor
    this.repos = new Map();
    // Every request the mock answers, for assertions / offline auditing.
    this.requests = [];
    this._setupDone = false;
  }

  // Seed a repo.
  //   ownerHandle / name  - the tangled.org/<owner>/<name> path
  //   shape               - "declaration" (default), "legacy", or "both"
  //   knotApi             - "git" (default) or "legacy"
  //   manifest / source / styles / readme - asset overrides
  //   version             - the tag the assets are served under (defaults
  //                         to the manifest's version); "main" always works
  addRepo({
    ownerHandle,
    name,
    shape = "declaration",
    knotApi = "git",
    manifest = defaultManifest(),
    source = defaultSource(),
    styles = null,
    readme = "# Tangled Test Plugin\n\nServed from a mock knot.",
    version = manifest.version,
    knot = this.knot,
    pds = this.pds,
  } = {}) {
    if (!ownerHandle || !name) {
      throw new Error("addRepo needs ownerHandle and name");
    }
    // Deterministic, valid-looking DIDs derived from the path so multiple
    // repos in one test don't collide.
    const suffix = `${ownerHandle}/${name}`.replace(/[^a-z0-9]/gi, "");
    const ownerDid = `did:plc:owner${suffix}`.slice(0, 32);
    const repoDid = `did:plc:repo${suffix}`.slice(0, 32);
    const repo = {
      ownerHandle,
      name,
      ownerDid,
      repoDid,
      knot,
      pds,
      knotApi,
      hasLegacy: shape === "legacy" || shape === "both",
      hasDeclaration: shape === "declaration" || shape === "both",
      manifest,
      source,
      styles,
      readme,
      version,
      // ref -> { path -> content }; "main" and the version tag both serve
      // the same assets (a real repo's tag points at a commit on main).
      assets: new Map([
        ["main", this._assetMap(manifest, source, styles, readme)],
        [version, this._assetMap(manifest, source, styles, readme)],
      ]),
    };
    this.repos.set(`${ownerHandle}/${name}`, repo);
    return repo;
  }

  _assetMap(manifest, source, styles, readme) {
    const files = new Map();
    files.set("manifest.json", JSON.stringify(manifest));
    files.set("main.js", source);
    if (styles != null) files.set("styles.css", styles);
    if (readme != null) files.set("README.md", readme);
    return files;
  }

  _findRepo(ownerHandle, name) {
    return this.repos.get(`${ownerHandle}/${name}`) ?? null;
  }

  _record(value) {
    return {
      ok: true,
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(value),
    };
  }

  _notFound(message = "not found") {
    return {
      ok: false,
      status: 400,
      contentType: "application/json",
      body: JSON.stringify({ error: "RecordNotFound", message }),
    };
  }

  // Register all routes. Call AFTER MockServer.setup(page) so these
  // page-level routes take precedence over the MockServer's generic
  // identity / record handlers (Playwright runs page routes newest-first).
  async setup(page) {
    if (this._setupDone) {
      throw new Error("MockTangledProvider.setup called twice");
    }
    this._setupDone = true;
    this.page = page;

    // --- 1. Owner identity ------------------------------------------------
    // Slingshot mini doc (the host's first identity step).
    await page.route(
      "**/xrpc/blue.microcosm.identity.resolveMiniDoc*",
      (route) => {
        const url = new URL(route.request().url());
        const identifier = url.searchParams.get("identifier");
        const repo = this._repoForOwner(identifier);
        this._log(route, repo ? "identity.miniDoc" : "identity.miniDoc.miss");
        if (!repo) {
          return route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({
              error: "InvalidRequest",
              message: "Failed to resolve identity",
            }),
          });
        }
        return route.fulfill(
          this._record({
            did: repo.ownerDid,
            handle: repo.ownerHandle,
            pds: repo.pds,
          }),
        );
      },
    );

    // Handle resolution fallback (public.api.bsky.app + Slingshot).
    await page.route("**/xrpc/com.atproto.identity.resolveHandle*", (route) => {
      const url = new URL(route.request().url());
      const handle = url.searchParams.get("handle");
      const repo = this._repoForOwner(handle);
      this._log(
        route,
        repo ? "identity.resolveHandle" : "identity.resolveHandle.miss",
      );
      if (!repo) {
        return route.fulfill({
          status: 400,
          contentType: "application/json",
          body: JSON.stringify({
            error: "InvalidRequest",
            message: "Unable to resolve handle",
          }),
        });
      }
      return route.fulfill(this._record({ did: repo.ownerDid }));
    });

    // PLC directory: owner DID doc (-> owner PDS) and repo DID doc (-> knot).
    // resolveDid percent-encodes the DID in the path, so decode before
    // matching. Serves any DID the seeded repos reference.
    await page.route("https://plc.directory/**", (route) => {
      const did = decodeURIComponent(route.request().url()).split("/").pop();
      const ownerRepo = [...this.repos.values()].find(
        (r) => r.ownerDid === did,
      );
      if (ownerRepo) {
        this._log(route, "plc.owner");
        return route.fulfill(
          this._record({
            id: ownerRepo.ownerDid,
            alsoKnownAs: [`at://${ownerRepo.ownerHandle}`],
            service: [
              {
                id: "#atproto_pds",
                type: "AtprotoPersonalDataServer",
                serviceEndpoint: ownerRepo.pds,
              },
            ],
          }),
        );
      }
      const repo = [...this.repos.values()].find((r) => r.repoDid === did);
      if (repo) {
        this._log(route, "plc.repo");
        return route.fulfill(
          this._record({
            id: repo.repoDid,
            service: [
              {
                id: "#atproto_pds",
                type: "AtprotoPersonalDataServer",
                serviceEndpoint: `https://${repo.knot}`,
              },
            ],
          }),
        );
      }
      this._log(route, "plc.miss");
      return route.fulfill({ status: 404, body: "{}" });
    });

    // --- 2/3. Repo record + declaration on the owner's PDS ----------------
    await page.route("**/xrpc/com.atproto.repo.getRecord*", (route) => {
      const url = new URL(route.request().url());
      const collection = url.searchParams.get("collection");
      const rkey = url.searchParams.get("rkey");
      const repoDid = url.searchParams.get("repo");
      const repo = [...this.repos.values()].find((r) => r.ownerDid === repoDid);

      if (collection === "sh.tangled.repo") {
        this._log(route, "record.legacy");
        if (repo?.hasLegacy && repo.name === rkey) {
          return route.fulfill(
            this._record({
              uri: `at://${repo.ownerDid}/sh.tangled.repo/${repo.name}`,
              cid: "bafylegacyrepo",
              value: {
                $type: "sh.tangled.repo",
                name: repo.name,
                knot: repo.knot,
                repoDid: repo.repoDid,
                createdAt: "2025-01-01T00:00:00.000Z",
              },
            }),
          );
        }
        return route.fulfill(this._notFound());
      }

      if (collection === "org.tangled.repo.declaration") {
        this._log(route, "record.declaration");
        // Declarations are keyed by the lowercased repo name.
        if (repo?.hasDeclaration && repo.name.toLowerCase() === rkey) {
          return route.fulfill(
            this._record({
              uri: `at://${repo.ownerDid}/org.tangled.repo.declaration/${repo.name.toLowerCase()}`,
              cid: "bafydeclaration",
              value: {
                $type: "org.tangled.repo.declaration",
                repo: repo.repoDid,
                createdAt: "2026-01-01T00:00:00.000Z",
              },
            }),
          );
        }
        return route.fulfill(this._notFound());
      }

      // Not a Tangled collection - let the MockServer's handler answer.
      this._log(route, "record.passthrough");
      return route.fallback();
    });

    await page.route("**/xrpc/com.atproto.repo.listRecords*", (route) => {
      const url = new URL(route.request().url());
      const collection = url.searchParams.get("collection");
      const repoDid = url.searchParams.get("repo");
      if (collection !== "sh.tangled.repo") {
        this._log(route, "listRecords.passthrough");
        return route.fallback();
      }
      this._log(route, "listRecords.legacy");
      const repo = [...this.repos.values()].find((r) => r.ownerDid === repoDid);
      const records = repo?.hasLegacy
        ? [
            {
              uri: `at://${repo.ownerDid}/sh.tangled.repo/${repo.name}`,
              cid: "bafylegacyrepo",
              value: {
                $type: "sh.tangled.repo",
                name: repo.name,
                knot: repo.knot,
                repoDid: repo.repoDid,
              },
            },
          ]
        : [];
      return route.fulfill(this._record({ records, cursor: "" }));
    });

    // --- 4. Knot API detection -------------------------------------------
    await page.route("**/xrpc/org.tangled.knot.describeKnot*", (route) => {
      const knot = new URL(route.request().url()).hostname;
      const repo = [...this.repos.values()].find((r) => r.knot === knot);
      this._log(route, "knot.describe");
      if (repo?.knotApi === "git") {
        return route.fulfill(
          this._record({ did: `did:web:${knot}`, version: "knot2" }),
        );
      }
      // Legacy Go knots don't implement describeKnot.
      return route.fulfill({ status: 404, body: "Not Found" });
    });

    // --- 5. Plugin assets -------------------------------------------------
    // New git API: raw bytes for every file type.
    await page.route("**/xrpc/org.tangled.git.getBlob*", (route) => {
      const url = new URL(route.request().url());
      const repo = [...this.repos.values()].find(
        (r) => r.repoDid === url.searchParams.get("repo"),
      );
      const ref = url.searchParams.get("ref") ?? "main";
      const path = url.searchParams.get("path");
      this._log(route, `blob.git:${path}@${ref}`);
      const content = repo?.assets.get(ref)?.get(path);
      if (content == null) {
        return route.fulfill({ status: 404, body: "Not Found" });
      }
      return route.fulfill({
        status: 200,
        contentType: contentTypeFor(path),
        body: content,
      });
    });

    // Legacy blob API: raw=true serves bytes (text mime types only);
    // raw=false serves JSON-wrapped {content, encoding} for any file type.
    await page.route("**/xrpc/sh.tangled.repo.blob*", (route) => {
      const url = new URL(route.request().url());
      const repo = [...this.repos.values()].find(
        (r) => r.repoDid === url.searchParams.get("repo"),
      );
      const ref = url.searchParams.get("ref") ?? "main";
      const path = url.searchParams.get("path");
      const raw = url.searchParams.get("raw") === "true";
      this._log(
        route,
        `blob.legacy:${path}@${ref}${raw ? ":raw" : ":wrapped"}`,
      );
      const content = repo?.assets.get(ref)?.get(path);
      if (content == null) {
        return route.fulfill({ status: 404, body: "Not Found" });
      }
      if (raw) {
        return route.fulfill({
          status: 200,
          contentType: contentTypeFor(path),
          body: content,
        });
      }
      const isText = /\.(js|json|css|md|txt)$/i.test(path);
      return route.fulfill(
        this._record({
          content: isText ? content : Buffer.from(content).toString("base64"),
          encoding: isText ? "utf-8" : "base64",
        }),
      );
    });
  }

  _repoForOwner(identifier) {
    if (!identifier) return null;
    return (
      [...this.repos.values()].find(
        (r) => r.ownerHandle === identifier || r.ownerDid === identifier,
      ) ?? null
    );
  }

  _log(route, label) {
    this.requests.push({ label, url: route.request().url() });
  }

  // Convenience: the tangled.org URL a test can paste into the install box.
  repoUrl(repo) {
    return `https://tangled.org/${repo.ownerHandle}/${repo.name}`;
  }
}

function contentTypeFor(path) {
  if (/\.json$/i.test(path)) return "application/json";
  if (/\.js$/i.test(path)) return "text/javascript";
  if (/\.css$/i.test(path)) return "text/css";
  if (/\.md$/i.test(path)) return "text/markdown";
  return "application/octet-stream";
}

export { TANGLED_PLUGIN_ID, TANGLED_PLUGIN_NAME, TANGLED_PLUGIN_VERSION };
