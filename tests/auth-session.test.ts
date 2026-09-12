import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Use the real Supabase SDK and the application's real cookie adapter. Only the
// Next request cookie jar and Supabase HTTP service are replaced by fixtures.
const jar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    getAll: () => [...jar.values].map(([name, value]) => ({ name, value })),
    set: jar.set,
  }),
}));
import { POST as authenticate } from "@/app/api/auth/route";
import { GET as callback } from "@/app/auth/callback/route";
import { GET as session } from "@/app/api/session/route";
import { requireUser } from "@/lib/server/supabase";
import { readAuthReturn } from "@/lib/auth-return";

const origin = "https://editingapp.example";
const user = {
  id: "b827395f-a85b-48a4-83dd-106a7348a7f6",
  email: "person@example.com",
  email_confirmed_at: "2026-09-12T00:00:00Z",
  is_anonymous: false,
  aud: "authenticated",
  role: "authenticated",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-09-12T00:00:00Z",
};
const jwt =
  [
    { alg: "HS256", typ: "JWT" },
    { sub: user.id, exp: Math.floor(Date.now() / 1000) + 3600 },
  ]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .join(".") + ".fixture-signature";
const tokens = {
  access_token: jwt,
  refresh_token: "fixture-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  user,
};
let http: ReturnType<typeof vi.fn>;

beforeEach(() => {
  for (const [name, value] of Object.entries({
    APP_URL: origin,
    SUPABASE_URL: "https://fixture.supabase.co",
    SUPABASE_ANON_KEY: "fixture-publishable-key",
    SUPABASE_SERVICE_ROLE_KEY: "fixture-service-key",
    FAL_KEY: "fixture-unused-fal-key",
    NODE_ENV: "production",
  }))
    vi.stubEnv(name, value);
  jar.values.clear();
  jar.set.mockReset().mockImplementation((name, value, options) => {
    if (options?.maxAge === 0) jar.values.delete(name);
    else jar.values.set(name, value);
  });
  http = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
    );
    if (url.pathname === "/auth/v1/otp") return Response.json({});
    if (url.pathname === "/auth/v1/token" || url.pathname === "/auth/v1/verify")
      return Response.json(tokens);
    if (url.pathname === "/auth/v1/user") {
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Bearer ${jwt}`,
      );
      return Response.json(user);
    }
    if (url.pathname === "/rest/v1/rpc/reserve_auth_email")
      return Response.json(null);
    if (url.pathname === "/rest/v1/portrait_jobs")
      return new Response(null, { headers: { "content-range": "*/0" } });
    throw new Error(`Unexpected fixture request: ${url.pathname}`);
  });
  vi.stubGlobal("fetch", http);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const send = () =>
  authenticate(
    new Request(`${origin}/api/auth`, {
      method: "POST",
      headers: { origin, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "send", email: user.email }),
    }),
  );
const open = (query: string) =>
  callback(new Request(`${origin}/auth/callback${query}`));

function expectPrivateRedirect(response: Response, outcome: string) {
  expect(response.status).toBe(303);
  expect(response.headers.get("location")).toBe(
    `${origin}/?auth=${outcome}#studio`,
  );
  expect(response.headers.get("cache-control")).toBe("no-store, private");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
}
async function expectSignedIn() {
  expect(await requireUser()).toMatchObject({ id: user.id });
  expect(await (await session()).json()).toMatchObject({
    user: { email: user.email },
    remaining: 3,
  });
  const writes = jar.set.mock.calls.filter(
    ([name, , options]) =>
      name.includes("auth-token") &&
      !name.includes("code-verifier") &&
      options.maxAge > 0,
  );
  expect(writes.length).toBeGreaterThan(0);
  for (const [, , options] of writes)
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
    });
}

