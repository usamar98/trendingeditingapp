import sharp from "sharp";
import { AppError } from "@/lib/errors";
import { MAX_FILE_BYTES } from "@/lib/presets";
export async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new AppError("TOO_LARGE", "Please choose a photo under 4 MB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError("EMPTY", "Choose a photo first.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw new AppError("TOO_LARGE", "Please choose a photo under 4 MB.", 413);
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}
export async function uploadForm(request: Request) {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.startsWith("multipart/form-data;"))
    throw new AppError("FORMAT", "Upload a JPG, PNG or WebP photo.");
  const bytes = await readBody(request, MAX_FILE_BYTES + 20_000);
  try {
    return await new Response(bytes, {
      headers: { "content-type": contentType },
    }).formData();
  } catch {
    throw new AppError(
      "FORMAT",
      "The upload could not be read. Please choose the photo again.",
    );
  }
}
export async function normalizePhoto(file: File) {
  const allowed: Record<string, string> = {
    "image/jpeg": "jpeg",
    "image/png": "png",
    "image/webp": "webp",
  };
  if (!allowed[file.type] || !file.size || file.size > MAX_FILE_BYTES)
    throw new AppError(
      "INVALID_UPLOAD",
      "Choose a JPG, PNG or WebP photo under 4 MB.",
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  try {
    const image = sharp(bytes, {
      limitInputPixels: 16_000_000,
      failOn: "warning",
      animated: true,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== allowed[file.type] ||
      (metadata.pages || 1) !== 1 ||
      !metadata.width ||
      !metadata.height ||
      Math.min(metadata.width, metadata.height) < 256
    )
      throw new Error("Invalid image");
    // Re-encoding strips EXIF/GPS. Auto-orient before resizing; never enlarge faces.
    return await image
      .rotate()
      .resize({
        width: 1536,
        height: 1536,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 92 })
      .toBuffer();
  } catch {
    throw new AppError(
      "INVALID_UPLOAD",
      "Use a valid, still JPG, PNG or WebP photo at least 256 × 256 pixels and no larger than 16 megapixels.",
    );
  }
}
