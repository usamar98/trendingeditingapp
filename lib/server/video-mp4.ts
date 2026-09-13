import "server-only";
import { AppError } from "@/lib/errors";

type Box = { type: string; start: number; end: number };
// Bounded ISO-BMFF metadata parser. No codec execution or external resources.
export function inspectMp4(bytes: Buffer) {
  let boxCount = 0;
  function boxes(start: number, end: number): Box[] {
    const result: Box[] = [];
    while (start < end) {
      if (++boxCount > 2000 || start + 8 > end)
        throw new Error("Malformed MP4");
      let size = bytes.readUInt32BE(start);
      const type = bytes.toString("ascii", start + 4, start + 8);
      let header = 8;
      if (size === 1) {
        if (start + 16 > end) throw new Error("Malformed extended box");
        size = Number(bytes.readBigUInt64BE(start + 8));
        header = 16;
      }
      if (size === 0) size = end - start;
      if (!Number.isSafeInteger(size) || size < header || start + size > end)
        throw new Error("Invalid MP4 box bounds");
      result.push({ type, start: start + header, end: start + size });
      start += size;
    }
    return result;
  }
  function one(list: Box[], type: string) {
    const found = list.filter((b) => b.type === type);
    if (found.length !== 1) throw new Error(`Missing or duplicate ${type}`);
    return found[0];
  }
  function duration(box: Box) {
    const v = bytes[box.start];
    if (v !== 0 && v !== 1) throw new Error("Unsupported timing");
    const offset = box.start + (v === 1 ? 20 : 12);
    if (offset + (v === 1 ? 12 : 8) > box.end)
      throw new Error("Invalid timing");
    const scale = bytes.readUInt32BE(offset),
      ticks =
        v === 1
          ? Number(bytes.readBigUInt64BE(offset + 4))
          : bytes.readUInt32BE(offset + 4);
    if (!scale || !Number.isSafeInteger(ticks))
      throw new Error("Invalid timing");
    return ticks / scale;
  }
  const root = boxes(0, bytes.length);
  const ftyp = one(root, "ftyp");
  if (
    ftyp.end - ftyp.start < 8 ||
    !root.some((b) => b.type === "mdat" && b.end > b.start) ||
    root.some((b) => b.type === "moof")
  )
    throw new Error("Use a nonfragmented MP4");
  const moov = one(root, "moov"),
    movie = boxes(moov.start, moov.end);
  const seconds = duration(one(movie, "mvhd"));
  let width = 0,
    height = 0,
    videoTracks = 0;
  for (const trak of movie.filter((b) => b.type === "trak")) {
    const track = boxes(trak.start, trak.end),
      mdia = one(track, "mdia"),
      media = boxes(mdia.start, mdia.end),
      hdlr = one(media, "hdlr");
    if (hdlr.start + 12 > hdlr.end) throw new Error("Invalid handler");
    const kind = bytes.toString("ascii", hdlr.start + 8, hdlr.start + 12);
    if (kind !== "vide" && kind !== "soun")
      throw new Error("Unsupported MP4 track");
    const mdhd = one(media, "mdhd");
    if (Math.abs(duration(mdhd) - seconds) > 0.5)
      throw new Error("Inconsistent duration");
    const minf = one(media, "minf"),
      info = boxes(minf.start, minf.end),
      dinf = one(info, "dinf"),
      dref = one(boxes(dinf.start, dinf.end), "dref");
    if (dref.start + 8 > dref.end) throw new Error("Invalid data reference");
    for (const ref of boxes(dref.start + 8, dref.end))
      if (
        ref.type !== "url " ||
        ref.end - ref.start !== 4 ||
        bytes.readUInt32BE(ref.start) !== 1
      )
        throw new Error("External media references forbidden");
    const stbl = one(info, "stbl"),
      samples = boxes(stbl.start, stbl.end),
      stts = one(samples, "stts");
    if (stts.start + 8 > stts.end) throw new Error("Missing sample timing");
    const timingCount = bytes.readUInt32BE(stts.start + 4);
    if (
      !timingCount ||
      timingCount > 10000 ||
      stts.start + 8 + timingCount * 8 !== stts.end
    )
      throw new Error("Invalid sample timing");
    let ticks = 0,
      sampleCount = 0;
    for (let at = stts.start + 8; at < stts.end; at += 8) {
      const count = bytes.readUInt32BE(at),
        delta = bytes.readUInt32BE(at + 4);
      if (!count || !delta) throw new Error("Invalid sample duration");
      sampleCount += count;
      ticks += count * delta;
    }
    const scale = bytes.readUInt32BE(
      mdhd.start + (bytes[mdhd.start] === 1 ? 20 : 12),
    );
    if (
      sampleCount > 20000 ||
      !Number.isSafeInteger(ticks) ||
      Math.abs(ticks / scale - duration(mdhd)) > 0.1
    )
      throw new Error("Sample timeline does not match duration");
    if (kind !== "vide") continue;
    videoTracks++;
    const tkhd = one(track, "tkhd");
    if (tkhd.end - tkhd.start < 84) throw new Error("Invalid video track");
    width = bytes.readUInt32BE(tkhd.end - 8) / 65536;
    height = bytes.readUInt32BE(tkhd.end - 4) / 65536;
    const stsd = one(samples, "stsd");
    if (stsd.start + 8 > stsd.end || bytes.readUInt32BE(stsd.start + 4) !== 1)
      throw new Error("Unsupported codec list");
    const entries = boxes(stsd.start + 8, stsd.end);
    if (entries.length !== 1 || entries[0].type !== "avc1")
      throw new Error("Use H.264 MP4");
  }
  if (
    videoTracks !== 1 ||
    !Number.isFinite(seconds) ||
    seconds <= 0 ||
    width < 256 ||
    height < 256 ||
    width > 4096 ||
    height > 4096 ||
    width * height > 8_500_000
  )
    throw new Error("Invalid video dimensions or duration");
  return { seconds, width, height };
}
export function validateReferenceVideo(bytes: Buffer) {
  try {
    const info = inspectMp4(bytes);
    if (info.seconds < 3 || info.seconds > 5.05) throw new Error("Duration");
    return info;
  } catch {
    throw new AppError(
      "INVALID_VIDEO",
      "Use a 3–5 second H.264 MP4 with one visible person, at least 256 pixels on each side. Export a shorter MP4 if needed.",
    );
  }
}
