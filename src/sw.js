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
      // If a client is active, skip showing the notification
      let answered = false;
      if (focused.length > 0) {
        const requestId = crypto.randomUUID();
        const channel = new MessageChannel();
        const reply = new Promise((resolve) => {
          const timer = setTimeout(() => resolve(false), 1000);
          if (typeof timer.unref === "function") timer.unref();
          channel.port1.onmessage = (event) => {
            if (event.data?.type !== "push-received-ack") return;
            if (event.data?.requestId !== requestId) return;
            clearTimeout(timer);
            resolve(true);
          };
        });
        for (const client of focused) {
          client.postMessage({ type: "push-received", requestId }, [
            channel.port2,
          ]);
        }
        answered = await reply;
      }
      if (!answered) {
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
        client.postMessage({
          type: "notification-click",
          url: target.pathname + target.search + target.hash,
        });
        await client.focus();
        return;
      }
      await self.clients.openWindow(target.href);
    })(),
  );
});
