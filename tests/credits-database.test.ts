import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(
    `create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql as $$select nullif(current_setting('test.user',true),'')::uuid$$; grant usage on schema auth to authenticated; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid,bucket_id text); alter table storage.objects enable row level security;`,
  );
  for (const file of [
    "202609120001_portraits.sql",
    "202609120002_fal_provider.sql",
    "202609130001_credits_billing_figures.sql",
  ])
    await db.exec(fs.readFileSync(`supabase/migrations/${file}`, "utf8"));
});
afterAll(() => db.close());
async function user() {
  const id = randomUUID();
  await db.query("insert into auth.users values($1)", [id]);
  await db.query("select ensure_account($1)", [id]);
  return id;
}
async function balance(uid: string) {
  return (
    await db.query<{ balance: number }>(
      "select coalesce(sum(remaining),0)::int as balance from credit_grants where user_id=$1 and expires_at>now() and not revoked",
      [uid],
    )
  ).rows[0].balance;
}
async function reserve(
  uid: string,
  id: string = randomUUID(),
  quality = "medium",
  fingerprint: string = id,
) {
  return (
    await db.query<{
      result: {
        fresh: boolean;
        job: { id: string; credits_charged: number; feature_id: string };
      };
    }>(
      "select reserve_image_job($1,$2,$3,'ai-figurine','figurine-desk',$4) as result",
      [id, uid, fingerprint, quality],
    )
  ).rows[0].result;
}
async function settle(uid: string, id: string, uncertain = false) {
  await db.query("select settle_image_failure($1,$2,$3,'FIXTURE')", [
    id,
    uid,
    uncertain,
  ]);
}
async function paid(
  uid: string,
  invoice: string,
  event: string,
  interval = "month",
  credits = 600,
  plan = "starter",
) {
  await db.query(
    "update account_profiles set stripe_customer_id=$2 where user_id=$1",
    [uid, `cus_${uid}`],
  );
  return (
    await db.query<{ applied: boolean }>(
      "select apply_paid_invoice($1,$2,$3,$4,'sub_fixture',$5,$6,$7,now(),now()+interval '1 year') as applied",
      [event, invoice, uid, `cus_${uid}`, plan, interval, credits],
    )
  ).rows[0].applied;
}
describe("shipped credit and billing migration (real PostgreSQL semantics)", () => {
  it("issues welcome credits once even across repeated concurrent account initialization", async () => {
    const uid = await user();
    await Promise.all(
      Array.from({ length: 5 }, () =>
        db.query("select ensure_account($1)", [uid]),
      ),
    );
    expect(await balance(uid)).toBe(9);
    expect(
      (await db.query("select * from credit_ledger where user_id=$1", [uid]))
        .rows,
    ).toHaveLength(1);
    await db.query(
      "update credit_grants set expires_at=now()-interval '1 day' where user_id=$1",
      [uid],
    );
    await db.query("select ensure_account($1)", [uid]);
    expect(await balance(uid)).toBe(0);
  });
  it("deducts once for a duplicate ID and finds the same in-flight photo under a different ID", async () => {
    const uid = await user(),
      id = randomUUID();
    const attempts = await Promise.all([reserve(uid, id), reserve(uid, id)]);
    expect(attempts.filter((entry) => entry.fresh)).toHaveLength(1);
    expect(attempts[0].job).toMatchObject({
      credits_charged: 3,
      feature_id: "ai-figurine",
    });
    expect(await reserve(uid, randomUUID(), "medium", id)).toMatchObject({
      fresh: false,
      job: { id },
    });
    expect(await balance(uid)).toBe(6);
    await expect(reserve(uid, id, "medium", "different-photo")).rejects.toThrow(
      "CONFLICT",
    );
    await expect(reserve(await user(), id)).rejects.toThrow("CONFLICT");
  });
  it("prevents overspending when parallel high-detail jobs compete", async () => {
    const uid = await user();
    const attempts = await Promise.allSettled([
      reserve(uid, randomUUID(), "high"),
      reserve(uid, randomUUID(), "high"),
    ]);
    expect(
      attempts.filter((entry) => entry.status === "fulfilled"),
    ).toHaveLength(1);
    expect(await balance(uid)).toBe(1);
    await db.query(
      "update portrait_jobs set status='succeeded' where user_id=$1",
      [uid],
    );
    await expect(reserve(uid)).rejects.toThrow("CREDITS");
  });
  it("refunds a confirmed failure exactly once and never refunds an uncertain request automatically", async () => {
    const uid = await user(),
      job = await reserve(uid);
    await settle(uid, job.job.id, true);
    expect(await balance(uid)).toBe(6);
    await settle(uid, job.job.id);
    await settle(uid, job.job.id);
    expect(await balance(uid)).toBe(9);
    expect(
      (
        await db.query(
          "select * from credit_ledger where user_id=$1 and kind='refund'",
          [uid],
        )
      ).rows,
    ).toHaveLength(1);
  });
  it("uses the earliest expiry, splits grants, and preserves expiry on refunds", async () => {
    const uid = await user();
    await db.query(
      "update credit_grants set remaining=2,expires_at=now()+interval '1 hour' where user_id=$1",
      [uid],
    );
    await paid(uid, randomUUID(), randomUUID());
    const job = await reserve(uid);
    expect(
      (
        await db.query<{ credits: number }>(
          "select credits from credit_allocations where job_id=$1 order by credits",
          [job.job.id],
        )
      ).rows.map((row) => row.credits),
    ).toEqual([1, 2]);
    await db.query(
      "update credit_grants set expires_at=now()-interval '1 second' where user_id=$1 and source='welcome'",
      [uid],
    );
    await settle(uid, job.job.id);
    expect(await balance(uid)).toBe(600);
    await db.query("update credit_grants set revoked=true where user_id=$1", [
      uid,
    ]);
    expect(await balance(uid)).toBe(0);
  });
  it("does not turn a completed image into a free image", async () => {
    const uid = await user(),
      job = await reserve(uid);
    await db.query("update portrait_jobs set status='succeeded' where id=$1", [
      job.job.id,
    ]);
    await settle(uid, job.job.id);
    expect(await balance(uid)).toBe(6);
  });
  it("grants paid invoices once across duplicate events AND different events for the same invoice", async () => {
    const uid = await user(),
      invoice = randomUUID(),
      event = randomUUID();
    expect(await paid(uid, invoice, event)).toBe(true);
    expect(await paid(uid, invoice, event)).toBe(false);
    expect(await paid(uid, invoice, randomUUID())).toBe(false);
    expect(await balance(uid)).toBe(609);
    expect(
      await paid(uid, randomUUID(), randomUUID(), "year", 48000, "studio"),
    ).toBe(true);
    expect(await balance(uid)).toBe(48609);
  });
  it("rejects invented credit amounts and invoices for another customer", async () => {
    const uid = await user();
    await expect(
      paid(uid, randomUUID(), randomUUID(), "month", 99999),
    ).rejects.toThrow("INVALID_PLAN");
    await expect(
      db.query(
        "select apply_paid_invoice('evt_wrong','in_wrong',$1,'cus_wrong','sub_wrong','starter','month',600,now(),now()+interval '1 month')",
        [uid],
      ),
    ).rejects.toThrow("CUSTOMER_MISMATCH");
    expect(await balance(uid)).toBe(9);
  });
  it("holds generation after refunds/disputes without deleting billing evidence", async () => {
    const uid = await user();
    await paid(uid, randomUUID(), randomUUID());
    await db.query("select hold_billing_account($1,$2,'charge.refunded')", [
      randomUUID(),
      `cus_${uid}`,
    ]);
    await expect(reserve(uid)).rejects.toThrow("BILLING_HOLD");
    expect(await balance(uid)).toBe(609);
    await expect(
      db.query("select reserve_billing_checkout($1,'starter','month')", [uid]),
    ).rejects.toThrow("BILLING_HOLD");
  });
  it("reserves a single checkout attempt and blocks overlapping plans", async () => {
    const uid = await user();
    const query = () =>
      db.query<{ attempt: { attempt_id: string } }>(
        "select reserve_billing_checkout($1,'starter','month') as attempt",
        [uid],
      );
    const [a, b] = await Promise.all([query(), query()]);
    expect(a.rows[0].attempt.attempt_id).toBe(b.rows[0].attempt.attempt_id);
    await expect(
      db.query("select reserve_billing_checkout($1,'studio','year')", [uid]),
    ).rejects.toThrow("CHECKOUT_PENDING");
    await db.query(
      "update billing_checkouts set expires_at=now()-interval '1 second' where user_id=$1",
      [uid],
    );
    expect((await query()).rows[0].attempt.attempt_id).not.toBe(
      a.rows[0].attempt.attempt_id,
    );
  });
  it("does not overwrite newer subscription state with an older event", async () => {
    const uid = await user(),
      sub = randomUUID();
    await db.query(
      "select sync_billing_subscription($1,$2,'starter','month','canceled',now(),true,200)",
      [sub, uid],
    );
    await db.query(
      "select sync_billing_subscription($1,$2,'starter','month','active',now(),false,100)",
      [sub, uid],
    );
    expect(
      (
        await db.query<{ status: string }>(
          "select status from billing_subscriptions where id=$1",
          [sub],
        )
      ).rows[0].status,
    ).toBe("canceled");
    await db.query(
      "select sync_billing_subscription($1,$2,'starter','month','active',now(),false,300)",
      [sub, uid],
    );
    await expect(
      db.query("select reserve_billing_checkout($1,'starter','month')", [uid]),
    ).rejects.toThrow("SUBSCRIBED");
  });
  it("enforces the spending circuit breaker even when users have credits", async () => {
    const uid = await user();
    await db.exec("update generation_limits set daily_budget_cents=1");
    await expect(reserve(uid)).rejects.toThrow("RATE_LIMIT");
    expect(await balance(uid)).toBe(9);
    await db.exec("update generation_limits set daily_budget_cents=2500");
    await db.query(
      "update generation_prices set enabled=false where feature_id='ai-figurine' and quality='medium'",
    );
    await expect(reserve(uid)).rejects.toThrow("FEATURE_DISABLED");
    await db.query("update generation_prices set enabled=true");
  });
  it("isolates account rows and denies browser balance changes and billing RPCs", async () => {
    const uid = await user();
    await user();
    await db.query("select set_config('test.user',$1,false)", [uid]);
    await db.exec("set role authenticated");
    try {
      const rows = await db.query<{ user_id: string }>(
        "select user_id from account_profiles",
      );
      expect(rows.rows).toEqual([{ user_id: uid }]);
      await expect(
        db.exec("update credit_grants set remaining=total"),
      ).rejects.toThrow(/permission denied/);
      await expect(
        db.query("select ensure_account($1)", [uid]),
      ).rejects.toThrow(/permission denied/);
      await expect(db.exec("select * from billing_events")).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await db.exec("reset role");
    }
    const privileges = await db.query<{
      anon: boolean;
      client: boolean;
      server: boolean;
    }>(
      "select has_function_privilege('anon','apply_paid_invoice(text,text,uuid,text,text,text,text,integer,timestamptz,timestamptz)','EXECUTE') as anon,has_function_privilege('authenticated','reserve_image_job(uuid,uuid,text,text,text,text)','EXECUTE') as client,has_function_privilege('service_role','reserve_image_job(uuid,uuid,text,text,text,text)','EXECUTE') as server",
    );
    expect(privileges.rows[0]).toEqual({
      anon: false,
      client: false,
      server: true,
    });
  });
});
