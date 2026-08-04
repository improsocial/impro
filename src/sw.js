// Service worker backing system notifications. `new Notification()` called
// directly from page context works on desktop, but throws on Chrome for
// Android (and effectively every other mobile browser) -- mobile requires
// notifications to be shown via a service worker's registration instead.
// SystemNotificationService.notify() uses this registration for that.

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