describe("email link to authenticated server session", () => {
  it("exchanges a default email PKCE code using its saved verifier, then authenticates generation", async () => {
    expect((await send()).status).toBe(200);
    const otpCall = http.mock.calls.find(([url]) =>
      String(url).includes("/auth/v1/otp"),
    )!;
    expect(new URL(String(otpCall[0])).searchParams.get("redirect_to")).toBe(
      `${origin}/auth/callback`,
    );
    const otpBody = JSON.parse(otpCall[1].body);
    expect(otpBody.code_challenge_method).toBe("s256");
    expect(otpBody.code_challenge).toBeTruthy();
    expect(
      [...jar.values.keys()].some((name) => name.includes("code-verifier")),
    ).toBe(true);
    expectPrivateRedirect(
      await open("?code=fixture-auth-code&next=https://attacker.example"),
      "success",
    );
    const exchanges = http.mock.calls.filter(([url]) =>
      String(url).includes("grant_type=pkce"),
    );
    expect(exchanges).toHaveLength(1);
    expect(JSON.parse(exchanges[0][1].body)).toMatchObject({
      auth_code: "fixture-auth-code",
      code_verifier: expect.any(String),
    });
    await expectSignedIn();
  });
  it("verifies a custom template token hash without a same-browser PKCE verifier", async () => {
    expectPrivateRedirect(
      await open("?token_hash=fixture-hash&type=email"),
      "success",
    );
    const verify = http.mock.calls.find(([url]) =>
      String(url).endsWith("/auth/v1/verify"),
    )!;
    expect(JSON.parse(verify[1].body)).toMatchObject({
      token_hash: "fixture-hash",
      type: "email",
    });
    await expectSignedIn();
    expect(http.mock.calls.some(([url]) => String(url).includes("/otp"))).toBe(
      false,
    );
  });
  it("still saves a usable session when the user enters the numeric email code", async () => {
    const response = await authenticate(
      new Request(`${origin}/api/auth`, {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          email: user.email,
          token: "123456",
        }),
      }),
    );
    expect(response.status).toBe(200);
    await expectSignedIn();
  });
  it("explains a missing PKCE verifier instead of silently returning signed out", async () => {
    expectPrivateRedirect(await open("?code=fixture-auth-code"), "browser");
    expect(http).not.toHaveBeenCalled();
    expect(jar.values.size).toBe(0);
  });
  it("does not establish a session from an expired token or echo provider details", async () => {
    http.mockResolvedValue(
      Response.json(
        { code: "otp_expired", msg: "secret-private-details" },
        { status: 403 },
      ),
    );
    const response = await open("?token_hash=fixture-expired&type=email");
    expectPrivateRedirect(response, "expired");
    expect(http).toHaveBeenCalledTimes(1);
    expect(jar.values.size).toBe(0);
    expect(await response.text()).not.toContain("secret-private-details");
  });
  it("reports missing configuration without claiming a successful sign-in", async () => {
    vi.stubEnv("SUPABASE_URL", "");
    expectPrivateRedirect(
      await open("?token_hash=fixture-hash&type=email"),
      "unavailable",
    );
    expect(http).not.toHaveBeenCalled();
  });
  it.each([
    "",
    "?code=",
    "?code=a&code=b",
    "?token_hash=a&token_hash=b&type=email",
    "?token_hash=a",
    "?token_hash=a&type=recovery",
    "?token_hash=a&type=invite",
    "?code=a&token_hash=b&type=email",
    "?code=" + "x".repeat(2049),
    "?error=access_denied&error_description=private",
    "?code=a&error_code=otp_expired",
  ])(
    "rejects malformed or unrelated callbacks without any provider calls: %s",
    async (query) => {
      expectPrivateRedirect(await open(query), "expired");
      expect(http).not.toHaveBeenCalled();
      expect(jar.values.size).toBe(0);
    },
  );
});

describe("legacy homepage email returns", () => {
  it("forwards the auth code to the callback and strips it from browser history", () => {
    expect(
      readAuthReturn(
        `${origin}/?code=fixture-code&utm_source=email&next=https://attacker.example#studio`,
      ),
    ).toMatchObject({
      callback: "/auth/callback?code=fixture-code",
      cleanUrl: "/?utm_source=email&next=https%3A%2F%2Fattacker.example#studio",
    });
  });
  it("handles a token-hash link falling back to Supabase Site URL", () => {
    expect(
      readAuthReturn(`${origin}/?token_hash=fixture-hash&type=email`),
    ).toMatchObject({
      callback: "/auth/callback?token_hash=fixture-hash&type=email",
      cleanUrl: "/",
    });
  });
  it("cleans error fragments and never reflects their descriptions", () => {
    expect(
      readAuthReturn(
        `${origin}/#error=access_denied&error_description=private`,
      ),
    ).toEqual({
      callback: null,
      outcome: "expired",
      handled: true,
      cleanUrl: "/#studio",
    });
  });
  it("discards unsupported implicit-flow tokens without storing or exchanging them", () => {
    expect(
      readAuthReturn(`${origin}/#access_token=private&refresh_token=private`),
    ).toEqual({
      callback: null,
      outcome: "browser",
      handled: true,
      cleanUrl: "/#studio",
    });
  });
});
