import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid,bucket_id text); alter table storage.objects enable row level security;`,
  );
  for (const file of [
    "202609120001_portraits.sql",
    "202609120002_fal_provider.sql",
    "202609130001_credits_billing_figures.sql",
    "202609130002_photo_video.sql",
  ])
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
});
afterAll(() => db.close());
async function user(credits = 1000) {
  const id = randomUUID();
  await db.query("insert into auth.users values($1)", [id]);
  await db.query("select ensure_account($1)", [id]);
  await db.query(
    "insert into credit_grants(id,user_id,source,total,remaining,expires_at) values($1,$2,'adjustment',$3,$3,now()+interval '1 year')",
    [id, id, credits],
  );
  return id;
}
async function balance(uid: string) {
  return (
    await db.query<{ n: number }>(
      "select sum(remaining)::int as n from credit_grants where user_id=$1",
      [uid],
    )
  ).rows[0].n;
}
async function reserve(
  uid: string,
  id: string = randomUUID(),
  fingerprint: string = id,
  preset = "cinematic",
  credits = 60,
) {
  return (
    await db.query<{
      r: {
        fresh: boolean;
        job: { id: string; status: string; credits_charged: number };
      };
    }>("select reserve_video_job($1,$2,$3,$4,$5) r", [
      id,
      uid,
      fingerprint,
      preset,
      credits,
    ])
  ).rows[0].r;
}
const settle = (id: string, uncertain = false) =>
  db.query("select settle_video_failure($1,$2,'TEST_FAILURE')", [
    id,
    uncertain,
  ]);
describe("video reservation, billing and worker migration — PostgreSQL", () => {
  it("charges exactly once for concurrent repeated IDs and active duplicate payloads", async () => {
    const uid = await user(),
      id = randomUUID();
    const results = await Promise.all([
      reserve(uid, id),
      reserve(uid, id),
      reserve(uid, randomUUID(), id),
    ]);
    expect(results.map((r) => r.fresh)).toEqual([true, false, false]);
    expect(results.every((r) => r.job.id === id)).toBe(true);
    expect(await balance(uid)).toBe(949);
  });
  it("rejects cross-user IDs and changed inputs", async () => {
    const a = await user(),
      b = await user(),
      id = randomUUID();
    await reserve(a, id);
    await expect(reserve(b, id)).rejects.toThrow("CONFLICT");
    await expect(reserve(a, id, "changed")).rejects.toThrow("CONFLICT");
    expect(await balance(b)).toBe(1009);
  });
  it("rejects insufficient credits atomically and refuses a stale price", async () => {
    const uid = await user(1);
    await expect(reserve(uid)).rejects.toThrow("CREDITS");
    await expect(
      reserve(uid, randomUUID(), "changed", "cinematic", 3),
    ).rejects.toThrow("FEATURE_DISABLED");
    expect(await balance(uid)).toBe(10);
  });
  it("prices motion independently and allows only one active video", async () => {
    const uid = await user();
    const job = await reserve(uid, randomUUID(), "motion", "motion", 90);
    expect(job.job.credits_charged).toBe(90);
    await expect(reserve(uid)).rejects.toThrow("BUSY");
    expect(await balance(uid)).toBe(919);
  });
  it("shares the daily spend cap with image requests in both directions", async () => {
    const uid = await user();
    await db.exec("update generation_limits set daily_budget_cents=1");
    try {
      await expect(reserve(uid)).rejects.toThrow("RATE_LIMIT");
      await expect(
        db.query(
          "select reserve_image_job($1,$2,'image','retro-portrait','studio','medium')",
          [randomUUID(), uid],
        ),
      ).rejects.toThrow("RATE_LIMIT");
      expect(await balance(uid)).toBe(1009);
    } finally {
      await db.exec("update generation_limits set daily_budget_cents=2500");
    }
  });
  it("prevents image dispatch while the user's video is active", async () => {
    const uid = await user();
    await reserve(uid);
    await expect(
      db.query(
        "select reserve_image_job($1,$2,'image','retro-portrait','studio','medium')",
        [randomUUID(), uid],
      ),
    ).rejects.toThrow("BUSY");
  });
  it("keeps uncertain credits reserved and refunds a definitive failure only once", async () => {
    const uid = await user(),
      r = await reserve(uid);
    await settle(r.job.id, true);
    expect(await balance(uid)).toBe(949);
    const expiry = await db.query(
      "select id,expires_at from credit_grants where user_id=$1 order by id",
      [uid],
    );
    await Promise.all([settle(r.job.id), settle(r.job.id)]);
    expect(await balance(uid)).toBe(1009);
    expect(
      (
        await db.query(
          "select id,expires_at from credit_grants where user_id=$1 order by id",
          [uid],
        )
      ).rows,
    ).toEqual(expiry.rows);
  });
  it("does not refund completed or deleted requests", async () => {
    const uid = await user(),
      r = await reserve(uid);
    await db.query("update video_jobs set status='succeeded' where id=$1", [
      r.job.id,
    ]);
    await settle(r.job.id);
    expect(await balance(uid)).toBe(949);
    await db.query("update video_jobs set status='expired' where id=$1", [
      r.job.id,
    ]);
    await settle(r.job.id);
    expect(await balance(uid)).toBe(949);
  });
  it("gives exactly one worker the lease and prevents deletion racing it", async () => {
    const uid = await user(),
      r = await reserve(uid);
    const claim = () =>
      db.query<{ r: unknown }>("select claim_video_job($1,$2,false) r", [
        r.job.id,
        randomUUID(),
      ]);
    const claims = await Promise.all([claim(), claim(), claim()]);
    expect(claims.filter((r) => r.rows[0].r !== null)).toHaveLength(1);
    expect(
      (
        await db.query<{ r: unknown }>("select claim_video_job($1,$2,true) r", [
          r.job.id,
          randomUUID(),
        ])
      ).rows[0].r,
    ).toBeNull();
  });
  it("allows recovery after a dead worker lease expires, never another dispatch", async () => {
    const uid = await user(),
      r = await reserve(uid),
      lease = randomUUID();
    await db.query("select claim_video_job($1,$2,false)", [r.job.id, lease]);
    await db.query(
      "update video_jobs set lease_until=now()-interval '1 minute',next_check_at=now()-interval '1 minute' where id=$1",
      [r.job.id],
    );
    const reclaimed = await db.query<{ r: { lease_id: string } }>(
      "select claim_video_job($1,$2,false) r",
      [r.job.id, randomUUID()],
    );
    expect(reclaimed.rows[0].r.lease_id).not.toBe(lease);
    expect((await reserve(uid, r.job.id)).fresh).toBe(false);
  });
  it("blocks active deletion then permits deletion after the interrupted-request window", async () => {
    const uid = await user(),
      r = await reserve(uid);
    await expect(
      db.query("select claim_video_job($1,$2,true)", [r.job.id, randomUUID()]),
    ).rejects.toThrow("BUSY");
    await db.query(
      "update video_jobs set created_at=now()-interval '61 minutes' where id=$1",
      [r.job.id],
    );
    expect(
      (
        await db.query<{ r: unknown }>("select claim_video_job($1,$2,true) r", [
          r.job.id,
          randomUUID(),
        ])
      ).rows[0].r,
    ).not.toBeNull();
  });
  it("keeps video tables and mutation RPCs server-only and the bucket private", async () => {
    const p = await db.query<{ client: boolean; server: boolean }>(
      "select has_function_privilege('authenticated','reserve_video_job(uuid,uuid,text,text,integer)','execute') client,has_function_privilege('service_role','reserve_video_job(uuid,uuid,text,text,integer)','execute') server",
    );
    expect(p.rows[0]).toEqual({ client: false, server: true });
    expect(
      (
        await db.query<{ public: boolean }>(
          "select public from storage.buckets where id='videos'",
        )
      ).rows[0].public,
    ).toBe(false);
    await db.exec("set role authenticated");
    try {
      await expect(db.exec("select * from video_jobs")).rejects.toThrow(
        "permission denied",
      );
      await expect(
        db.exec("update video_prices set credits=1"),
      ).rejects.toThrow("permission denied");
    } finally {
      await db.exec("reset role");
    }
  });
});
