import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { normalizePhoto, readBody } from "@/lib/server/upload";
describe("server upload validation", () => {
  it("accepts a valid selfie, strips EXIF and outputs a normalized JPEG", async () => {
    const png = await sharp({
      create: { width: 600, height: 800, channels: 3, background: "#aacc88" },
    })
      .withMetadata()
      .png()
      .toBuffer();
    const result = await normalizePhoto(
      new File([png], "photo.png", { type: "image/png" }),
    );
    const metadata = await sharp(result).metadata();
    expect(metadata.format).toBe("jpeg");
    expect(metadata.exif).toBeUndefined();
    expect(metadata.width).toBe(600);
  });
  it("rejects spoofed MIME types, corrupt bytes, SVG and oversized uploads", async () => {
    const png = await sharp({
      create: { width: 300, height: 300, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    for (const file of [
      new File([png], "fake.jpg", { type: "image/jpeg" }),
      new File(["not a photo"], "bad.png", { type: "image/png" }),
      new File(["<svg/>"], "bad.svg", { type: "image/svg+xml" }),
      new File([new Uint8Array(4_000_001)], "big.jpg", { type: "image/jpeg" }),
    ])
      await expect(normalizePhoto(file)).rejects.toThrow();
  });
  it("rejects tiny images and enforces streaming body size without Content-Length", async () => {
    const png = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#fff" },
    })
      .png()
      .toBuffer();
    await expect(
      normalizePhoto(new File([png], "small.png", { type: "image/png" })),
    ).rejects.toThrow();
    const request = new Request("http://localhost/api", {
      method: "POST",
      body: "a".repeat(100),
    });
    await expect(readBody(request, 50)).rejects.toThrow();
  });
});
