// Service worker for Web Push notifications (Tier 2 / cross-device relay).
// Push messages are sent with no payload (see functions/push/relay.js), so
// there's nothing to decrypt here — just show a generic notification.

const NOTIFICATION_ICON = "/img/impro-logo-192.png";

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("New activity on Impro", {
      body: "You have new activity on one of your other devices.",
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: "impro-push",
      data: { url: "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    (async () => {
      const clientsList = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of clientsList) {
        if (!("focus" in client)) continue;
        await client.focus();
        if ("navigate" in client) await client.navigate(url);
        return;
      }
      await clients.openWindow(url);
    })(),
  );
});
