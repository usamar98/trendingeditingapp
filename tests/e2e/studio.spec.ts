import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const photo = fs.readFileSync("public/images/studio.webp");
const generated = fs.readFileSync("public/images/cinema.webp");
async function session(page: Page, user = true) {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: user ? { email: "test@example.com" } : null,
        remaining: 3,
      },
    }),
  );
}
async function upload(page: Page) {
  await page.getByLabel("Upload your selfie").setInputFiles({
    name: "selfie.webp",
    mimeType: "image/webp",
    buffer: photo,
  });
  await expect(page.getByText("Selfie ready. Change photo?")).toBeVisible();
  await page.getByRole("checkbox").check();
}
test("landing, mobile layout, indexable SEO, invalid upload and accessibility", async ({
  page,
  request,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Your face.An 80s AI portrait.",
  );
  await expect(page.getByText("Generation is awaiting setup.")).toBeVisible();
  await page.getByRole("radio", { name: /Retro Cinema/ }).check();
  await expect(page.getByRole("radio", { name: /Retro Cinema/ })).toBeChecked();
  await page.getByLabel("Upload your selfie").setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "Choose a JPG",
  );
  await upload(page);
  await page.getByRole("button", { name: "Create my retro portrait" }).click();
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "not connected",
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  await page.screenshot({
    path: `test-results/${info.project.name}-home.png`,
    fullPage: true,
  });
  const html = await (await request.get("/")).text();
  expect(html).toContain("application/ld+json");
  expect(html).toContain('rel="canonical"');
  expect(html).toContain("What is an AI retro portrait?");
  expect((await request.get("/sitemap.xml")).status()).toBe(200);
  expect((await request.get("/robots.txt")).status()).toBe(200);
  expect((await request.get("/opengraph-image")).status()).toBe(200);
  expect((await request.get("/api/cron/cleanup")).status()).toBe(401);
});
test("fixture-backed upload, generate, compare, both downloads, and delete", async ({
  page,
}, info) => {
  await session(page);
  let calls = 0;
  let id = "";
  await page.route("**/api/portraits", async (route) => {
    calls++;
    const body = route.request().postDataBuffer()!.toString();
    id = body.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i,
    )![0];
    await route.fulfill({
      json: { id, status: "succeeded", preset: "studio" },
    });
  });
  await page.route("**/api/portraits/*/image*", (route) =>
    route.fulfill({
      contentType: "image/webp",
      body: route.request().url().includes("kind=original") ? photo : generated,
    }),
  );
  await page.route("**/api/portraits/*", (route) =>
    route.fulfill({
      json:
        route.request().method() === "DELETE"
          ? { ok: true }
          : { id, status: "succeeded", preset: "studio" },
    }),
  );
  await page.goto("/");
  await upload(page);
  await page
    .getByRole("button", { name: "Generate my retro portrait" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your retro moment." }),
  ).toBeVisible();
  expect(calls).toBe(1);
  const resultAccessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    resultAccessibility.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.getByRole("button", { name: "Compare slider" }).click();
  await page.getByRole("slider").fill("70");
  await page.getByRole("button", { name: "Side by side" }).click();
  for (const [label, filename] of [
    ["Download portrait", "editingapp-retro-portrait.png"],
    ["Before & after", "editingapp-before-and-after.png"],
  ]) {
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: label, exact: true }).click();
    const download = await downloading;
    expect(download.suggestedFilename()).toBe(filename);
    await download.saveAs(`test-results/${info.project.name}-${filename}`);
  }
  await page.screenshot({
    path: `test-results/${info.project.name}-result.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Delete photos now" }).click();
  await expect(page.getByText("Drop your selfie here")).toBeVisible();
  expect(calls).toBe(1);
});
test("fixture-backed verified email flow and failed generation recovery", async ({
  page,
}) => {
  await session(page, false);
  await page.route("**/api/auth", async (route) => {
    const body = route.request().postDataJSON();
    if (body.action === "verify") await session(page);
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/portraits", (route) =>
    route.fulfill({
      json: {
        id: "b827395f-a85b-48a4-83dd-106a7348a7f6",
        status: "failed",
        preset: "studio",
      },
    }),
  );
  await page.goto("/");
  await upload(page);
  await page.getByRole("button", { name: "Create my retro portrait" }).click();
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByRole("button", { name: "Send sign-in email" }).click();
  await page.getByLabel("Code from your email").fill("123456");
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page
    .getByRole("button", { name: "Generate my retro portrait" })
    .click();
  await expect(
    page.getByRole("heading", { name: "This portrait didn’t develop." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start another portrait" }).click();
  await expect(
    page.getByRole("button", { name: "Generate my retro portrait" }),
  ).toBeEnabled();
});
test("fixture-backed link sign-in updates the original upload tab without another email", async ({
  page,
  context,
}) => {
  let signedIn = false;
  let emails = 0;
  let generations = 0;
  await context.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: signedIn ? { email: "test@example.com" } : null,
        remaining: 3,
      },
    }),
  );
  await page.route("**/api/auth", (route) => {
    emails++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/portraits", (route) => {
    generations++;
    return route.fulfill({
      json: {
        id: "b827395f-a85b-48a4-83dd-106a7348a7f6",
        status: "failed",
        preset: "studio",
      },
    });
  });
  await page.goto("/");
  await upload(page);
  await page.getByRole("button", { name: "Create my retro portrait" }).click();
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByRole("button", { name: "Send sign-in email" }).click();
  await expect(
    page.getByRole("button", { name: "I opened the email link" }),
  ).toBeVisible();
  const a11y = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(a11y.violations).toEqual([]);
  // The real SDK/cookie handoff is separately tested in auth-session.test.ts.
  // This fixture represents the callback returning with a saved session.
  signedIn = true;
  const emailTab = await context.newPage();
  await emailTab.goto("/?auth=success#studio");
  await expect(emailTab.getByRole("status")).toContainText("You’re signed in");
  await expect(emailTab).toHaveURL(/\/#studio$/);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("Selfie ready. Change photo?")).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeChecked();
  expect(generations).toBe(0);
  await page.bringToFront();
  await page
    .getByRole("button", { name: "Generate my retro portrait" })
    .click();
  await expect(
    page.getByRole("heading", { name: "This portrait didn’t develop." }),
  ).toBeVisible();
  expect(generations).toBe(1);
  expect(emails).toBe(1);
});

test("fixture-backed email limit pauses resends but permits an existing code", async ({
  page,
}) => {
  await session(page, false);
  let sends = 0;
  let verifications = 0;
  await page.route("**/api/auth", async (route) => {
    if (route.request().postDataJSON().action === "send") {
      sends++;
      return route.fulfill({
        status: 429,
        json: {
          code: "AUTH_SEND_LIMIT",
          error:
            "Email sending is temporarily limited. Use an unused link or code you already received, or try later. If this continues, contact the site owner.",
        },
      });
    }
    verifications++;
    await session(page);
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/");
  await upload(page);
  await page.getByRole("button", { name: "Create my retro portrait" }).click();
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByRole("button", { name: "Send sign-in email" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "unused link or code",
  );
  await expect(
    page.getByRole("button", { name: "Send sign-in email" }),
  ).toBeDisabled();
  await expect(page.getByText(/Provider limits may last longer/)).toBeVisible();
  await page.getByRole("button", { name: "Enter an existing code" }).click();
  await page.getByLabel("Code from your email").fill("123456");
  await expect(
    page.getByRole("button", { name: "Verify email", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Verify email", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(sends).toBe(1);
  expect(verifications).toBe(1);
});

test("fixture-backed resend countdown ends without sending automatically", async ({
  page,
}) => {
  await page.clock.install();
  await session(page, false);
  let sends = 0;
  let completeSend: (() => Promise<void>) | undefined;
  await page.route("**/api/auth", (route) => {
    sends++;
    completeSend = async () => {
      await route.fulfill({ json: { ok: true } });
    };
  });
  await page.goto("/");
  await upload(page);
  await page.getByRole("button", { name: "Create my retro portrait" }).click();
  await page.getByLabel("Email address").fill("test@example.com");
  await page.getByRole("button", { name: "Send sign-in email" }).click();
  await expect.poll(() => sends).toBe(1);
  // Bypass the disabled button to exercise the synchronous submit lock.
  await page.locator(".auth-dialog form").evaluate((form) => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true }),
    );
  });
  await completeSend!();
  await page
    .getByRole("button", { name: "Use another email or request a new email" })
    .click();
  await expect(
    page.getByRole("button", { name: "Send sign-in email" }),
  ).toBeDisabled();
  await page.clock.fastForward(61_000);
  await expect(
    page.getByRole("button", { name: "Send sign-in email" }),
  ).toBeEnabled();
  expect(sends).toBe(1);
});

test("fixture-backed Generate refreshes a stale signed-out session before opening the email dialog", async ({
  page,
}) => {
  let signedIn = false;
  let generations = 0;
  let emailRequests = 0;
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        configured: true,
        user: signedIn ? { email: "test@example.com" } : null,
        remaining: 3,
      },
    }),
  );
  await page.route("**/api/auth", (route) => {
    emailRequests++;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/portraits", (route) => {
    generations++;
    return route.fulfill({
      json: {
        id: "b827395f-a85b-48a4-83dd-106a7348a7f6",
        status: "failed",
        preset: "studio",
      },
    });
  });
  await page.goto("/");
  await upload(page);
  signedIn = true; // No focus or cross-tab event: force the pre-generation check.
  await page.getByRole("button", { name: "Create my retro portrait" }).click();
  await expect(
    page.getByRole("heading", { name: "This portrait didn’t develop." }),
  ).toBeVisible();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  expect(generations).toBe(1);
  expect(emailRequests).toBe(0);
});

test("legacy email return is handled, strips its code and shows actionable expiry errors", async ({
  page,
  request,
}) => {
  await session(page, false);
  let callbacks = 0;
  await page.route("**/auth/callback?code=fixture-old-email-code", (route) => {
    callbacks++;
    return route.fulfill({
      status: 303,
      headers: { location: "/?auth=expired#studio" },
    });
  });
  await page.goto("/?code=fixture-old-email-code");
  await expect(page.locator('.error[role="alert"]')).toContainText(
    "sign-in link is invalid or expired",
  );
  await expect(page).toHaveURL(/\/#studio$/);
  expect(callbacks).toBe(1);
  const response = await request.get(
    "/auth/callback?type=recovery&token_hash=invalid",
    { maxRedirects: 0 },
  );
  expect(response.status()).toBe(303);
  expect(response.headers()["location"]).toBe(
    "http://localhost:3001/?auth=expired#studio",
  );
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(response.headers()["referrer-policy"]).toBe("no-referrer");
  expect(response.headers()["x-robots-tag"]).toBe("noindex, nofollow");
});
test("fixture-backed connection loss reconnects by status, without a second POST", async ({
  page,
}) => {
  await session(page);
  let calls = 0;
  await page.route("**/api/portraits", (route) => {
    calls++;
    return route.abort("failed");
  });
  await page.route("**/api/portraits/*", (route) =>
    route.fulfill({
      json: {
        id: "b827395f-a85b-48a4-83dd-106a7348a7f6",
        status: "uncertain",
        preset: "studio",
      },
    }),
  );
  await page.goto("/");
  await upload(page);
  await page
    .getByRole("button", { name: "Generate my retro portrait" })
    .click();
  await expect(
    page.getByRole("button", { name: "Check request", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check request", exact: true })
    .click();
  await expect(
    page.getByText(/uncertain request keeps its allowance/),
  ).toBeVisible();
  expect(calls).toBe(1);
  await expect(
    page.getByRole("button", { name: "Generate my retro portrait" }),
  ).toBeDisabled();
});
