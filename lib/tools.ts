import { PRESETS } from "@/lib/presets";
import { VIDEO_PRESETS } from "@/lib/video";

export const FIGURINE_PRESETS = [
  {
    id: "figurine-desk",
    name: "Desk Collectible",
    eyebrow: "THE MINI-ME",
    description: "A miniature you, on a clear display base.",
    image: "/images/figurine-desk.png",
  },
  {
    id: "figurine-box",
    name: "Boxed Edition",
    eyebrow: "THE COLLECTOR’S CUT",
    description: "Your own figure in a display box.",
    image: "/images/figurine-box.png",
  },
] as const;
export type FigurinePreset = (typeof FIGURINE_PRESETS)[number]["id"];
export type ImagePreset = (typeof PRESETS)[number]["id"] | FigurinePreset;
export type ImageFeature = "retro-portrait" | "ai-figurine";

/** Public catalog drives homepage cards, tool routes and discoverable links. No provider secrets. */
export const TOOL_CATALOG = [
  {
    id: "photo-to-video",
    slug: "ai-photo-to-video",
    name: "AI Photo to Video",
    category: "MAKE YOUR PHOTO MOVE",
    badge: "NEW · VIDEO STUDIO",
    description:
      "A still photo. A little movement. Create a cinematic portrait, bring a memory to life or transfer a move from your own clip.",
    image: "/images/cinema.webp",
    alt: "Fictional cinematic portrait illustrating the photo-to-video starting frame; not a generated video",
    title: "AI Photo to Video — Animate Your Photos",
    meta: "Turn a photo into a short AI video with cinematic movement or your own motion reference. See credits upfront, preview privately and download your MP4 with EditingApp.",
    headline: "Your photo. Its next scene.",
    presets: VIDEO_PRESETS,
  },
  {
    id: "retro-portrait",
    slug: "ai-retro-portraits",
    name: "AI Retro Portraits",
    category: "PHOTO RESTYLING",
    badge: "THE ORIGINAL",
    description:
      "Your face, a different decade. Reimagine your selfie as an 80s studio portrait, cinematic still or vintage keepsake.",
    image: "/images/studio.webp",
    alt: "AI-created retro portrait demonstration with a cream blazer and blue background",
    title: "AI Retro Portrait Generator — 1980s Photos",
    meta: "Create an 80s AI portrait from your selfie. Choose studio, cinema or vintage album styling, compare your face and download a portrait or before-and-after.",
    headline: "Your face. An 80s AI portrait.",
    presets: PRESETS,
  },
  {
    id: "ai-figurine",
    slug: "ai-figurine-generator",
    name: "AI Figurine Generator",
    category: "COLLECTIBLE PORTRAITS",
    badge: "NEW IN THE STUDIO",
    description:
      "Make yourself shelf-worthy. Turn a photo into a miniature desk collectible or a boxed figure with recognizable details.",
    image: "/images/figurine-desk.png",
    alt: "AI-created demonstration of a fictional person as a miniature desk collectible",
    title: "AI Figurine Generator — Turn a Photo into a Toy",
    meta: "Turn your photo into an AI collectible figurine image. Choose a desk display or boxed mini-me, check credits, compare the result and download your image.",
    headline: "Meet your miniature self.",
    presets: FIGURINE_PRESETS,
  },
] as const;
export function findTool(slug: string) {
  return TOOL_CATALOG.find((tool) => tool.slug === slug);
}
export function toolForFeature(feature: ImageFeature) {
  return TOOL_CATALOG.find(
    (
      tool,
    ): tool is Extract<(typeof TOOL_CATALOG)[number], { id: ImageFeature }> =>
      tool.id === feature,
  )!;
}
export function figurinePrompt(preset: FigurinePreset) {
  const scene =
    preset === "figurine-box"
      ? "Display the figure in an unbranded cream and sage collectible presentation box with a clear front window. The entire package is visible. No logos, lettering or accessories that imply real endorsements."
      : "Stand the figure on a clear acrylic display base on a tidy desk, with softly blurred creative workspace details and warm studio illumination. No packaging, lettering, logos or extra people.";
  return `Transform the reference person into a realistic product photograph of a carefully sculpted miniature collectible figurine. Preserve recognizable facial proportions, skin tone, hairstyle, age, expression and visible clothing cues. Represent one person only. Make the figurine visibly a crafted resin miniature with plausible joints, fabric sculpture and subtle material texture, not a living shrunken human. Infer only a simple neutral standing pose where the source does not show the full body. ${scene} Full figure in a vertical 1024 by 1536 composition, readable face, precise edges, restrained shallow depth of field. This is an imaginative AI-created image, not a real manufactured product or a downloadable 3D model.`;
}
