"use client";
/* User photos use native img elements: private same-origin endpoints and local object URLs must bypass the shared image optimizer. */
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Mail,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  PRESETS,
  MAX_FILE_BYTES,
  type Preset,
  type Quality,
} from "@/lib/presets";
import { downloadComparison, downloadFile } from "@/lib/download";
type Session = {
  configured: boolean;
  user: { email: string } | null;
  remaining: number;
};
type Result = {
  id: string;
  status:
    | "reserved"
    | "processing"
    | "succeeded"
    | "failed"
    | "uncertain"
    | "expired";
  preset: Preset;
  expiresAt?: string;
  errorCode?: string;
};
async function readJson(response: Response) {
  const body = await response.json().catch(() => ({
    error:
      "The connection was interrupted. Check the existing request before trying again.",
  }));
  if (!response.ok)
    throw new Error(body.error || "The request could not be completed.");
  return body;
}
export default function Studio() {
  const [preset, setPreset] = useState<Preset>("studio");
  const [quality, setQuality] = useState<Quality>("medium");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [consent, setConsent] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [compare, setCompare] = useState<"side" | "slider">("side");
  const [slider, setSlider] = useState(50);
  const input = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const submitLock = useRef(false);
  const validationId = useRef(0);
  const activeStyle = PRESETS.find((p) => p.id === preset)!;
  const jobStyle = PRESETS.find((p) => p.id === result?.preset) || activeStyle;
  const refreshSession = useCallback(async () => {
    const data = await readJson(
      await fetch("/api/session", { cache: "no-store" }),
    );
    setSession(data);
    return data as Session;
  }, []);
  const acceptResult = useCallback((data: Result) => {
    setResult(data);
    setPendingId(data.id);
    localStorage.setItem("editingapp-request", data.id);
  }, []);
  const checkStatus = useCallback(
    async (id: string) => {
      const data = await readJson(
        await fetch(`/api/portraits/${id}`, { cache: "no-store" }),
      );
      acceptResult(data);
      return data as Result;
    },
    [acceptResult],
  );
  useEffect(() => {
    fetch("/api/session", { cache: "no-store" })
      .then(readJson)
      .then((data: Session) => {
        setSession(data);
        const saved = localStorage.getItem("editingapp-request");
        if (saved && /^[0-9a-f-]{36}$/i.test(saved) && data.user) {
          setPendingId(saved);
          checkStatus(saved).catch(() =>
            setError(
              "Your previous request could not be loaded. Use Check request to reconnect.",
            ),
          );
        }
      })
      .catch(() =>
        setError(
          "Could not check your allowance. Refresh the page to reconnect.",
        ),
      );
  }, [refreshSession, checkStatus]);
  useEffect(() => {
    if (authOpen) dialog.current?.showModal();
    else dialog.current?.close();
  }, [authOpen]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  const processing =
    busy || result?.status === "reserved" || result?.status === "processing";
  useEffect(() => {
    if (!pendingId || !processing) return;
    let failures = 0;
    const timer = setInterval(() => {
      checkStatus(pendingId)
        .then((data) => {
          failures = 0;
          if (!["reserved", "processing"].includes(data.status))
            refreshSession().catch(() => {});
        })
        .catch(() => {
          failures++;
          if (failures >= 3)
            setError(
              "The connection is interrupted. Your request is saved; reconnect to check it without starting another generation.",
            );
        });
    }, 4000);
    return () => clearInterval(timer);
  }, [pendingId, processing, checkStatus, refreshSession]);
  async function chooseFile(selected?: File) {
    if (!selected || processing || pendingId) return;
    const attempt = ++validationId.current;
    setError("");
    setValidating(true);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(selected.type) ||
        selected.size > MAX_FILE_BYTES ||
        !selected.size
      )
        throw new Error("Choose a JPG, PNG or WebP photo under 4 MB.");
      const bitmap = await createImageBitmap(selected);
      const valid =
        Math.min(bitmap.width, bitmap.height) >= 256 &&
        bitmap.width * bitmap.height <= 16_000_000;
      bitmap.close();
      if (!valid)
        throw new Error(
          "Choose a photo at least 256 × 256 pixels and no larger than 16 megapixels.",
        );
      if (attempt !== validationId.current) return;
      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setConsent(false);
    } catch (cause) {
      if (attempt === validationId.current) {
        setFile(null);
        setPreview("");
        setError(
          cause instanceof Error
            ? cause.message
            : "This image could not be opened.",
        );
      }
    } finally {
      if (attempt === validationId.current) setValidating(false);
      if (input.current) input.current.value = "";
    }
  }
  async function authenticate(action: "send" | "verify") {
    setAuthError("");
    setAuthBusy(true);
    try {
      await readJson(
        await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, email, token }),
        }),
      );
      if (action === "send") setSent(true);
      else {
        await refreshSession();
        setAuthOpen(false);
        setToken("");
      }
    } catch (cause) {
      setAuthError((cause as Error).message);
    } finally {
      setAuthBusy(false);
    }
  }
  async function generate(retry = false) {
    if (submitLock.current || processing) return;
    setError("");
    if (!file || !consent) {
      setError("Choose your selfie and confirm photo permission first.");
      return;
    }
    if (!session?.configured) {
      setError(
        "Portrait generation is not connected yet. Your selfie stays in your browser until you generate.",
      );
      return;
    }
    if (!session.user) {
      setAuthOpen(true);
      return;
    }
    if (pendingId && !retry) {
      setError(
        "Review the existing request, then choose Start another portrait.",
      );
      return;
    }
    submitLock.current = true;
    setBusy(true);
    const id = pendingId || crypto.randomUUID();
    setPendingId(id);
    localStorage.setItem("editingapp-request", id);
    const form = new FormData();
    form.set("photo", file);
    form.set("preset", preset);
    form.set("quality", quality);
    form.set("requestId", id);
    form.set("consent", "true");
    try {
      const response = await fetch("/api/portraits", {
        method: "POST",
        body: form,
        signal: AbortSignal.timeout(245_000),
      });
      if (!response.ok && response.status < 500) {
        const data = await response.json();
        if (!retry) {
          setPendingId(null);
          localStorage.removeItem("editingapp-request");
        }
        throw new Error(data.error || "Generation could not start.");
      }
      acceptResult(await readJson(response));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      submitLock.current = false;
      setBusy(false);
      refreshSession().catch(() => {});
    }
  }
  async function reconnect() {
    if (!pendingId) return;
    setError("");
    try {
      await checkStatus(pendingId);
      await refreshSession();
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function resetRequest() {
    setResult(null);
    setPendingId(null);
    setError("");
    localStorage.removeItem("editingapp-request");
  }
  async function removePhotos() {
    if (!pendingId) return;
    setError("");
    try {
      await readJson(
        await fetch(`/api/portraits/${pendingId}`, { method: "DELETE" }),
      );
      resetRequest();
      setFile(null);
      setPreview("");
      setConsent(false);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  async function download(kind: "portrait" | "comparison") {
    if (!result) return;
    setError("");
    setDownloading(true);
    try {
      const base = `/api/portraits/${result.id}/image`;
      if (kind === "portrait")
        await downloadFile(
          `${base}?download=1`,
          "editingapp-retro-portrait.png",
        );
      else
        await downloadComparison(`${base}?kind=original`, base, jobStyle.name);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setDownloading(false);
    }
  }
  const original = result
    ? `/api/portraits/${result.id}/image?kind=original`
    : preview;
  return (
    <section className="studio" id="studio" aria-labelledby="studio-title">
      <div className="studio-toolbar">
        <div className="section-kicker">
          <span className="tiny-star">✳</span> YOUR RETRO PHOTO STUDIO
        </div>
        <span className="allowance">
          <Sparkles size={15} />
          {session?.user
            ? `${session.remaining} of 3 portraits left today`
            : "3 portraits daily · no payment required"}
        </span>
      </div>
      <div className="studio-grid">
        <div className="controls">
          <div className="step-heading">
            <span>01</span>
            <h2 id="studio-title">Choose your era energy.</h2>
          </div>
          <fieldset
            className="preset-list"
            disabled={Boolean(processing || pendingId)}
          >
            <legend className="sr-only">Portrait style</legend>
            {PRESETS.map((p) => (
              <label
                key={p.id}
                className={`preset ${preset === p.id ? "selected" : ""}`}
              >
                <input
                  type="radio"
                  name="preset"
                  value={p.id}
                  checked={preset === p.id}
                  onChange={() => setPreset(p.id)}
                />
                <Image
                  src={p.image}
                  alt=""
                  width={62}
                  height={76}
                  sizes="62px"
                />
                <span>
                  <strong>{p.name}</strong>
                  <small>{p.description}</small>
                </span>
                <span className="radio-mark" aria-hidden="true">
                  {preset === p.id && <Check size={13} />}
                </span>
              </label>
            ))}
          </fieldset>
          <div className="step-heading upload-heading">
            <span>02</span>
            <h2>Add your selfie.</h2>
          </div>
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            id="selfie-upload"
            aria-label="Upload your selfie"
            disabled={Boolean(processing || pendingId)}
            onChange={(e) => chooseFile(e.target.files?.[0])}
          />
          <button
            className={`upload-zone ${preview ? "has-photo" : ""}`}
            type="button"
            disabled={Boolean(processing || validating || pendingId)}
            onClick={() => input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!processing) chooseFile(e.dataTransfer.files[0]);
            }}
          >
            {preview ? (
              <img src={preview} alt="Your selected selfie" />
            ) : (
              <span className="upload-icon">
                <ImagePlus size={23} />
              </span>
            )}
            <span>
              <strong>
                {validating
                  ? "Checking your photo…"
                  : preview
                    ? "Selfie ready. Change photo?"
                    : "Drop your selfie here"}
              </strong>
              <small>
                {preview
                  ? file?.name
                  : "or click to browse · JPG, PNG, WebP · max 4 MB"}
              </small>
            </span>
            {preview && <Check size={18} />}
          </button>
          <p className="upload-tip">
            One face, good light, no sunglasses. A clear selfie makes the best
            starting point.
          </p>
          <label className="consent">
            <input
              type="checkbox"
              checked={consent}
              disabled={Boolean(processing || pendingId)}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I have permission to use this photo and agree to its processing as
              described in the <a href="/privacy">photo privacy notice</a>.
            </span>
          </label>
          <details className="advanced">
            <summary>
              Advanced <ChevronDown size={15} />
            </summary>
            <label htmlFor="quality">Portrait detail</label>
            <select
              id="quality"
              value={quality}
              disabled={Boolean(processing || pendingId)}
              onChange={(e) => setQuality(e.target.value as Quality)}
            >
              <option value="medium">Standard detail</option>
              <option value="high">High detail</option>
            </select>
            <p>
              Both use one portrait allowance. High detail may take longer.
              Output: 1024 × 1536 PNG.
            </p>
          </details>
          {session && !session.configured && (
            <p className="setup-note">
              <LockKeyhole size={15} />
              <span>
                Generation is awaiting setup. Explore the styles and preview
                your selfie here.
              </span>
            </p>
          )}
          <button
            className="primary generate"
            disabled={Boolean(
              processing ||
              validating ||
              !file ||
              !consent ||
              pendingId ||
              (session?.user && session.remaining === 0),
            )}
            onClick={() => generate()}
          >
            {processing ? (
              <>
                <LoaderCircle className="spin" size={18} /> Developing your
                portrait…
              </>
            ) : (
              <>
                <Sparkles size={18} />
                {session?.user
                  ? "Generate my retro portrait"
                  : "Create my retro portrait"}
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="cost-note">
            1 portrait from your daily allowance ·{" "}
            {session?.user
              ? "Resets at 00:00 UTC"
              : "Email verification before generation"}
          </p>
          {session?.user && (
            <div className="account">
              <span>{session.user.email}</span>
              <button
                onClick={async () => {
                  try {
                    await readJson(
                      await fetch("/api/auth", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ action: "signout" }),
                      }),
                    );
                    resetRequest();
                    setFile(null);
                    setPreview("");
                    await refreshSession();
                  } catch (cause) {
                    setError((cause as Error).message);
                  }
                }}
              >
                Sign out
              </button>
            </div>
          )}
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
        </div>
        <div
          className={`result-panel ${result?.status === "succeeded" ? "has-result" : ""}`}
          aria-live="polite"
          aria-busy={Boolean(processing)}
        >
          {result?.status === "succeeded" ? (
            <>
              <div className="result-heading">
                <div>
                  <span className="section-kicker">
                    FRESH FROM THE DARKROOM
                  </span>
                  <h3>Your retro moment.</h3>
                </div>
                <Check size={22} />
              </div>
              <div className="view-toggle" aria-label="Comparison view">
                <button
                  aria-pressed={compare === "side"}
                  onClick={() => setCompare("side")}
                >
                  Side by side
                </button>
                <button
                  aria-pressed={compare === "slider"}
                  onClick={() => setCompare("slider")}
                >
                  Compare slider
                </button>
              </div>
              {compare === "side" ? (
                <div className="comparison">
                  <figure>
                    <img src={original} alt="Your original selfie" />
                    <figcaption>Original</figcaption>
                  </figure>
                  <figure>
                    <img
                      src={`/api/portraits/${result.id}/image`}
                      alt={`Your AI portrait in ${jobStyle.name} style`}
                    />
                    <figcaption>AI portrait</figcaption>
                  </figure>
                </div>
              ) : (
                <div className="slider-wrap">
                  <div className="slider-images">
                    <img
                      src={`/api/portraits/${result.id}/image`}
                      alt="Your generated retro portrait"
                    />
                    <img
                      className="slider-original"
                      style={{ clipPath: `inset(0 ${100 - slider}% 0 0)` }}
                      src={original}
                      alt="Your original selfie, adjustable overlay"
                    />
                    <span
                      className="slider-line"
                      style={{ left: `${slider}%` }}
                    />
                  </div>
                  <label htmlFor="compare-slider">Original ↔ AI portrait</label>
                  <input
                    id="compare-slider"
                    type="range"
                    min="0"
                    max="100"
                    value={slider}
                    onChange={(e) => setSlider(Number(e.target.value))}
                  />
                </div>
              )}
              <p className="review-note">
                Take a closer look at your facial features. AI can change
                details; download when you’re happy with the result.
              </p>
              <div className="download-actions">
                <button
                  className="primary"
                  disabled={downloading}
                  onClick={() => download("portrait")}
                >
                  <Download size={17} />
                  Download portrait
                </button>
                <button
                  className="secondary"
                  disabled={downloading}
                  onClick={() => download("comparison")}
                >
                  <Download size={17} />
                  Before & after
                </button>
              </div>
              <p className="expiry-note">
                Available for 24 hours from submission. Downloads stay on your
                device.
              </p>
              <div className="result-actions">
                <button onClick={resetRequest}>
                  <RefreshCw size={14} />
                  Start another portrait
                </button>
                <button onClick={removePhotos}>
                  <Trash2 size={14} />
                  Delete photos now
                </button>
              </div>
            </>
          ) : processing ? (
            <div className="processing-state">
              <div className="developing-image">
                <Image src={activeStyle.image} alt="" fill sizes="240px" />
                <div />
              </div>
              <LoaderCircle size={28} className="spin" />
              <h3>A little time travel.</h3>
              <p>
                Your photo is being developed. This can take a few minutes. You
                can reconnect to this request if the page closes.
              </p>
              <span className="small-label">
                ONE REQUEST · NO AUTOMATIC RE-GENERATION
              </span>
            </div>
          ) : pendingId ? (
            <div className="pending-state">
              <span className="upload-icon">
                <RefreshCw size={25} />
              </span>
              <h3>
                {result?.status === "failed"
                  ? "This portrait didn’t develop."
                  : result?.status === "expired"
                    ? "These photos have expired."
                    : "Let’s check your portrait."}
              </h3>
              <p>
                {result?.status === "failed"
                  ? "The generation could not be completed. Your portrait allowance has been restored. Try a clear, well-lit selfie."
                  : result?.status === "expired"
                    ? "The private photo window has ended. Choose a selfie to start a new portrait."
                    : "We haven’t confirmed a finished result. Checking this request won’t start another generation. An uncertain request keeps its allowance reserved."}
              </p>
              <button className="secondary" onClick={reconnect}>
                Check request
              </button>
              {!result && file && (
                <button className="text-button" onClick={() => generate(true)}>
                  Reconnect using the same request ID
                </button>
              )}
              {result && ["failed", "expired"].includes(result.status) && (
                <button className="text-button" onClick={resetRequest}>
                  Start another portrait
                </button>
              )}
              {result?.status === "uncertain" && (
                <button className="text-button" onClick={removePhotos}>
                  Delete photos and close request
                </button>
              )}
              <small className="request-id">Request: {pendingId}</small>
            </div>
          ) : (
            <>
              <div className="preview-topline">
                <span>THE LOOK</span>
                <span>VOL. 01 / 1980—1989</span>
              </div>
              <div className="photo-print">
                <div className="print-image">
                  <Image
                    key={preset}
                    src={activeStyle.image}
                    alt={`AI-created style demonstration: ${activeStyle.name}, a fictional woman in retro styling`}
                    fill
                    sizes="(max-width: 700px) 80vw, 400px"
                    priority
                  />
                </div>
                <div className="print-caption">
                  <span>{activeStyle.name}</span>
                  <Sparkles size={18} />
                </div>
              </div>
              <div className="preview-bottom">
                <span className="demo-label">AI-CREATED DEMONSTRATION</span>
                <p>
                  A different decade.
                  <br />
                  <em>Still unmistakably you.</em>
                </p>
                <span className="demo-disclosure">
                  Fictional model · style inspiration, not a tested product
                  result
                </span>
              </div>
              {preview && (
                <div className="selfie-peek">
                  <img src={preview} alt="Your uploaded selfie preview" />
                  <span>Your starting point</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="studio-footnote">
        <LockKeyhole size={14} />
        <span>
          Private photos. No public gallery. Review your result before you
          download.
        </span>
      </div>
      <dialog
        ref={dialog}
        className="auth-dialog"
        onCancel={() => setAuthOpen(false)}
        onClose={() => setAuthOpen(false)}
        aria-labelledby="auth-title"
      >
        <button
          className="dialog-close"
          aria-label="Close email verification"
          onClick={() => setAuthOpen(false)}
        >
          <X size={20} />
        </button>
        <span className="upload-icon">
          <Mail size={24} />
        </span>
        <h2 id="auth-title">Your ticket to the 80s.</h2>
        <p>
          Verify your email for 3 portraits a day. No password or payment
          needed.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            authenticate(sent ? "verify" : "send");
          }}
        >
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            readOnly={sent}
            onChange={(e) => setEmail(e.target.value)}
          />
          {sent && (
            <>
              <label htmlFor="token">Code from your email</label>
              <input
                id="token"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="[0-9]{6,8}"
                maxLength={8}
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <p className="small-label">Check your inbox and spam folder.</p>
            </>
          )}
          {authError && (
            <p className="error" role="alert">
              {authError}
            </p>
          )}
          <button className="primary" disabled={authBusy}>
            {authBusy ? "Please wait…" : sent ? "Verify email" : "Send my code"}
          </button>
          {sent && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setSent(false);
                setToken("");
              }}
            >
              Use another email or request a new code
            </button>
          )}
        </form>
      </dialog>
    </section>
  );
}
