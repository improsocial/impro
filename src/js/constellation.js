import { buildQueryString } from "/js/utils.js";
import { CONSTELLATION_URL } from "/js/config.js";

export class Constellation {
  async getLinks({ subject, source, limit = null, timeout = null }) {
    let cursor = null;
    const links = [];
    const controller = new AbortController();
    if (timeout) {
      setTimeout(() => controller.abort(), timeout);
    }
    do {
      const query = {
        subject,
        source,
        limit: 100,
      };
      if (cursor) {
        query.cursor = cursor;
      }
      const response = await fetch(
        `${CONSTELLATION_URL}/xrpc/blue.microcosm.links.getBacklinks?${buildQueryString(
          query,
        )}`,
        {
          headers: {
            Accept: "application/json",
          },
          signal: controller.signal,
        },
      );
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        throw new Error(
          `getLinks: ${error?.error ?? `HTTP ${response.status}`} ${
            error?.message ?? ""
          }`.trim(),
        );
      }
      const data = await response.json();
      if (!Array.isArray(data?.records)) {
        throw new Error("getLinks: malformed response");
      }
      links.push(...data.records);
      cursor = data.cursor;
    } while (cursor && (limit ? links.length < limit : true));
    return limit ? links.slice(0, limit) : links;
  }
}
