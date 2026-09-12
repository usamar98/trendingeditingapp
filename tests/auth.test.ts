import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
const fake = vi.hoisted(() => ({
  reserve: vi.fn(),
  send: vi.fn(),
  verify: vi.fn(),
  signout: vi.fn(),
}));
vi.mock("@/lib/server/supabase", () => ({
  admin: () => ({ rpc: fake.reserve }),
  authClient: async () => ({
    auth: {
      signInWithOtp: fake.send,
      verifyOtp: fake.verify,
      signOut: fake.signout,
    },
  }),
}));
import { POST } from "@/app/api/auth/route";
beforeEach(() => {
  vi.stubEnv("APP_URL", "http://localhost:3001");
  Object.values(fake).forEach((mock) =>
    mock.mockReset().mockResolvedValue({ error: null }),
  );
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const send = (
  body: Record<string, string> = {
    action: "send",
    email: "person@example.com",
  },
) =>
  POST(
    new Request("http://localhost:3001/api/auth", {
      method: "POST",
      headers: {
        origin: "http://localhost:3001",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );

describe("email authentication error handling", () => {
  it("sends exactly one code after a successful atomic reservation", async () => {
    expect((await send()).status).toBe(200);
    expect(fake.reserve).toHaveBeenCalledWith("reserve_auth_email", {
      p_email_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(fake.send).toHaveBeenCalledTimes(1);
    expect(fake.send).toHaveBeenCalledWith({
      email: "person@example.com",
      options: {
        shouldCreateUser: true,
        captchaToken: undefined,
        emailRedirectTo: "http://localhost:3001/auth/callback",
      },
    });
    expect(console.error).not.toHaveBeenCalled();
  });
  it("only reports an application email limit for the SQL quota exception", async () => {
    fake.reserve.mockResolvedValue({
      error: { code: "P0001", message: "LIMIT" },
      status: 400,
    });
    const response = await send();
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      code: "AUTH_LIMIT",
      error: expect.stringContaining("up to an hour"),
    });
    expect(fake.send).not.toHaveBeenCalled();
  });
  it.each([
    ["PGRST202", 404, "AUTH_SETUP", "database_setup"],
    ["42P01", 404, "AUTH_SETUP", "database_setup"],
    ["42501", 403, "AUTH_SETUP", "database_access"],
    [undefined, 401, "AUTH_SETUP", "database_access"],
    [undefined, 503, "AUTH_UNAVAILABLE", "database_unavailable"],
    ["P0001", 400, "AUTH_UNAVAILABLE", "database_unavailable"],
  ])(
    "does not disguise database error %s/%s as a limit",
    async (code, status, expected, category) => {
      fake.reserve.mockResolvedValue({
        error: {
          code,
          message: "private-person@example.com service-key LIMIT details",
        },
        status,
      });
      const response = await send();
      const body = await response.json();
      expect(response.status).toBe(503);
      expect(body.code).toBe(expected);
      expect(fake.send).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(
        "EditingApp authentication unavailable",
        expect.objectContaining({ stage: "email_reservation", category }),
      );
      const output = JSON.stringify([
        body,
        vi.mocked(console.error).mock.calls,
      ]);
      expect(output).not.toContain("private-person");
      expect(output).not.toContain("service-key");
    },
  );
  it.each([
    ["over_email_send_rate_limit", 429, "AUTH_SEND_LIMIT", 429],
    ["over_request_rate_limit", 429, "AUTH_REQUEST_LIMIT", 429],
    [undefined, 429, "AUTH_REQUEST_LIMIT", 429],
    ["email_address_not_authorized", 400, "AUTH_EMAIL_SETUP", 503],
    ["otp_disabled", 422, "AUTH_EMAIL_SETUP", 503],
    ["email_address_invalid", 422, "EMAIL", 400],
    [undefined, 500, "AUTH_SEND", 503],
  ])(
    "distinguishes email delivery error %s from database limits",
    async (code, status, expected, responseStatus) => {
      fake.send.mockResolvedValue({
        error: { code, status, message: "private delivery details" },
      });
      const response = await send();
      expect(response.status).toBe(responseStatus);
      expect((await response.json()).code).toBe(expected);
      expect(fake.send).toHaveBeenCalledTimes(1);
    },
  );
  it("logs the safe provider limit code and offers existing-email recovery without retrying", async () => {
    fake.send.mockResolvedValue({
      error: {
        code: "over_email_send_rate_limit",
        status: 429,
        message: "private-person@example.com private-token",
      },
    });
    const response = await send();
    const body = await response.json();
    expect(body.error).toContain("unused link or code");
    expect(body.error).toContain("site owner");
    expect(fake.send).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith(
      "EditingApp authentication unavailable",
      {
        stage: "email_send",
        category: "email_send_limit",
        code: "over_email_send_rate_limit",
      },
    );
    expect(
      JSON.stringify([body, vi.mocked(console.error).mock.calls]),
    ).not.toContain("private-");
  });
  it("can verify an existing code without another reservation or email send", async () => {
    expect(
      (
        await send({
          action: "verify",
          email: "person@example.com",
          token: "123456",
        })
      ).status,
    ).toBe(200);
    expect(fake.reserve).not.toHaveBeenCalled();
    expect(fake.send).not.toHaveBeenCalled();
    expect(fake.verify).toHaveBeenCalledWith({
      email: "person@example.com",
      token: "123456",
      type: "email",
    });
  });
});
