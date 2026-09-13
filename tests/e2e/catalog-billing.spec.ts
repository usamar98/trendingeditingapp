import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import fs from "node:fs";
const photo = fs.readFileSync("public/images/studio.webp");
const figure = fs.readFileSync("public/images/figurine-desk.png");
const id = "b827395f-a85b-48a4-83dd-106a7348a7f6";
async function session(page: Page, credits = 9, user = true) {
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        configured: true,
        authConfigured: true,
        creditMode: "credits",
        credits,
        remaining: Math.floor(credits / 3),
        billingReady: true,
        user: user
          ? { email: "fixture@example.test", displayName: "Alex" }
          : null,
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
async function accessible(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
  ).toBe(false);
  const check = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(
    check.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
}
test("catalog cards, annual prices and new pages are accessible (no paid requests)", async ({
  page,
  request,
}, info) => {
  await session(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "AI photo tools.Your next alter ego.",
  );
  await expect(page.locator(".tool-card")).toHaveCount(2);
  await accessible(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-catalog-top.png`,
  });
  await page.screenshot({
    path: `test-results/${info.project.name}-catalog.png`,
    fullPage: true,
  });
  await page
    .getByRole("link", { name: "Explore AI Figurine Generator" })
    .click();
  await expect(page).toHaveURL(/tools\/ai-figurine-generator$/);
  await expect(page.getByRole("radio")).toHaveCount(2);
  await accessible(page);
  await page.goto("/pricing");
  await expect(page.locator(".plan-price")).toHaveText([
    "$19/month",
    "$39/month",
    "$100/month",
  ]);
  await page.getByRole("button", { name: /Yearly/ }).click();
  await expect(page.locator(".plan-price")).toHaveText([
    "$190/year",
    "$390/year",
    "$1,000/year",
  ]);
  await expect(page.locator(".plan-credits")).toHaveText([
    "7,200 credits per year",
    "16,800 credits per year",
    "48,000 credits per year",
  ]);
  await accessible(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-pricing.png`,
    fullPage: true,
  });
  const account = await request.get("/account");
  expect(account.headers()["x-robots-tag"]).toContain("noindex");
  expect(await account.text()).toContain("noindex");
});
test("simulated figurine upload uses the selected feature and credits, compares and downloads", async ({
  page,
}, info) => {
  await session(page);
  let calls = 0;
  await page.route("**/api/portraits", async (route) => {
    calls++;
    const body = route.request().postDataBuffer()!.toString();
    expect(body).toContain('name="featureId"\r\n\r\nai-figurine');
    expect(body).toContain('name="preset"\r\n\r\nfigurine-box');
    expect(body).toContain('name="quality"\r\n\r\nhigh');
    await session(page, 1);
    await route.fulfill({
      json: {
        id,
        preset: "figurine-box",
        featureId: "ai-figurine",
        status: "succeeded",
        creditsCharged: 8,
      },
    });
  });
  await page.route("**/api/portraits/*/image*", (route) =>
    route.fulfill({
      contentType: route.request().url().includes("kind=original")
        ? "image/webp"
        : "image/png",
      body: route.request().url().includes("kind=original") ? photo : figure,
    }),
  );
  await page.goto("/tools/ai-figurine-generator");
  await page.getByRole("radio", { name: /Boxed Edition/ }).check();
  await upload(page);
  await page.getByText("Advanced", { exact: true }).click();
  await page.getByLabel("Portrait detail").selectOption("high");
  await expect(
    page.getByText("8 credits per image · 9 available"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Generate my figurine" }).click();
  await expect(
    page.getByRole("heading", { name: "Your miniature moment.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".credit-chip")).toContainText("1 credits");
  expect(calls).toBe(1);
  await accessible(page);
  await page.getByRole("button", { name: "Compare slider" }).click();
  await page.getByRole("slider").fill("65");
  for (const [name, filename] of [
    ["Download figurine", "editingapp-figurine.png"],
    ["Before & after", "editingapp-before-and-after.png"],
  ]) {
    const downloaded = page.waitForEvent("download");
    await page.getByRole("button", { name, exact: true }).click();
    const file = await downloaded;
    expect(file.suggestedFilename()).toBe(filename);
    await file.saveAs(`test-results/${info.project.name}-${filename}`);
  }
  expect(calls).toBe(1);
});
test("simulated low balance and confirmed failure keep credit controls accurate", async ({
  page,
}) => {
  await session(page, 3);
  await page.goto("/tools/ai-figurine-generator");
  await upload(page);
  await page.getByText("Advanced", { exact: true }).click();
  await page.getByLabel("Portrait detail").selectOption("high");
  await expect(
    page.getByRole("button", { name: "Generate my figurine" }),
  ).toBeDisabled();
  await page.getByLabel("Portrait detail").selectOption("medium");
  let calls = 0;
  await page.route("**/api/portraits", (route) => {
    calls++;
    return route.fulfill({
      json: {
        id,
        preset: "figurine-desk",
        status: "failed",
        featureId: "ai-figurine",
        creditsCharged: 3,
      },
    });
  });
  await page.getByRole("button", { name: "Generate my figurine" }).click();
  await expect(page.getByText(/Your credits have been restored/)).toBeVisible();
  await expect(page.locator(".credit-chip")).toContainText("3 credits");
  expect(calls).toBe(1);
});
test("simulated header signup, profile save and account balance", async ({
  page,
}, info) => {
  await session(page, 9, false);
  let signedIn = false;
  let name = "Alex";
  let saved = 0;
  await page.route("**/api/session", (route) =>
    route.fulfill({
      json: {
        configured: true,
        creditMode: "credits",
        credits: 9,
        remaining: 3,
        billingReady: true,
        user: signedIn
          ? { email: "fixture@example.test", displayName: name }
          : null,
      },
    }),
  );
  await page.route("**/api/auth", (route) => {
    if (route.request().postDataJSON().action === "verify") signedIn = true;
    return route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/account", (route) => {
    if (route.request().method() === "PATCH") {
      name = route.request().postDataJSON().displayName;
      saved++;
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({
      json: {
        email: "fixture@example.test",
        profile: { displayName: name, bio: "Photo ideas" },
        credits: 9,
        billingHold: false,
        hasCustomer: false,
        subscription: null,
        grants: [
          {
            remaining: 9,
            expires_at: "2026-10-13T00:00:00Z",
            source: "welcome",
          },
        ],
        activity: [
          { delta: 9, kind: "welcome", created_at: "2026-09-13T00:00:00Z" },
        ],
      },
    });
  });
  await page.goto("/");
  await page.locator(".header-account-button").click();
  await page.getByRole("button", { name: "Sign up", exact: true }).click();
  await page.getByLabel("Account email").fill("fixture@example.test");
  await page
    .getByRole("button", { name: "Send sign-in link", exact: true })
    .click();
  await expect(page.getByLabel("Email verification code")).toBeVisible();
  await accessible(page);
  await page.getByLabel("Email verification code").fill("123456");
  await page.getByRole("button", { name: "Verify and continue" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Your account", { exact: true }).click();
  await page.getByRole("link", { name: "Profile & credits" }).click();
  await expect(page.getByLabel("Display name")).toHaveValue("Alex");
  await page.getByLabel("Display name").fill("Alex Rivera");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Your profile is saved.")).toBeVisible();
  expect(saved).toBe(1);
  await accessible(page);
  await page.screenshot({
    path: `test-results/${info.project.name}-account.png`,
    fullPage: true,
  });
});
test("simulated checkout failure never grants credits and return URL cannot fake a purchase", async ({
  page,
}) => {
  await session(page);
  let calls = 0;
  await page.route("**/api/billing/checkout", (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({
      plan: "creator",
      interval: "year",
    });
    return route.fulfill({
      status: 503,
      json: { error: "Payment setup is unavailable. No charge has been made." },
    });
  });
  await page.goto("/pricing");
  await page.getByRole("button", { name: /Yearly/ }).click();
  await page.getByRole("button", { name: "Choose Creator" }).click();
  await expect(page.locator(".pricing-error[role=alert]")).toContainText(
    "No charge",
  );
  expect(calls).toBe(1);
  await expect(page.locator(".credit-chip")).toContainText("9 credits");
  await page.route("**/api/account", (route) =>
    route.fulfill({
      json: {
        email: "fixture@example.test",
        profile: { displayName: "Alex", bio: "" },
        credits: 9,
        billingHold: false,
        hasCustomer: false,
        subscription: null,
        grants: [],
        activity: [],
      },
    }),
  );
  await page.goto("/account?checkout=complete");
  await expect(page.locator(".account-payment-note")).toContainText(
    "Checking payment",
  );
  await expect(page.locator(".balance-card h2")).toHaveText("9 credits");
});
