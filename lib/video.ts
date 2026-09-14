export const VIDEO_PRESETS = [
  {
    id: "cinematic",
    name: "Cinematic Portrait",
    eyebrow: "A LITTLE MOVIE MAGIC",
    description:
      "A gentle camera push-in. A natural blink. Your moment in the spotlight.",
    image: "/images/cinema.webp",
    motion:
      "A very slow, steady camera push-in as the person blinks naturally and breathes gently. Keep the head nearly still. A single continuous shot.",
  },
  {
    id: "memory",
    name: "Photo Comes Alive",
    eyebrow: "MAKE A MEMORY MOVE",
    description:
      "A quiet smile and subtle movement, keeping the character of your photo.",
    image: "/images/album.webp",
    motion:
      "Locked-off camera. The person gives a tiny, natural smile and a soft blink. Gentle breathing. Preserve the original photographic texture and lighting. A single continuous shot.",
  },
  {
    id: "breeze",
    name: "Golden Breeze",
    eyebrow: "SOFT, SLOW, CINEMATIC",
    description:
      "A light breeze, delicate hair movement and an unhurried camera.",
    image: "/images/studio.webp",
    motion:
      "Nearly stationary camera with a very slow push-in. A light breeze moves loose hair and fabric gently. The person remains facing the camera with natural breathing. A single continuous shot.",
  },
  {
    id: "motion",
    name: "Copy a Motion",
    eyebrow: "BRING YOUR OWN MOVES",
    description:
      "Transfer a short dance or gesture from your own reference clip onto a photo.",
    image: "/images/studio.webp",
    motion:
      "Follow the reference movement smoothly while preserving the person's facial identity, proportions, clothing and the background from the image.",
  },
] as const;
export type VideoPreset = (typeof VIDEO_PRESETS)[number]["id"];
export const VIDEO_CREDITS = { animation: 60, motion: 90 } as const;
export const VIDEO_SECONDS = 5;
export const VIDEO_REFERENCE_MAX_BYTES = 3_000_000;
export const VIDEO_FORM_MAX_BYTES = 4_100_000;
export function videoCredits(preset: VideoPreset) {
  return preset === "motion" ? VIDEO_CREDITS.motion : VIDEO_CREDITS.animation;
}
export function videoPreset(id: string) {
  return VIDEO_PRESETS.find((p) => p.id === id);
}
export function videoPrompt(preset: VideoPreset) {
  return `${videoPreset(preset)!.motion} Preserve recognizable facial features, age, skin tone, identity and the original composition. Keep the movement restrained and physically plausible. One continuous scene with consistent facial detail.`;
}
export type VideoJobView = {
  id: string;
  preset: VideoPreset;
  status:
    | "reserved"
    | "submitting"
    | "queued"
    | "processing"
    | "succeeded"
    | "failed"
    | "uncertain"
    | "expired";
  creditsCharged: number;
  createdAt: string;
  expiresAt: string;
  errorCode: string | null;
};

export function videoRecoveryMessage(code: string | null) {
  if (!code?.startsWith("VIDEO_")) return null;
  if (code === "VIDEO_SAVING")
    return {
      title: "Retrieving your video.",
      detail:
        "The generation request has finished processing. We’re retrieving and saving its result to your private library. No extra credits are charged.",
    };
  if (code === "VIDEO_ACCESS_DENIED")
    return {
      title: "Your video needs an access fix.",
      detail:
        "The video provider denied access to this result. Your request is saved and its credits remain reserved. Contact support with the request details below to restore access or review the reservation. Checking this request again does not charge more credits.",
    };
  return {
    title: "Your video needs another status check.",
    detail:
      "We couldn’t finish checking or saving this request. Your credits remain reserved while we recover its outcome. Check this same request again; this does not generate another video or charge more credits. If it persists, share the request details below with support.",
  };
}
