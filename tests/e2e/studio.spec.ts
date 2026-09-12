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
    "Your face.A different decade.",
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
  await page.getByRole("button", { name: "Send my code" }).click();
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
