import { buildQueryString } from "/js/api.js";

export async function getLinks({ subject, source, timeout = 10000 }) {
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
    };
    if (cursor) {
      query.cursor = cursor;
    }
    const response = await fetch(
      `https://constellation.microcosm.blue/xrpc/blue.microcosm.links.getBacklinks?${buildQueryString(
        query
      )}`,
      {
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }
    );
    const data = await response.json();
    links.push(...data.records);
    cursor = data.cursor;
  } while (cursor);
  return links;
}
