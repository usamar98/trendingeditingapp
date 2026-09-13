"use client";
import Link from "next/link";
import { useState } from "react";
import { Check, ArrowUpRight, LoaderCircle } from "lucide-react";
import {
  PLANS,
  IMAGE_CREDITS,
  dollars,
  planAmount,
  planCredits,
  type PlanId,
  type BillingInterval,
} from "@/lib/plans";
import { useAccount } from "./account-provider";
import { readApi } from "@/lib/session-client";
import { VIDEO_CREDITS } from "@/lib/video";
export function PricingCards({ ready }: { ready: boolean }) {
  const [interval, setInterval] = useState<BillingInterval>("month");
  const [busy, setBusy] = useState<PlanId | null>(null);
  const [error, setError] = useState("");
  const { session, refresh, openAuth } = useAccount();
  const available = session?.billingReady ?? ready;
  async function choose(plan: PlanId) {
    if (busy) return;
    setError("");
    setBusy(plan);
    try {
      const current = await refresh();
      if (!current.user) {
        openAuth();
        return;
      }
      const result = await readApi(
        await fetch("/api/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, interval }),
        }),
      );
      const url = new URL(result.url);
      if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
        throw new Error("The checkout link could not be verified.");
      window.location.assign(url.href);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Checkout could not be opened.",
      );
    } finally {
      setBusy(null);
    }
  }
  return (
    <>
      <div
        className="billing-toggle"
        role="group"
        aria-label="Billing interval"
      >
        <button
          aria-pressed={interval === "month"}
          onClick={() => setInterval("month")}
          disabled={Boolean(busy)}
        >
          Monthly
        </button>
        <button
          aria-pressed={interval === "year"}
          onClick={() => setInterval("year")}
          disabled={Boolean(busy)}
        >
          Yearly <span>2 months free</span>
        </button>
      </div>
      {!available && (
        <p className="billing-coming-soon" role="status">
          Paid plans are coming soon. You can still explore the tools and use
          the retro studio.
        </p>
      )}
      {error && (
        <p className="error pricing-error" role="alert">
          {error} <Link href="/account">Open your account</Link>.
        </p>
      )}
      <div className="pricing-grid">
        {PLANS.map((plan) => {
          const credits = planCredits(plan.id, interval);
          return (
            <article
              key={plan.id}
              className={`price-card ${plan.id === "creator" ? "price-featured" : ""}`}
            >
              <div className="price-card-top">
                <h3>{plan.name}</h3>
                {plan.id === "creator" && <span>MORE ROOM TO CREATE</span>}
              </div>
              <p>{plan.description}</p>
              <div className="plan-price">
                {dollars(planAmount(plan.id, interval))}
                <span>/{interval === "year" ? "year" : "month"}</span>
              </div>
              <p className="plan-credits">
                {credits.toLocaleString("en-US")} credits{" "}
                <span>per {interval === "year" ? "year" : "month"}</span>
              </p>
              <p className="plan-billing-detail">
                {interval === "year"
                  ? `${dollars(plan.yearlyCents)} billed once a year. All ${credits.toLocaleString("en-US")} credits issued after payment.`
                  : `${dollars(plan.monthlyCents)} billed monthly. Credits refresh after each paid renewal.`}
              </p>
              <ul>
                <li>
                  <Check size={16} /> All available photo & video tools
                </li>
                <li>
                  <Check size={16} /> Or up to{" "}
                  {Math.floor(credits / VIDEO_CREDITS.animation).toLocaleString(
                    "en-US",
                  )}{" "}
                  five-second videos per {interval}
                </li>
                <li>
                  <Check size={16} /> Up to{" "}
                  {Math.floor(credits / IMAGE_CREDITS.medium).toLocaleString(
                    "en-US",
                  )}{" "}
                  standard images per {interval}
                </li>
                <li>
                  <Check size={16} /> High detail available for{" "}
                  {IMAGE_CREDITS.high} credits
                </li>
                <li>
                  <Check size={16} /> Private PNG & MP4 downloads
                </li>
                <li>
                  <Check size={16} /> Manage renewal in your account
                </li>
              </ul>
              <button
                className={plan.id === "creator" ? "primary" : "secondary"}
                onClick={() => void choose(plan.id)}
                disabled={!available || Boolean(busy)}
              >
                {busy === plan.id ? (
                  <>
                    <LoaderCircle className="spin" size={17} /> Opening
                    checkout…
                  </>
                ) : (
                  <>
                    Choose {plan.name}
                    <ArrowUpRight size={17} />
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
      <p className="pricing-footnote">
        USD. Standard images use 3 credits; high-detail images use 8.
        Five-second videos use 60 credits; Copy a Motion uses 90. Image and
        video examples are alternative uses of the same balance, not separate
        allowances. Credits expire at the end of the paid period and do not roll
        over. Yearly plans issue a full year’s credits upfront. Plans renew
        automatically until canceled. Confirmed failed requests restore credits
        to their original expiry; uncertain requests keep them reserved.{" "}
        <Link href="/terms">Read the terms</Link>.
      </p>
    </>
  );
}
