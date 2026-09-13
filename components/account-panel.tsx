"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Coins, UserRound, RefreshCw, ArrowUpRight } from "lucide-react";
import { useAccount } from "./account-provider";
import { readApi, notifySessionChanged } from "@/lib/session-client";
import { findPlan } from "@/lib/plans";
type Account = {
  email: string;
  profile: { displayName: string; bio: string };
  credits: number;
  billingHold: boolean;
  hasCustomer: boolean;
  grants: { remaining: number; expires_at: string; source: string }[];
  subscription: {
    plan_id: string;
    interval: string;
    status: string;
    period_end: string;
    cancel_at_period_end: boolean;
  } | null;
  activity: { delta: number; kind: string; created_at: string }[];
};
const date = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(value));
export function AccountPanel() {
  const { session, openAuth, refresh } = useAccount();
  const [account, setAccount] = useState<Account | null>(null);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const load = useCallback(async (fillProfile = false) => {
    const data = (await readApi(
      await fetch("/api/account", { cache: "no-store" }),
    )) as Account;
    setAccount(data);
    if (fillProfile) {
      setName(data.profile.displayName);
      setBio(data.profile.bio);
    }
    return data;
  }, []);
  const email = session?.user?.email;
  const creditMode = session?.creditMode;
  useEffect(() => {
    if (!email || creditMode !== "credits") return;
    let alive = true;
    // Fetch the initial private profile; state changes only after the network completes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(true).catch((failure) => {
      if (alive) setError(failure.message);
    });
    const returning =
      new URLSearchParams(window.location.search).get("checkout") ===
      "complete";
    if (!returning)
      return () => {
        alive = false;
      };
    Promise.resolve().then(() => {
      if (alive) setAwaitingPayment(true);
    });
    let checks = 0;
    const timer = setInterval(() => {
      checks++;
      load()
        .then((data) => {
          if (alive && data.subscription?.status === "active") {
            setAwaitingPayment(false);
            notifySessionChanged();
            clearInterval(timer);
          }
        })
        .catch(() => {});
      if (checks >= 10) clearInterval(timer);
    }, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [email, creditMode, load]);
  if (!session) return <p role="status">Loading your account…</p>;
  if (!session.user)
    return (
      <section className="account-signin">
        <UserRound size={32} />
        <h2>Your own corner of the studio.</h2>
        <p>
          Sign in or create an account to manage your profile, credits and
          subscription.
        </p>
        <button className="primary" onClick={openAuth}>
          Log in or sign up
        </button>
      </section>
    );
  if (session.creditMode !== "credits")
    return (
      <section className="account-signin">
        <h2>You’re signed in.</h2>
        <p>{session.user.email}</p>
        <p>
          Profiles and credit plans are coming soon. Your existing retro
          portrait allowance is still available.
        </p>
        <Link className="primary" href="/tools/ai-retro-portraits">
          Open the retro studio
        </Link>
      </section>
    );
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await readApi(
        await fetch("/api/account", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name, bio }),
        }),
      );
      await load();
      await refresh();
      notifySessionChanged();
      setNotice("Your profile is saved.");
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not save your profile.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function portal() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await readApi(
        await fetch("/api/billing/portal", { method: "POST" }),
      );
      const url = new URL(data.url);
      if (url.protocol !== "https:" || url.hostname !== "billing.stripe.com")
        throw new Error("The billing link could not be verified.");
      window.location.assign(url.href);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : "Could not open billing.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {awaitingPayment && (
        <p className="account-payment-note" role="status">
          Checking payment confirmation. Credits appear after Stripe confirms
          payment; returning from checkout alone does not add them. Use Refresh
          balance if confirmation takes longer.
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="success-note">
          {notice}
        </p>
      )}
      {!account || account.email !== session.user.email ? (
        <p role="status">Loading profile and credits…</p>
      ) : (
        <>
          {account.billingHold && (
            <p className="error" role="alert">
              Generation is paused while a refund or payment dispute is
              reviewed. Your account and billing history remain available.
            </p>
          )}
          <div className="account-grid">
            <section className="profile-card">
              <h2>Your profile</h2>
              <form onSubmit={save}>
                <label htmlFor="profile-name">Display name</label>
                <input
                  id="profile-name"
                  value={name}
                  maxLength={80}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                />
                <label htmlFor="profile-email">Verified email</label>
                <input id="profile-email" value={account.email} readOnly />
                <label htmlFor="profile-bio">A little about you</label>
                <textarea
                  id="profile-bio"
                  value={bio}
                  maxLength={240}
                  rows={3}
                  onChange={(event) => setBio(event.target.value)}
                />
                <p className="field-note">
                  Your profile is private to your account. {bio.length}/240
                  characters.
                </p>
                <button className="primary" disabled={busy}>
                  {busy ? "Saving…" : "Save profile"}
                </button>
              </form>
            </section>
            <section className="balance-card">
              <p className="eyebrow">
                <Coins size={17} /> YOUR CREATIVE BALANCE
              </p>
              <h2>
                {account.credits.toLocaleString("en-US")} <span>credits</span>
              </h2>
              <p>Standard image: 3 credits · High detail: 8 credits</p>
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  try {
                    await load();
                    await refresh();
                    notifySessionChanged();
                  } catch {
                    setError("Could not refresh your balance.");
                  }
                }}
              >
                <RefreshCw size={15} /> Refresh balance
              </button>
              <div className="subscription-detail">
                <h3>
                  {account.subscription
                    ? `${findPlan(account.subscription.plan_id)?.name || "Your"} plan`
                    : "Welcome to EditingApp"}
                </h3>
                <p>
                  {account.subscription
                    ? `${account.subscription.interval === "year" ? "Yearly" : "Monthly"} · ${account.subscription.status.replaceAll("_", " ")}`
                    : "Your one-time welcome credits can be used across available tools."}
                </p>
                {account.subscription && (
                  <p>
                    {account.subscription.cancel_at_period_end ||
                    account.subscription.status === "canceled"
                      ? "Paid period ends"
                      : "Current period ends"}{" "}
                    {date(account.subscription.period_end)} (UTC).
                  </p>
                )}
                {account.hasCustomer ? (
                  <button
                    className="secondary"
                    onClick={() => void portal()}
                    disabled={busy}
                  >
                    Manage subscription <ArrowUpRight size={17} />
                  </button>
                ) : (
                  <Link className="secondary" href="/pricing">
                    View credit plans <ArrowUpRight size={17} />
                  </Link>
                )}
              </div>
            </section>
          </div>
          <section className="account-history">
            <h2>Credit expiry</h2>
            {account.grants.length ? (
              <ul className="grant-list">
                {account.grants.map((grant, index) => (
                  <li key={index}>
                    <span>
                      {grant.source === "welcome"
                        ? "Welcome credits"
                        : "Plan credits"}
                    </span>
                    <strong>{grant.remaining} remaining</strong>
                    <span>Expires {date(grant.expires_at)} (UTC)</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No unexpired credits. Choose a plan to create more images.</p>
            )}
            <p className="field-note">
              Credits with the earliest expiry are used first. Paid credits do
              not roll over. Annual credits are issued together and expire at
              the annual period end.
            </p>
          </section>
          <section className="account-history">
            <h2>Recent credit activity</h2>
            {account.activity.length ? (
              <div className="account-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Activity</th>
                      <th scope="col">Credits</th>
                      <th scope="col">Date (UTC)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {account.activity.map((entry, index) => (
                      <tr key={index}>
                        <th scope="row">
                          {(
                            {
                              generation: "Image generation",
                              refund: "Failed request refund",
                              subscription: "Paid plan credits",
                              welcome: "Welcome credits",
                              adjustment: "Account adjustment",
                            } as Record<string, string>
                          )[entry.kind] || entry.kind}
                        </th>
                        <td>
                          {entry.delta > 0 ? "+" : ""}
                          {entry.delta}
                        </td>
                        <td>{date(entry.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>Your credit activity will appear here.</p>
            )}
          </section>
        </>
      )}
    </>
  );
}
