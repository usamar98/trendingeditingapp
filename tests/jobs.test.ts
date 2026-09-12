import { beforeEach, describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import type { Job } from "@/lib/server/jobs";
const fake = vi.hoisted(() => ({
  job: {} as Record<string, unknown>,
  objects: new Map<string, Buffer>(),
  uploadFailure: false,
  updateFailure: false,
  provider: vi.fn(),
}));
vi.mock("@/lib/server/provider", async (original) => {
  const real = await original<typeof import("@/lib/server/provider")>();
  return { ...real, editPortrait: fake.provider };
});
vi.mock("@/lib/server/supabase", () => ({
  admin: () => ({
    from: () => ({
      update: (values: Record<string, unknown>) => {
        const chain = {
          eq: () => chain,
          then: (resolve: (value: { error: Error | null }) => void) => {
            if (!fake.updateFailure) Object.assign(fake.job, values);
            resolve({
              error: fake.updateFailure ? new Error("db offline") : null,
            });
          },
        };
        return chain;
      },
      select: () => {
        const chain = {
          eq: () => chain,
          maybeSingle: async () => ({ data: fake.job, error: null }),
        };
        return chain;
      },
    }),
    storage: {
      from: () => ({
        upload: async (path: string, bytes: Buffer) => {
          if (fake.uploadFailure)
            return { error: new Error("storage unavailable") };
          fake.objects.set(path, bytes);
          return { error: null };
        },
        list: async () => ({
          data: [...fake.objects.keys()]
            .filter((k) => k.endsWith("portrait.png"))
            .map(() => ({ name: "portrait.png" })),
          error: null,
        }),
        remove: async (paths: string[]) => {
          paths.forEach((p) => fake.objects.delete(p));
          return { error: null };
        },
      }),
    },
  }),
}));
import { runJob, recoverJob, deletePhotos, publicJob } from "@/lib/server/jobs";
import { ProviderError } from "@/lib/server/provider";
beforeEach(() => {
  fake.objects.clear();
  fake.provider.mockReset();
  fake.uploadFailure = false;
  fake.updateFailure = false;
  fake.job = {
    id: "b827395f-a85b-48a4-83dd-106a7348a7f6",
    user_id: "user",
    fingerprint: "test",
    preset: "studio",
    quality: "medium",
    status: "reserved",
    error_code: null,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 86400000).toISOString(),
  };
});
describe("generation lifecycle with fake provider and storage", () => {
  it("stores original, validates output, completes and deletes private photos", async () => {
    const png = await sharp({
      create: { width: 1024, height: 1536, channels: 3, background: "#ccc" },
    })
      .png()
      .toBuffer();
    fake.provider.mockResolvedValue({
      bytes: png,
      requestId: "req_test",
      usage: { total_tokens: 10 },
    });
    const job = await runJob(
      { ...fake.job } as Job,
      Buffer.from("normalized-original"),
    );
    expect(job.status).toBe("succeeded");
    expect(job.provider).toBe("fal");
    expect(job.provider_model).toBe("openai/gpt-image-2.5/sunburst/edit");
    expect(fake.provider).toHaveBeenCalledTimes(1);
    expect(fake.objects.size).toBe(2);
    await deletePhotos(job);
    expect(fake.objects.size).toBe(0);
    expect(fake.job.status).toBe("expired");
  });
  it("restores allowance after confirmed provider failure, but retains it on timeout", async () => {
    fake.provider.mockRejectedValue(
      new ProviderError(false, "PROVIDER_REJECTED"),
    );
    await runJob({ ...fake.job } as Job, Buffer.from("input"));
    expect(fake.job.status).toBe("failed");
    expect(fake.job.consumes_allowance).toBe(false);
    fake.provider.mockRejectedValue(
      new ProviderError(true, "CONNECTION_UNCERTAIN"),
    );
    await runJob({ ...fake.job } as Job, Buffer.from("input"));
    expect(fake.job.status).toBe("uncertain");
    expect(fake.job.consumes_allowance).toBe(true);
  });
  it("does not call provider when input storage fails", async () => {
    fake.uploadFailure = true;
    await runJob({ ...fake.job } as Job, Buffer.from("input"));
    expect(fake.provider).not.toHaveBeenCalled();
    expect(fake.job.status).toBe("failed");
  });
  it("recovers a saved result without a second billable request", async () => {
    fake.job.status = "uncertain";
    fake.objects.set("user/id/portrait.png", Buffer.from("saved"));
    const recovered = await recoverJob(fake.job as Job);
    expect(recovered.status).toBe("succeeded");
    expect(fake.provider).not.toHaveBeenCalled();
  });
  it("expires photo access and surfaces stuck requests as uncertain", () => {
    const stale = {
      ...fake.job,
      created_at: new Date(Date.now() - 300000).toISOString(),
      status: "processing",
    } as Job;
    expect(publicJob(stale).status).toBe("uncertain");
    expect(
      publicJob({ ...stale, expires_at: new Date(0).toISOString() }).status,
    ).toBe("expired");
  });
});
