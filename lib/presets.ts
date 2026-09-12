export const PRESETS = [
  {
    id: "studio",
    name: "80s Studio",
    eyebrow: "THE CLASSIC",
    description: "Big hair. Soft flash. Main character energy.",
    image: "/images/studio.webp",
    prompt:
      "An authentic 1980s professional studio portrait. Tasteful voluminous period hairstyle, a cream tailored jacket and period-appropriate clothing, mottled blue studio backdrop, soft frontal flash, subtle 35mm film grain. Natural skin texture and realistic fabric.",
  },
  {
    id: "cinema",
    name: "Retro Cinema",
    eyebrow: "THE SCENE STEALER",
    description: "Moody light, rich colors, a little drama.",
    image: "/images/cinema.webp",
    prompt:
      "A photorealistic 1980s cinema publicity portrait. Burgundy period clothing, teal shadows and warm amber practical light, subtle film grain, shallow depth of field, believable cinematic photography. No movie title or text.",
  },
  {
    id: "album",
    name: "Vintage Family Album",
    eyebrow: "THE KEEPSAKE",
    description: "Warm tones. Sunday afternoons. Pure nostalgia.",
    image: "/images/album.webp",
    prompt:
      "A single-person candid portrait from a 1980s family photo album. Cozy period knitwear, warm window light, softly faded analog colors, a lived-in home backdrop, restrained grain. No extra people, frames, text or date stamps.",
  },
] as const;
export type Preset = (typeof PRESETS)[number]["id"];
export type Quality = "medium" | "high";
export const DAILY_LIMIT = 3;
export const MAX_FILE_BYTES = 4_000_000;
export function portraitPrompt(preset: Preset) {
  return `Edit the uploaded reference photograph into one realistic portrait of the SAME person. Preserve their recognizable identity: facial proportions, eye shape and color, nose, lips, jaw, skin tone, age, expression and distinctive features. Do not beautify, lighten skin, change ethnicity, make younger, or replace the face. Keep the face unobstructed and in focus. Change clothing, styling, surroundings and photographic treatment only. ${PRESETS.find((p) => p.id === preset)!.prompt} Head-and-shoulders vertical composition. This is an imaginative retro restyling, not an archival photo.`;
}
