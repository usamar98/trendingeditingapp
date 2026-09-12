export async function downloadFile(url: string, filename: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok)
    throw new Error("The download could not be loaded. Please try again.");
  saveBlob(await response.blob(), filename);
}
function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function loadImage(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok)
    throw new Error("A photo could not be loaded. Please try again.");
  return createImageBitmap(await response.blob());
}
export async function downloadComparison(
  original: string,
  portrait: string,
  style: string,
) {
  const images = await Promise.all([loadImage(original), loadImage(portrait)]);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1600;
    canvas.height = 1360;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser cannot create a comparison image.");
    ctx.fillStyle = "#f7f5f0";
    ctx.fillRect(0, 0, 1600, 1360);
    ctx.fillStyle = "#252923";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("EditingApp", 48, 72);
    ctx.font = "28px sans-serif";
    ctx.fillText(`${style} · AI-created portrait`, 48, 122);
    images.forEach((img, i) => {
      const x = 48 + i * 776,
        y = 170,
        w = 728,
        h = 1050;
      const scale = Math.min(w / img.width, h / img.height);
      ctx.fillStyle = "#e5e3dd";
      ctx.fillRect(x, y, w, h);
      ctx.drawImage(
        img,
        x + (w - img.width * scale) / 2,
        y + (h - img.height * scale) / 2,
        img.width * scale,
        img.height * scale,
      );
    });
    ctx.fillStyle = "#252923";
    ctx.font = "30px sans-serif";
    ctx.fillText("Original", 48, 1280);
    ctx.fillText("AI portrait", 824, 1280);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Could not create comparison image.")),
        "image/png",
      ),
    );
    saveBlob(blob, "editingapp-before-and-after.png");
  } finally {
    images.forEach((img) => img.close());
  }
}
