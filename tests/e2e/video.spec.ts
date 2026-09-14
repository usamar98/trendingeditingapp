import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
import { syntheticVideo } from "../fixtures/video";
const photo = fs.readFileSync("public/images/studio.webp");
const clip = syntheticVideo();
const id = "b827395f-a85b-48a4-83dd-106a7348a7f6";
const now = new Date().toISOString(),
  expiry = new Date(Date.now() + 86400000).toISOString();
const result = {
  id,
  preset: "cinematic",
  status: "succeeded",
  creditsCharged: 60,
  createdAt: now,
  expiresAt: expiry,
  errorCode: null,
};
async function setup(page: Page, credits = 600) {
  await page.route("**/api/session", (r) =>
    r.fulfill({
      json: {
        configured: true,
        authConfigured: true,
        creditMode: "credits",
        credits,
        billingReady: true,
        user: { email: "video-fixture@example.test", displayName: "Alex" },
      },
    }),
  );
  await page.route("**/api/videos", (r) =>
    r.fulfill({ json: { available: true, jobs: [] } }),
  );
}
async function upload(page: Page) {
  await expect(page.getByLabel("Upload photo to animate")).toBeEnabled();
  await page.getByLabel("Upload photo to animate").setInputFiles({
    name: "photo.webp",
    mimeType: "image/webp",
    buffer: photo,
  });
  await expect(page.getByText("Photo ready. Change photo?")).toBeVisible();
  await page.locator(".video-consent input").check();
}
async function accessible(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const r = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    r.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
test("simulated upload, queue, playable video, original comparison and MP4 download", async ({
  page,
}, info) => {
  await setup(page);
  let posts = 0;
  let current = { ...result, status: "queued" };
  await page.route("**/api/videos", async (r) => {
    if (r.request().method() === "POST") {
      posts++;
      expect(r.request().postDataBuffer()!.toString()).toContain(
        'name="consent"\r\n\r\ntrue',
      );
      return r.fulfill({ status: 202, json: current });
    }
    return r.fulfill({
      json: { available: true, jobs: posts ? [current] : [] },
    });
  });
  await page.route(`**/api/videos/${id}`, (r) => r.fulfill({ json: current }));
  await page.route(`**/api/videos/${id}/media*`, (r) =>
    r.fulfill({
      contentType: r.request().url().includes("kind=original")
        ? "image/webp"
        : "video/mp4",
      headers: r.request().url().includes("download=1")
        ? {
            "content-disposition":
              "attachment; filename=editingapp-cinematic-video.mp4",
          }
        : {},
      body: r.request().url().includes("kind=original") ? photo : clip,
    }),
  );
  await page.goto("/tools/ai-photo-to-video");
  await expect(page.getByRole("radio")).toHaveCount(4);
  await accessible(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-video-top.png`,
  });
  await upload(page);
  await page
    .getByRole("button", { name: "Generate video · 60 credits" })
    .click();
  await expect(
    page.getByRole("heading", { name: "You’re in the queue." }),
  ).toBeVisible();
  expect(posts).toBe(1);
  current = { ...result, status: "processing" };
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect(
    page.getByRole("heading", { name: "Your photo is coming to life." }),
  ).toBeVisible();
  current = result;
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect(page.getByRole("link", { name: "Download MP4" })).toBeVisible();
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.readyState),
    )
    .toBeGreaterThan(0);
  await page.locator("video").evaluate((v: HTMLVideoElement) => v.play());
  await expect
    .poll(() =>
      page.locator("video").evaluate((v: HTMLVideoElement) => v.currentTime),
    )
    .toBeGreaterThan(0);
  await page
    .getByRole("button", { name: "Original photo", exact: true })
    .click();
  await expect(
    page.getByAltText("Original photo for comparison"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Your video", exact: true }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download MP4" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("editingapp-cinematic-video.mp4");
  expect(fs.readFileSync((await file.path())!).equals(clip)).toBe(true);
  await accessible(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-video-result.png`,
    fullPage: true,
  });
  expect(posts).toBe(1);
  await page.reload();
  await expect(page.getByRole("link", { name: "Download MP4" })).toBeVisible();
  expect(posts).toBe(1);
});
test("simulated invalid uploads and insufficient credit never submit", async ({
  page,
}) => {
  await setup(page, 9);
  let posts = 0;
  await page.route("**/api/videos", (r) => {
    if (r.request().method() === "POST") posts++;
    return r.fulfill({ json: { available: true, jobs: [] } });
  });
  await page.goto("/tools/ai-photo-to-video");
  await expect(page.getByLabel("Upload photo to animate")).toBeEnabled();
  await page.getByLabel("Upload photo to animate").setInputFiles({
    name: "bad.gif",
    mimeType: "image/gif",
    buffer: Buffer.from("bad"),
  });
  await expect(page.locator(".video-controls [role=alert]")).toContainText(
    "still JPG",
  );
  await upload(page);
  await page
    .getByRole("button", { name: "Generate video · 60 credits" })
    .click();
  await expect(page.locator(".video-controls [role=alert]")).toContainText(
    "60 credits",
  );
  expect(posts).toBe(0);
});
test("simulated lost submission response recovers with GET only", async ({
  page,
}) => {
  await setup(page);
  let posts = 0;
  await page.route("**/api/videos", (r) => {
    if (r.request().method() === "POST") {
      posts++;
      return r.fulfill({
        status: 502,
        json: { error: "Connection interrupted" },
      });
    }
    return r.fulfill({ json: { available: true, jobs: [] } });
  });
  await page.route("**/api/videos/*", (r) =>
    r.fulfill({
      json: {
        ...result,
        id: new URL(r.request().url()).pathname.split("/").pop(),
        status: "failed",
      },
    }),
  );
  await page.goto("/tools/ai-photo-to-video");
  await upload(page);
  await page
    .getByRole("button", { name: "Generate video · 60 credits" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Let’s reconnect to your scene." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Video request in progress" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect(
    page.getByText(
      "The generation failed. Your reserved credits have been restored with their original expiry.",
    ),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("simulated saved request recovers after access is restored without another charge", async ({
  page,
}, info) => {
  await page.clock.install();
  await setup(page);
  let posts = 0;
  let checks = 0;
  let historyReads = 0;
  let releaseSession!: () => void;
  const sessionReady = new Promise<void>((resolve) => {
    releaseSession = resolve;
  });
  await page.route("**/api/session", async (r) => {
    await sessionReady;
    return r.fulfill({
      json: {
        configured: true,
        authConfigured: true,
        creditMode: "credits",
        credits: 600,
        user: { email: "video-fixture@example.test", displayName: "Alex" },
      },
    });
  });
  let recovered = false;
  const pending = {
    ...result,
    preset: "memory",
    status: "queued",
    errorCode: "VIDEO_ACCESS_DENIED",
  };
  await page.route("**/api/videos", (r) => {
    if (r.request().method() === "POST") posts++;
    else historyReads++;
    return r.fulfill({
      json: { available: true, jobs: [recovered ? result : pending] },
    });
  });
  await page.route(`**/api/videos/${id}`, (r) => {
    checks++;
    return r.fulfill({ json: recovered ? result : pending });
  });
  await page.route(`**/api/videos/${id}/media*`, (r) =>
    r.fulfill({ contentType: "video/mp4", body: clip }),
  );
  await page.goto("/tools/ai-photo-to-video");
  expect(historyReads).toBe(0);
  releaseSession();
  await expect(
    page.getByRole("heading", {
      name: "Your video needs an access fix.",
    }),
  ).toBeVisible();
  await expect(
    page.getByText(/The video provider denied access to this result/),
  ).toBeVisible();
  await page.getByText("Request details", { exact: true }).click();
  await expect(
    page.locator("details").filter({ hasText: "Request ID:" }),
  ).toContainText(id);
  await expect(
    page.locator("details").filter({ hasText: "Request ID:" }),
  ).toContainText("VIDEO_ACCESS_DENIED");
  await upload(page);
  await page.getByRole("radio", { name: /Golden Breeze/ }).check();
  await expect(
    page.getByText(/You can choose a photo and movement for your next video/),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Video request in progress" }),
  ).toBeDisabled();
  await expect(
    page.locator("details").filter({ hasText: "Request ID:" }),
  ).toContainText("Movement: Photo Comes Alive");
  await page.clock.fastForward(24_000);
  expect(checks).toBe(0); // A persistent delivery error pauses automatic polling.
  expect(posts).toBe(0); // Selecting a draft never submits or replaces the pending job.
  await page.screenshot({
    path: `test-results/${info.project.name}-video-recovery-draft.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect(
    page.getByRole("button", { name: "Check video status" }),
  ).toBeEnabled();
  await accessible(page);
  await page.reload();
  await expect(
    page.getByRole("heading", {
      name: "Your video needs an access fix.",
    }),
  ).toBeVisible();
  recovered = true;
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect(page.getByRole("link", { name: "Download MP4" })).toBeVisible();
  expect(posts).toBe(0);
  expect(checks).toBeGreaterThanOrEqual(2);
});

test("a hung simulated status check times out, unlocks checking and does not retry itself", async ({
  page,
}) => {
  await setup(page);
  await page.clock.install();
  const pending = {
    ...result,
    status: "queued",
    errorCode: "VIDEO_RESULT_UNAVAILABLE",
  };
  let posts = 0,
    checks = 0;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/videos", (r) => {
    if (r.request().method() === "POST") posts++;
    return r.fulfill({ json: { available: true, jobs: [pending] } });
  });
  await page.route(`**/api/videos/${id}`, async (r) => {
    checks++;
    if (checks === 1) await held;
    await r.fulfill({ json: pending }).catch(() => {});
  });
  await page.goto("/tools/ai-photo-to-video");
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect(page.getByRole("button", { name: "Checking…" })).toBeDisabled();
  await expect.poll(() => checks).toBe(1);
  await page.clock.fastForward(46_000);
  await expect(page.locator(".video-waiting [role=alert]")).toContainText(
    "status check timed out",
  );
  await expect(
    page.getByRole("button", { name: "Check video status" }),
  ).toBeEnabled();
  await page.clock.fastForward(24_000);
  expect(checks).toBe(1);
  await upload(page);
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect.poll(() => checks).toBe(2);
  await expect(
    page.getByRole("button", { name: "Check video status" }),
  ).toBeEnabled();
  expect(posts).toBe(0);
  release();
});

test("switching simulated requests clears checking and ignores the previous response", async ({
  page,
}) => {
  await setup(page);
  const first = {
    ...result,
    status: "uncertain",
    errorCode: "VIDEO_RESULT_UNAVAILABLE",
  };
  const second = {
    ...first,
    id: "d224f1a6-755f-4d36-b7b4-0708fb532149",
    preset: "memory",
  };
  let settled = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/videos", (r) =>
    r.fulfill({
      json: {
        available: true,
        jobs: [first, { ...second, status: settled ? "failed" : "uncertain" }],
      },
    }),
  );
  await page.route(`**/api/videos/${id}`, async (r) => {
    await held;
    await r.fulfill({ json: result }).catch(() => {});
  });
  await page.route(`**/api/videos/${second.id}`, (r) => {
    settled = true;
    return r.fulfill({ json: { ...second, status: "failed" } });
  });
  await page.goto("/tools/ai-photo-to-video");
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect(page.getByRole("button", { name: "Checking…" })).toBeDisabled();
  await page
    .getByRole("button", { name: /Photo Comes Alive.*uncertain/ })
    .click();
  await expect(
    page.getByRole("button", { name: "Check video status" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Check video status" }).click();
  await expect(
    page.getByText(
      /The generation failed. Your reserved credits have been restored/,
    ),
  ).toBeVisible();
  release();
  await expect(page.getByRole("link", { name: "Download MP4" })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /Photo Comes Alive.*failed/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
test("simulated motion-reference submission shows 90 credits before dispatch", async ({
  page,
}) => {
  await setup(page);
  let posts = 0;
  await page.route("**/api/videos", (r) => {
    if (r.request().method() === "POST") {
      posts++;
      const body = r.request().postDataBuffer()!.toString();
      expect(body).toContain('name="preset"\r\n\r\nmotion');
      expect(body).toContain('name="reference"; filename="reference.mp4"');
      return r.fulfill({
        status: 202,
        json: {
          ...result,
          preset: "motion",
          status: "queued",
          creditsCharged: 90,
        },
      });
    }
    return r.fulfill({ json: { available: true, jobs: [] } });
  });
  await page.goto("/tools/ai-photo-to-video");
  await page.getByRole("radio", { name: /Copy a Motion/ }).check();
  await upload(page);
  await page.getByLabel("Your movement reference").setInputFiles({
    name: "reference.mp4",
    mimeType: "video/mp4",
    buffer: clip,
  });
  await page.locator(".video-consent input").check();
  await page
    .getByRole("button", { name: "Generate video · 90 credits" })
    .click();
  await expect(
    page.getByRole("heading", { name: "You’re in the queue." }),
  ).toBeVisible();
  expect(posts).toBe(1);
});

test("simulated sign-in preserves a guest upload; changing accounts clears private media", async ({
  page,
}) => {
  await setup(page);
  let email: string | null = null;
  let posts = 0;
  await page.route("**/api/session", (r) =>
    r.fulfill({
      json: {
        configured: true,
        authConfigured: true,
        creditMode: "credits",
        credits: 600,
        billingReady: true,
        user: email ? { email } : null,
      },
    }),
  );
  await page.route("**/api/videos", (r) => {
    if (r.request().method() === "POST") posts++;
    return r.fulfill({ json: { available: true, jobs: [] } });
  });
  await page.goto("/tools/ai-photo-to-video");
  await upload(page);
  email = "first@example.test";
  await page.evaluate(() =>
    window.dispatchEvent(new Event("editingapp-session-updated")),
  );
  await expect(
    page.getByRole("button", { name: "Generate video · 60 credits" }),
  ).toBeVisible();
  await expect(page.getByText("Photo ready. Change photo?")).toBeVisible();
  await expect(page.locator(".video-consent input")).toBeChecked();
  expect(posts).toBe(0);
  email = "second@example.test";
  await page.evaluate(() =>
    window.dispatchEvent(new Event("editingapp-session-updated")),
  );
  await expect(page.getByText("Choose a photo or drop it here")).toBeVisible();
  await expect(page.getByAltText("Your selected starting photo")).toHaveCount(
    0,
  );
  expect(posts).toBe(0);
});

test("simulated saved-video deletion expires the result and removes its download", async ({
  page,
}) => {
  await setup(page);
  let deleted = false;
  await page.route("**/api/videos", (r) =>
    r.fulfill({
      json: {
        available: true,
        jobs: [{ ...result, status: deleted ? "expired" : "succeeded" }],
      },
    }),
  );
  await page.route(`**/api/videos/${id}`, (r) => {
    if (r.request().method() === "DELETE") deleted = true;
    return r.fulfill({
      json: { ...result, status: deleted ? "expired" : "succeeded" },
    });
  });
  await page.route(`**/api/videos/${id}/media*`, (r) =>
    r.fulfill({ contentType: "video/mp4", body: clip }),
  );
  await page.addInitScript(
    ({ id }) =>
      localStorage.setItem("editingapp-video:video-fixture@example.test", id),
    { id },
  );
  await page.goto("/tools/ai-photo-to-video");
  await page.getByRole("button", { name: "Delete files", exact: true }).click();
  await expect(
    page.getByRole("group", { name: "Confirm file deletion" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete files now" }).click();
  await expect(
    page.getByRole("heading", { name: "These files are no longer available." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Download MP4" })).toHaveCount(0);
  expect(deleted).toBe(true);
});
