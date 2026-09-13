"use client";
import Link from "next/link";
import { Coins, ChevronDown, UserRound } from "lucide-react";
import { useState } from "react";
import { useAccount } from "./account-provider";
export function AccountMenu() {
  const { session, openAuth, signOut } = useAccount();
  const [error, setError] = useState("");
  if (!session?.user)
    return (
      <button className="header-account-button" onClick={openAuth}>
        <UserRound size={17} /> Log in{" "}
        <span className="signup-label">/ Sign up</span>
      </button>
    );
  const label = session.user.displayName || session.user.email.split("@")[0];
  return (
    <details className="account-menu">
      <summary aria-label="Your account">
        <span className="avatar-initial">
          {label.slice(0, 1).toUpperCase()}
        </span>
        <span className="credit-chip">
          <Coins size={15} />
          {session.creditMode === "credits"
            ? `${session.credits || 0} credits`
            : `${session.remaining} portraits`}
        </span>
        <ChevronDown size={15} />
      </summary>
      <div className="account-dropdown">
        <p>
          <strong>{label}</strong>
          <span>{session.user.email}</span>
        </p>
        <Link href="/account">Profile & credits</Link>
        <Link href="/pricing">Plans & pricing</Link>
        <button
          onClick={async () => {
            try {
              await signOut();
            } catch {
              setError("Could not sign out. Please try again.");
            }
          }}
        >
          Sign out
        </button>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
      </div>
    </details>
  );
}
