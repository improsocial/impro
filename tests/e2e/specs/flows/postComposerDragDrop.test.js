import { test, expect } from "../../base.js";
import { login } from "../../helpers.js";
import { MockServer } from "../../mockServer.js";

test.describe("Post composer drag-and-drop", () => {
  test("dropping an image file anywhere on the page adds it to the composer", async ({
    page,
  }) => {
    const mockServer = new MockServer();
    await mockServer.setup(page);

    await login(page);
    await page.goto("/intent/compose");

    const composer = page.locator("post-composer .post-composer");
    await expect(composer).toBeVisible({ timeout: 10000 });

    const pngBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    await page.evaluate(async (base64) => {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const file = new File([bytes], "dropped.png", { type: "image/png" });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);

      const dragOver = new DragEvent("dragover", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      window.dispatchEvent(dragOver);

      const drop = new DragEvent("drop", {
        bubbles: true,
        cancelable: true,
        dataTransfer,
      });
      document.body.dispatchEvent(drop);
    }, pngBase64);

    await expect(composer.locator(".image-preview-item")).toHaveCount(1, {
      timeout: 10000,
    });
  });
});
