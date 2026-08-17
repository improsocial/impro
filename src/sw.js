self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (error) {
    console.error("[sw] failed to parse push payload", error);
  }

  const { title, body, url, badge, tag } = payload;

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const focused = clients.filter((client) => client.focused);
      // If a client is focused, skip showing the notification
      if (focused.length > 0) {
        for (const client of focused) {
          client.postMessage({ type: "push-received" });
        }
      } else {
        await self.registration.showNotification(title || "Impro", {
          body,
          tag,
          icon: "/img/impro-logo-192.png",
          data: { url: url || "/" },
        });
      }
      if (typeof badge === "number" && "setAppBadge" in self.navigator) {
        try {
          await self.navigator.setAppBadge(badge);
        } catch (error) {
          console.error("[sw] failed to set app badge", error);
        }
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const target = new URL(url, self.location.origin);
      for (const client of allClients) {
        if (new URL(client.url).origin !== self.location.origin) continue;
        await client.focus();
        if ("navigate" in client) {
          await client.navigate(target.href);
        }
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
