import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import ffmpeg from "ffmpeg-static";

// Synthetic moving test pattern, never a provider result or a person's private photo.
export function syntheticVideo(seconds = 5) {
  if (!ffmpeg) throw new Error("ffmpeg test dependency unavailable");
  const folder = mkdtempSync(join(tmpdir(), "editingapp-video-test-"));
  try {
    const output = join(folder, "synthetic.mp4");
    execFileSync(
      ffmpeg,
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "testsrc2=size=300x400:rate=12",
        "-t",
        String(seconds),
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        output,
      ],
      { timeout: 15000, windowsHide: true },
    );
    return readFileSync(output);
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}
