"use client";
/* User photos and authenticated media URLs cannot use Next's public image optimizer. */
/* eslint-disable @next/next/no-img-element */
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Download,
  Film,
  LoaderCircle,
  Play,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useAccount } from "./account-provider";
import { readApi, notifySessionChanged } from "@/lib/session-client";
import {
  VIDEO_PRESETS,
  VIDEO_REFERENCE_MAX_BYTES,
  videoCredits,
  videoPreset,
  videoRecoveryMessage,
  type VideoPreset,
  type VideoJobView,
} from "@/lib/video";

const active = (job: VideoJobView | null) =>
  !!job &&
  ["reserved", "submitting", "queued", "processing", "uncertain"].includes(
    job.status,
  );
export default function VideoStudio() {
  const { session } = useAccount();
  const email = session ? (session.user?.email ?? null) : undefined;
  const [identity, setIdentity] = useState<{
    email: string | null | undefined;
    generation: number;
  }>({ email: undefined, generation: 0 });
  if (email !== undefined && email !== identity.email) {
    // Keep a guest's local upload when they sign in. Leaving a signed-in account
    // remounts the workspace, discarding all its private media and pending reads.
    setIdentity({
      email,
      generation: identity.generation + (identity.email ? 1 : 0),
    });
  }
  return <VideoWorkspace key={identity.generation} />;
}
function VideoWorkspace() {
  const { session, openAuth, refresh } = useAccount();
  const [preset, setPreset] = useState<VideoPreset>("cinematic");
  const [file, setFile] = useState<File | null>(null),
    [preview, setPreview] = useState(""),
    [source, setSource] = useState("");
  const [reference, setReference] = useState<File | null>(null),
    [consent, setConsent] = useState(false);
  const [job, setJob] = useState<VideoJobView | null>(null),
    [history, setHistory] = useState<VideoJobView[]>([]);
  const [available, setAvailable] = useState<boolean | null>(null),
    [busy, setBusy] = useState(false),
    [checking, setChecking] = useState(false),
    [checkError, setCheckError] = useState(""),
    [error, setError] = useState("");
  const [showOriginal, setShowOriginal] = useState(false),
    [illustrate, setIllustrate] = useState(false),
    [deleteConfirm, setDeleteConfirm] = useState(false);
  const lock = useRef(false),
    viewVersion = useRef(0),
    blobUrl = useRef(""),
    owner = useRef<string | undefined>(undefined);
  const statusRequest = useRef<AbortController | null>(null);
  const email = session?.user?.email;
  const accountReady = session !== null;
  const previewPanel = useRef<HTMLDivElement>(null);
  const cost = videoCredits(preset);
  const style = videoPreset(preset)!;
  // Editing a local draft does not mutate or resubmit an existing video job.
  const locked = !session || busy;
  const recovery = active(job) ? videoRecoveryMessage(job!.errorCode) : null;
  const mediaVersion = useRef(0);
  const [mediaKey, setMediaKey] = useState(0);
  const remember = useCallback(
    (id: string) => {
      try {
        if (email) localStorage.setItem(`editingapp-video:${email}`, id);
      } catch {}
    },
    [email],
  );
  const load = useCallback(async () => {
    const version = viewVersion.current;
    const data = await readApi(
      await fetch("/api/videos", { cache: "no-store" }),
    );
    if (version === viewVersion.current) {
      setAvailable(data.available);
      setHistory(data.jobs);
    }
    return data as { available: boolean; jobs: VideoJobView[] };
  }, []);
  const cancelCheck = useCallback(() => {
    statusRequest.current?.abort();
    statusRequest.current = null;
    setChecking(false);
    setCheckError("");
  }, []);
  const check = useCallback(
    async (id: string) => {
      if (statusRequest.current) return;
      const version = viewVersion.current;
      const controller = new AbortController();
      statusRequest.current = controller;
      // Aborting this GET only stops waiting in this tab. The leased server
      // worker may still save the same result; no inference POST is replayed.
      const timeout = setTimeout(() => controller.abort(), 45_000);
      setChecking(true);
      setCheckError("");
      try {
        const next = (await readApi(
          await fetch(`/api/videos/${id}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        )) as VideoJobView;
        if (controller.signal.aborted)
          throw new Error("Status check timed out");
        if (
          !next ||
          next.id !== id ||
          ![
            "reserved",
            "submitting",
            "queued",
            "processing",
            "uncertain",
            "succeeded",
            "failed",
            "expired",
          ].includes(next.status)
        )
          throw new Error(
            "The status response was incomplete. Check this same request again; it has not been submitted again.",
          );
        if (
          version !== viewVersion.current ||
          statusRequest.current !== controller
        )
          return;
        setJob(next);
        setHistory((items) =>
          items.map((item) => (item.id === next.id ? next : item)),
        );
        if (!active(next)) {
          notifySessionChanged();
          void load().catch(() => {});
        }
      } catch (failure) {
        if (
          version === viewVersion.current &&
          statusRequest.current === controller
        )
          setCheckError(
            controller.signal.aborted
              ? "This status check timed out. Your existing request is preserved. Check it again when you’re ready; checking does not charge more credits."
              : failure instanceof Error
                ? failure.message
                : "Could not check this request. Your video has not been submitted again.",
          );
      } finally {
        clearTimeout(timeout);
        if (statusRequest.current === controller) {
          statusRequest.current = null;
          setChecking(false);
        }
      }
    },
    [load],
  );
  useEffect(() => {
    // Resolve the account first: a cookie-authenticated history response can
    // otherwise arrive before the session and be discarded during initialization.
    if (!accountReady) return;
    let live = true;
    const version = ++viewVersion.current;
    if (owner.current !== email) {
      owner.current = email;
      // Account changes clear private results before loading the next account's history.
      Promise.resolve().then(() => {
        if (live) {
          setJob(null);
          setHistory([]);
          setError("");
        }
      });
    }
    // Initialize from asynchronous account-scoped history and local request-ID storage.
    load()
      .then((data) => {
        if (!live || version !== viewVersion.current) return;
        const query = new URLSearchParams(location.search),
          sourceId = query.get("source");
        if (sourceId && /^[0-9a-f-]{36}$/i.test(sourceId) && email) {
          setSource(sourceId);
          setPreview(`/api/portraits/${sourceId}/image`);
          setPreset("memory");
          return;
        }
        let saved = "";
        try {
          saved = email
            ? localStorage.getItem(`editingapp-video:${email}`) || ""
            : "";
        } catch {}
        const last =
          data.jobs.find((j) => j.id === saved) ||
          data.jobs.find((j) => active(j));
        if (last) {
          setJob(last);
          setPreset(last.preset);
          remember(last.id);
        } else if (saved && /^[0-9a-f-]{36}$/i.test(saved)) void check(saved);
      })
      .catch(() => {
        if (live)
          setError(
            "The studio could not connect. Refresh the page to check availability.",
          );
      });
    return () => {
      live = false;
    };
  }, [accountReady, email, load, check, remember]);
  useEffect(
    () => () => {
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      statusRequest.current?.abort();
      statusRequest.current = null;
    },
    [],
  );
  const jobId = job?.id,
    jobStatus = job?.status,
    jobErrorCode = job?.errorCode;
  useEffect(() => {
    if (jobId && window.matchMedia("(max-width: 760px)").matches) {
      previewPanel.current?.scrollIntoView({
        block: "start",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    }
  }, [jobId]);
  useEffect(() => {
    if (
      !jobId ||
      !!checkError ||
      (!!jobErrorCode && jobErrorCode !== "VIDEO_SAVING") ||
      !["reserved", "submitting", "queued", "processing"].includes(
        jobStatus || "",
      )
    )
      return;
    let count = 0,
      waiting = false;
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible" || waiting) return;
      if (++count > 90) {
        clearInterval(timer);
        return;
      }
      waiting = true;
      void check(jobId).finally(() => {
        waiting = false;
      });
    }, 8000);
    return () => clearInterval(timer);
  }, [jobId, jobStatus, jobErrorCode, checkError, check]);
  async function choosePhoto(photo?: File) {
    if (!photo || locked) return;
    setError("");
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(photo.type) ||
      !photo.size ||
      photo.size > 4_000_000
    ) {
      setError("Choose a still JPG, PNG or WebP photo under 4 MB.");
      return;
    }
    const url = URL.createObjectURL(photo);
    try {
      const image = new window.Image();
      image.src = url;
      await image.decode();
      if (
        Math.min(image.naturalWidth, image.naturalHeight) < 300 ||
        image.naturalWidth * image.naturalHeight > 16_000_000 ||
        image.naturalWidth / image.naturalHeight > 2.5 ||
        image.naturalHeight / image.naturalWidth > 2.5
      )
        throw new Error(
          "Use a photo at least 300 pixels per side, no larger than 16 megapixels, in a portrait, square or landscape shape.",
        );
      if (blobUrl.current) URL.revokeObjectURL(blobUrl.current);
      blobUrl.current = url;
      setFile(photo);
      setPreview(url);
      setSource("");
      setConsent(false);
    } catch (failure) {
      URL.revokeObjectURL(url);
      setError(
        failure instanceof Error
          ? failure.message
          : "This photo could not be opened.",
      );
    }
  }
  async function chooseReference(clip?: File) {
    if (!clip || locked) return;
    if (
      clip.type !== "video/mp4" ||
      !clip.size ||
      clip.size > VIDEO_REFERENCE_MAX_BYTES
    ) {
      setError("Choose a 3–5 second MP4 under 3 MB.");
      return;
    }
    setReference(clip);
    setError("");
    setConsent(false);
  }
  async function generate(event: React.FormEvent) {
    event.preventDefault();
    if (lock.current || active(job)) return;
    if (!session?.user) {
      openAuth();
      return;
    }
    if (!available) {
      setError("Video generation is not connected yet.");
      return;
    }
    if ((session.credits || 0) < cost) {
      setError(`You need ${cost} credits for this video.`);
      return;
    }
    if (!file && !source) {
      setError("Choose a photo first.");
      return;
    }
    if (!consent) {
      setError("Confirm your permission before generating.");
      return;
    }
    if (preset === "motion" && !reference) {
      setError("Choose your motion reference clip first.");
      return;
    }
    if (
      (file?.size || 0) + (preset === "motion" ? reference?.size || 0 : 0) >
      4_000_000
    ) {
      setError(
        "Keep the combined photo and motion clip under 4 MB. Export smaller files and try again.",
      );
      return;
    }
    lock.current = true;
    cancelCheck();
    setBusy(true);
    setError("");
    const version = ++viewVersion.current;
    const id = crypto.randomUUID();
    remember(id);
    const pending: VideoJobView = {
      id,
      preset,
      status: "submitting",
      creditsCharged: cost,
      errorCode: null,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    setJob(pending);
    try {
      const form = new FormData();
      form.set("requestId", id);
      form.set("preset", preset);
      form.set("consent", "true");
      if (source) form.set("sourceJobId", source);
      else form.set("photo", file!);
      if (preset === "motion") form.set("reference", reference!);
      const response = await fetch("/api/videos", {
        method: "POST",
        body: form,
      });
      if (!response.ok && response.status < 500) {
        if (version === viewVersion.current) setJob(null);
        remember("");
      }
      const next = (await readApi(response)) as VideoJobView;
      if (version === viewVersion.current) {
        setJob(next);
        remember(next.id);
        void load().catch(() => {});
      }
      notifySessionChanged();
      void refresh().catch(() => {});
    } catch (failure) {
      if (version === viewVersion.current) {
        setJob((current) =>
          current ? { ...current, status: "uncertain" } : null,
        );
        setError(
          failure instanceof Error
            ? failure.message
            : "The connection was interrupted. Check this request before starting another.",
        );
      }
    } finally {
      lock.current = false;
      if (version === viewVersion.current) setBusy(false);
    }
  }
  function startAnother() {
    cancelCheck();
    ++viewVersion.current;
    setJob(null);
    remember("");
    setError("");
    setShowOriginal(false);
    setDeleteConfirm(false);
    setChecking(false);
  }
  async function remove() {
    if (!job || lock.current) return;
    lock.current = true;
    cancelCheck();
    setBusy(true);
    setError("");
    try {
      await readApi(await fetch(`/api/videos/${job.id}`, { method: "DELETE" }));
      setJob({ ...job, status: "expired" });
      remember("");
      setDeleteConfirm(false);
      await load();
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Deletion could not finish. Try again.",
      );
    } finally {
      setBusy(false);
      lock.current = false;
    }
  }
  const selectedJob = job && videoPreset(job.preset);
  const resultUrl = job ? `/api/videos/${job.id}/media?v=${mediaKey}` : "";
  return (
    <section
      className="video-workspace"
      id="video-studio"
      aria-label="Photo to video studio"
    >
      <div className="video-workspace-top">
        <span>
          <Clapperboard size={18} /> YOUR VIDEO STUDIO
        </span>
        <span>
          <ShieldCheck size={15} /> Private by default
        </span>
      </div>
      <div className="video-columns">
        <form className="video-controls" onSubmit={generate}>
          {active(job) && (
            <p className="video-draft-note" role="status">
              You can choose a photo and movement for your next video here.
              Request {job!.id.slice(0, 8)} is still pending; these changes stay
              on your device. Generation stays paused until that request is
              resolved.
            </p>
          )}
          <fieldset disabled={locked}>
            <legend>
              <span>01</span> Choose your movement
            </legend>
            <div className="motion-grid">
              {VIDEO_PRESETS.map((p) => (
                <label
                  className={`motion-choice ${preset === p.id ? "selected" : ""}`}
                  key={p.id}
                >
                  <input
                    type="radio"
                    name="motion"
                    value={p.id}
                    checked={preset === p.id}
                    onChange={() => {
                      setPreset(p.id);
                      setError("");
                    }}
                  />
                  <span className="motion-icon">
                    {p.id === "motion" ? (
                      <Film size={18} />
                    ) : (
                      <Play size={18} />
                    )}
                  </span>
                  <span>
                    <strong>{p.name}</strong>
                    <small>
                      {videoCredits(p.id)} credits ·{" "}
                      {p.id === "motion" ? "3–5 sec" : "5 sec"}
                    </small>
                  </span>
                  {preset === p.id && <Check size={15} />}
                </label>
              ))}
            </div>
            <p className="video-field-note">{style.description}</p>
          </fieldset>
          <fieldset disabled={locked}>
            <legend>
              <span>02</span> Add your starting photo
            </legend>
            <label
              className={`video-upload ${preview ? "has-photo" : ""}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void choosePhoto(e.dataTransfer.files[0]);
              }}
            >
              <input
                aria-label="Upload photo to animate"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  void choosePhoto(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              {preview ? (
                <img
                  src={preview}
                  alt="Your selected starting photo"
                  onError={() =>
                    setError(
                      "This photo could not be opened. Sign in to the original account or upload a saved photo.",
                    )
                  }
                />
              ) : (
                <Upload size={25} />
              )}
              <span>
                <strong>
                  {preview
                    ? source
                      ? "Your portrait is ready"
                      : "Photo ready. Change photo?"
                    : "Choose a photo or drop it here"}
                </strong>
                <small>JPG, PNG or WebP · Under 4 MB</small>
              </span>
            </label>
            <p className="video-field-note">
              A clear face and a steady pose work best. Keep the composition you
              want in your video.
            </p>
            {preset === "motion" && (
              <div className="reference-upload">
                <label htmlFor="motion-reference">
                  Your movement reference
                </label>
                <input
                  id="motion-reference"
                  type="file"
                  accept="video/mp4"
                  onChange={(e) => {
                    void chooseReference(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
                <p className="video-field-note">
                  {reference ? `${reference.name} · ` : ""}Your own 3–5 sec
                  H.264 MP4, under 3 MB. Keep both files under 4 MB combined.
                  Use one visible person; match the photo’s body framing.
                </p>
              </div>
            )}
          </fieldset>
          <details className="video-advanced">
            <summary>Video details &amp; photo tips</summary>
            <p>
              Silent MP4. Cinematic, Memory and Breeze create five seconds; Copy
              a Motion follows your 3–5 second clip. The input controls the
              composition. Subtle motion usually holds facial detail better than
              a large turn.
            </p>
            <p>
              No extra charge for previewing or downloading. Generating a new
              version uses the displayed credits again.
            </p>
          </details>
          <label className="video-consent">
            <input
              type="checkbox"
              checked={consent}
              disabled={locked}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              I have permission from the people pictured and rights to use these
              files. I understand the result is AI-generated.
            </span>
          </label>
          <div className="video-credit-summary">
            <span>
              This generation<strong>{cost} credits</strong>
            </span>
            <span>
              Your balance
              <strong>
                {session?.user
                  ? `${session.credits ?? 0} credits`
                  : "Sign in to check"}
              </strong>
            </span>
          </div>
          {available === false && (
            <p className="video-unavailable" role="status">
              The video studio is not connected yet. Explore the movements and
              preview your photo while we finish setup.
            </p>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="primary video-generate"
            disabled={
              locked ||
              active(job) ||
              available !== true ||
              !!session?.billingHold
            }
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Clapperboard size={18} />
            )}{" "}
            {busy
              ? "Saving your request…"
              : active(job)
                ? "Video request in progress"
                : !session?.user
                  ? "Sign in to create a video"
                  : `Generate video · ${cost} credits`}{" "}
            {!busy && <ArrowRight size={17} />}
          </button>
          {session?.user && (session.credits || 0) < cost && (
            <Link className="video-plan-link" href="/pricing">
              View plans to add credits <ArrowRight size={14} />
            </Link>
          )}
          <p className="video-footnote">
            One generation per click. Confirmed failures restore credits.{" "}
            <Link href="/privacy">How we handle your files</Link>
          </p>
        </form>
        <div className="video-preview-panel" ref={previewPanel}>
          <div className="video-preview-heading">
            <p className="eyebrow">
              {job ? "YOUR PRIVATE SCREENING" : "THE NEXT SCENE IS YOURS"}
            </p>
            <span>PHOTO → VIDEO</span>
          </div>
          {job?.status === "succeeded" ? (
            <>
              <div
                className="video-result-tabs"
                aria-label="Compare original and video"
              >
                <button
                  aria-pressed={!showOriginal}
                  onClick={() => setShowOriginal(false)}
                >
                  Your video
                </button>
                <button
                  aria-pressed={showOriginal}
                  onClick={() => setShowOriginal(true)}
                >
                  Original photo
                </button>
              </div>
              <div className="video-screen">
                {showOriginal ? (
                  <img
                    src={`${resultUrl}&kind=original`}
                    alt="Original photo for comparison"
                  />
                ) : (
                  <video
                    key={mediaKey}
                    src={resultUrl}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label="Your generated video"
                    onError={() =>
                      setError(
                        "The video link may have expired. Use Reload preview to open a fresh private link.",
                      )
                    }
                  />
                )}
              </div>
              <div className="video-result-copy">
                <h3>{selectedJob?.name}. Starring you.</h3>
                <p>
                  Play it through and check the face, hands and movement. Keep
                  the result when it feels right.
                </p>
              </div>
              <a
                className="primary video-download"
                href={`${resultUrl}&download=1`}
              >
                <Download size={18} /> Download MP4
              </a>
              <div className="video-result-actions">
                <button
                  onClick={() => {
                    mediaVersion.current++;
                    setMediaKey(mediaVersion.current);
                    setError("");
                  }}
                >
                  Reload preview
                </button>
                <button onClick={startAnother}>Make another video</button>
                <button onClick={() => setDeleteConfirm(true)}>
                  <Trash2 size={14} /> Delete files
                </button>
              </div>
              <p className="video-footnote">
                Download before {new Date(job.expiresAt).toLocaleString()}. Your
                video is silent; add music in your preferred editor.
              </p>
            </>
          ) : job ? (
            <>
              <div className="video-screen video-waiting">
                <div className="video-wait-icon">
                  {active(job) &&
                  (checking ||
                    (!checkError &&
                      (!recovery || job.errorCode === "VIDEO_SAVING"))) ? (
                    <LoaderCircle size={32} className="spin" />
                  ) : (
                    <Film size={32} />
                  )}
                </div>
                <h3>
                  {(checkError ? "Status check paused." : recovery?.title) ||
                    (
                      {
                        reserved: "Your scene is getting ready.",
                        submitting: "Saving your video request.",
                        queued: "You’re in the queue.",
                        processing: "Your photo is coming to life.",
                        uncertain: "Let’s reconnect to your scene.",
                        failed: "This take couldn’t be completed.",
                        expired: "These files are no longer available.",
                      } as Record<string, string>
                    )[job.status]}
                </h3>
                <p>
                  {recovery?.detail ||
                    (job.status === "failed"
                      ? "The generation failed. Your reserved credits have been restored with their original expiry."
                      : job.status === "expired"
                        ? "The access window ended or you deleted the files. Saved downloads remain on your device."
                        : job.status === "uncertain"
                          ? "The outcome is not confirmed. Your credits stay reserved. Check this same request; we never automatically generate again."
                          : "This can take several minutes. You can leave this page and find the request in Your recent videos when you return.")}
                </p>
                {checkError && <p role="alert">{checkError}</p>}
                {job.errorCode && job.errorCode !== "VIDEO_SAVING" && (
                  <p>
                    Support code: <code>{job.errorCode}</code>
                  </p>
                )}
                {active(job) && (
                  <button
                    className="secondary"
                    disabled={checking || busy}
                    onClick={() => void check(job.id)}
                  >
                    <RefreshCw size={16} className={checking ? "spin" : ""} />
                    {checking ? "Checking…" : "Check video status"}
                  </button>
                )}
              </div>
              <p className="video-footnote">
                Request {job.id.slice(0, 8)} · {job.creditsCharged} credits{" "}
                {job.status === "failed" ? "restored" : "reserved"}
              </p>
              <details className="video-footnote">
                <summary>Request details</summary>
                <p style={{ overflowWrap: "anywhere" }}>
                  Request ID: <code>{job.id}</code>
                  <br />
                  Movement: {videoPreset(job.preset)?.name}
                  <br />
                  Status: {job.status}
                  {job.errorCode && (
                    <>
                      <br />
                      Support code: <code>{job.errorCode}</code>
                    </>
                  )}
                </p>
              </details>
              {!active(job) && (
                <button className="secondary" onClick={startAnother}>
                  Start a new video
                </button>
              )}
              {job.status === "uncertain" && (
                <button
                  className="text-button"
                  onClick={() => setDeleteConfirm(true)}
                >
                  Delete interrupted request files
                </button>
              )}
            </>
          ) : (
            <>
              <div
                className={`video-screen video-concept ${illustrate ? `motion-illustration motion-${preset}` : ""}`}
              >
                <Image
                  src={style.image}
                  fill
                  sizes="(max-width: 760px) 90vw, 520px"
                  alt="Fictional AI portrait used to illustrate a starting frame"
                />
                <div className="video-concept-shade" />
                <span className="video-concept-tag">MOVEMENT ILLUSTRATION</span>
                <button
                  className="video-play"
                  aria-label={
                    illustrate
                      ? "Pause movement illustration"
                      : "Play movement illustration"
                  }
                  onClick={() => setIllustrate(!illustrate)}
                >
                  {illustrate ? <span>Ⅱ</span> : <Play size={26} />}
                </button>
                <div className="video-concept-title">
                  <span>
                    THE{" "}
                    {preset === "memory"
                      ? "MEMORY"
                      : preset === "motion"
                        ? "MOVEMENT"
                        : "CINEMATIC"}{" "}
                    EDIT
                  </span>
                  <h3>
                    A still.
                    <br />
                    With a little life.
                  </h3>
                </div>
              </div>
              <p className="video-example-disclosure">
                Fictional AI portrait with a simple camera-motion illustration.
                This is not a video generated by this tool. Your finished result
                appears here.
              </p>
              <div className="video-preview-points">
                <span>
                  <Check size={16} /> Preview before saving
                </span>
                <span>
                  <Check size={16} /> Download as MP4
                </span>
                <span>
                  <Check size={16} /> No public gallery
                </span>
              </div>
            </>
          )}
          {deleteConfirm && (
            <div
              className="video-delete-confirm"
              role="group"
              aria-label="Confirm file deletion"
            >
              <p>
                Delete this request’s photo and video files? Downloads on your
                device are unaffected. Spent credits are not restored.
              </p>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void remove()}
              >
                Delete files now
              </button>
              <button
                className="text-button"
                onClick={() => setDeleteConfirm(false)}
              >
                <X size={14} /> Keep files
              </button>
            </div>
          )}
        </div>
      </div>
      {email && history.length > 0 && (
        <div className="video-history">
          <div>
            <h3>Your recent videos</h3>
            <p>
              Private to your account. Available for 24 hours from submission.
            </p>
          </div>
          <div className="video-history-list">
            {history.map((item) => (
              <button
                key={item.id}
                disabled={busy}
                aria-pressed={job?.id === item.id}
                onClick={() => {
                  cancelCheck();
                  ++viewVersion.current;
                  setJob(item);
                  setPreset(item.preset);
                  remember(item.id);
                  setShowOriginal(false);
                  setError("");
                  setDeleteConfirm(false);
                }}
              >
                <Film size={18} />
                <span>
                  <strong>{videoPreset(item.preset)?.name}</strong>
                  <small>
                    {new Date(item.createdAt).toLocaleDateString()} ·{" "}
                    {item.creditsCharged} credits
                  </small>
                </span>
                <span className={`video-status status-${item.status}`}>
                  {item.status}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
