"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Mail, X, LoaderCircle } from "lucide-react";
import {
  readApi,
  notifySessionChanged,
  SESSION_EVENT,
} from "@/lib/session-client";
import { AUTH_MESSAGES, readAuthReturn } from "@/lib/auth-return";

export type AccountSession = {
  configured: boolean;
  authConfigured?: boolean;
  user: { email: string; displayName?: string } | null;
  creditMode?: "credits" | "legacy";
  credits?: number;
  remaining: number;
  billingHold?: boolean;
  billingReady?: boolean;
};
type AccountContext = {
  session: AccountSession | null;
  refresh: () => Promise<AccountSession>;
  openAuth: () => void;
  signOut: () => Promise<void>;
};
const Context = createContext<AccountContext | null>(null);
export function useAccount() {
  const context = useContext(Context);
  if (!context) throw new Error("Account provider missing");
  return context;
}

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [wait, setWait] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const sendAt = useRef(0);
  const lock = useRef(false);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const requestVersion = ++version.current;
    const data = (await readApi(
      await fetch("/api/session", { cache: "no-store" }),
    )) as AccountSession;
    if (version.current === requestVersion) {
      setSession(data);
      if (data.user) {
        setOpen(false);
        setSent(false);
        setToken("");
        setError("");
      }
    }
    return data;
  }, []);
  useEffect(() => {
    const returned = readAuthReturn(window.location.href);
    if (returned.handled)
      window.history.replaceState(null, "", returned.cleanUrl);
    if (returned.callback) {
      window.location.replace(returned.callback);
      return;
    }
    // Initial session state comes from an asynchronous HTTP-only cookie check.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh()
      .then((data) => {
        if (returned.outcome) {
          if (data.user) {
            setNotice("You’re signed in. Choose a tool to start creating.");
            notifySessionChanged();
          } else
            setNotice(
              AUTH_MESSAGES[returned.outcome] ||
                "Open the newest sign-in email in this browser.",
            );
        }
      })
      .catch(() => {});
    const sync = () => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    };
    const storage = (event: StorageEvent) => {
      if (event.key === SESSION_EVENT) sync();
    };
    window.addEventListener("focus", sync);
    window.addEventListener(SESSION_EVENT, sync);
    window.addEventListener("storage", storage);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("focus", sync);
      window.removeEventListener(SESSION_EVENT, sync);
      window.removeEventListener("storage", storage);
      document.removeEventListener("visibilitychange", sync);
    };
  }, [refresh]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  const coolingDown = wait > 0;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(
      () =>
        setWait(Math.max(0, Math.ceil((sendAt.current - Date.now()) / 1000))),
      1000,
    );
    return () => clearInterval(timer);
  }, [coolingDown]);
  async function authenticate(action: "send" | "verify") {
    if (lock.current || (action === "send" && Date.now() < sendAt.current))
      return;
    lock.current = true;
    setBusy(true);
    setError("");
    if (action === "send") {
      sendAt.current = Date.now() + 60000;
      setWait(60);
    }
    try {
      await readApi(
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, email, token }),
        }),
      );
      if (action === "send") setSent(true);
      else {
        const data = await refresh();
        if (!data.user)
          throw new Error(
            "The sign-in session could not be saved. Allow cookies and try again.",
          );
        notifySessionChanged();
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Sign-in could not be completed.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  async function signOut() {
    await readApi(
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signout" }),
      }),
    );
    await refresh();
    notifySessionChanged();
  }
  return (
    <Context.Provider
      value={{
        session,
        refresh,
        openAuth: () => {
          setError("");
          setOpen(true);
        },
        signOut,
      }}
    >
      {notice && (
        <div className="account-notice" role="status">
          {notice}
          <button
            aria-label="Dismiss account message"
            onClick={() => setNotice("")}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {children}
      <dialog
        ref={dialog}
        className="auth-dialog account-auth-dialog"
        onCancel={() => setOpen(false)}
        aria-labelledby="account-auth-title"
      >
        <button
          className="dialog-close"
          aria-label="Close account sign-in"
          onClick={() => setOpen(false)}
        >
          <X size={20} />
        </button>
        <div className="auth-icon">
          <Mail size={24} />
        </div>
        <div className="auth-tabs" aria-label="Account access">
          <button
            aria-pressed={mode === "login"}
            onClick={() => setMode("login")}
          >
            Log in
          </button>
          <button
            aria-pressed={mode === "signup"}
            onClick={() => setMode("signup")}
          >
            Sign up
          </button>
        </div>
        <h2 id="account-auth-title">
          {mode === "login" ? "Welcome back." : "Make room for your next idea."}
        </h2>
        <p>
          {mode === "login"
            ? "Use your email to sign in. No password to remember."
            : "Create your account with a verified email. No card is needed to sign up."}
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void authenticate(sent ? "verify" : "send");
          }}
        >
          <label htmlFor="account-email">Account email</label>
          <input
            id="account-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            readOnly={sent}
          />
          {sent && (
            <>
              <p className="email-instructions">
                Open the sign-in link in this browser, or enter the code if your
                email includes one. Check your spam folder too.
              </p>
              <label htmlFor="account-code">Email verification code</label>
              <input
                id="account-code"
                value={token}
                onChange={(event) =>
                  setToken(event.target.value.replace(/\D/g, "").slice(0, 8))
                }
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6,8}"
                required
              />
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button className="primary" disabled={busy || (!sent && wait > 0)}>
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : sent ? (
              "Verify and continue"
            ) : (
              "Send sign-in link"
            )}
          </button>
        </form>
        {sent && (
          <button
            className="secondary"
            disabled={busy}
            onClick={async () => {
              try {
                const data = await refresh();
                if (!data.user)
                  setError(
                    "No sign-in found yet. Open the newest email link in this browser.",
                  );
                else notifySessionChanged();
              } catch {
                setError("Could not check your sign-in. Please try again.");
              }
            }}
          >
            I opened my sign-in link
          </button>
        )}
        {wait > 0 && (
          <p className="resend-note" role="status">
            Wait {wait}s before requesting another email.
          </p>
        )}
        {sent && (
          <button
            className="text-button"
            disabled={busy || wait > 0}
            onClick={() => {
              setSent(false);
              setToken("");
            }}
          >
            Change email or send another link
          </button>
        )}
      </dialog>
    </Context.Provider>
  );
}
