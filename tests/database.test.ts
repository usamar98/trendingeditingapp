import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const db = new PGlite();
const user = randomUUID(),
  other = randomUUID();
beforeAll(async () => {
  // Minimal Supabase schemas; execute the exact shipped migration in PostgreSQL WASM.
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create schema storage;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid,bucket_id text);alter table storage.objects enable row level security;`,
  );
  await db.exec(
    fs.readFileSync("supabase/migrations/202609120001_portraits.sql", "utf8"),
  );
  await db.query("insert into auth.users values ($1),($2)", [user, other]);
  await db.query(
    "insert into portrait_jobs(id,user_id,fingerprint,preset,quality,created_at,status) values ($1,$2,'legacy','studio','medium',now()-interval '2 days','succeeded')",
    [randomUUID(), other],
  );
  await db.exec(
    fs.readFileSync(
      "supabase/migrations/202609120002_fal_provider.sql",
      "utf8",
    ),
  );
});
afterAll(() => db.close());
async function reserve(id: string, uid = user, fingerprint = id) {
  const q = await db.query<{ result: { fresh: boolean; job: { id: string } } }>(
    "select reserve_portrait($1,$2,$3,$4,$5) as result",
    [id, uid, fingerprint, "studio", "medium"],
  );
  return q.rows[0].result;
}
describe("atomic usage and idempotency migration", () => {
  it("preserves legacy provenance while defaulting new reservations to fal", async () => {
    const legacy = await db.query<{ provider: string; provider_model: string }>(
      "select provider,provider_model from portrait_jobs where fingerprint='legacy'",
    );
    expect(legacy.rows[0]).toEqual({
      provider: "openai",
      provider_model: "gpt-image-2.5-sunburst-2026-09-08",
    });
    const id = randomUUID();
    const created = await reserve(id, other);
    expect(created.job).toMatchObject({
      provider: "fal",
      provider_model: "openai/gpt-image-2.5/sunburst/edit",
      feature_id: "retro-portrait",
    });
    await db.query("update portrait_jobs set status='succeeded' where id=$1", [
      id,
    ]);
  });
  it("grants one dispatch across concurrent identical requests and reuses across different IDs", async () => {
    const id = randomUUID();
    const results = await Promise.all([reserve(id), reserve(id)]);
    expect(results.filter((r) => r.fresh)).toHaveLength(1);
    expect((await reserve(randomUUID(), user, id)).job.id).toBe(id);
    await expect(reserve(id, other)).rejects.toThrow("CONFLICT");
    await expect(reserve(id, user, "different")).rejects.toThrow("CONFLICT");
    await expect(reserve(randomUUID())).rejects.toThrow("BUSY");
    await db.query("update portrait_jobs set status='succeeded' where id=$1", [
      id,
    ]);
    expect((await reserve(id)).fresh).toBe(false);
  });
  it("limits each user to 3 reservations, including uncertain requests", async () => {
    const id2 = randomUUID();
    await reserve(id2);
    await db.query("update portrait_jobs set status='uncertain' where id=$1", [
      id2,
    ]);
    const id3 = randomUUID();
    await reserve(id3);
    await db.query("update portrait_jobs set status='succeeded' where id=$1", [
      id3,
    ]);
    await expect(reserve(randomUUID())).rejects.toThrow("LIMIT");
    await db.query(
      "update portrait_jobs set status='failed',consumes_allowance=false where id=$1",
      [id3],
    );
    const id4 = randomUUID();
    expect((await reserve(id4)).fresh).toBe(true);
    await db.query("update portrait_jobs set status='expired' where id=$1", [
      id3,
    ]);
    const count = await db.query<{ count: number }>(
      "select count(*)::int as count from portrait_jobs where user_id=$1 and consumes_allowance",
      [user],
    );
    expect(count.rows[0].count).toBe(3);
  });
  it("denies client mutations and RPC access and keeps the photo bucket private", async () => {
    const privileges = await db.query<{
      insert_ok: boolean;
      rpc_ok: boolean;
      rls: boolean;
    }>(
      "select has_table_privilege('authenticated','portrait_jobs','INSERT') as insert_ok,has_function_privilege('authenticated','reserve_portrait(uuid,uuid,text,text,text)','EXECUTE') as rpc_ok,(select relrowsecurity from pg_class where relname='portrait_jobs') as rls",
    );
    expect(privileges.rows[0]).toEqual({
      insert_ok: false,
      rpc_ok: false,
      rls: true,
    });
    const bucket = await db.query<{ public: boolean }>(
      "select public from storage.buckets where id='portraits'",
    );
    expect(bucket.rows[0].public).toBe(false);
  });
});
