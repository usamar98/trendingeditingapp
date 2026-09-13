import { ImageResponse } from "next/og";
export const alt = "EditingApp — AI Photo Tools. Retro Portraits & Figurines.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 70,
        background: "#eaf0df",
        color: "#243f2c",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", fontSize: 36, fontWeight: 700 }}>
        ✳ EditingApp.
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontSize: 82,
          fontWeight: 700,
          letterSpacing: -4,
          lineHeight: 1.1,
        }}
      >
        <span>Your photo.</span>
        <span>A new possibility.</span>
      </div>
      <div style={{ display: "flex", fontSize: 26 }}>
        AI PHOTO TOOLS / RETRO PORTRAITS · COLLECTIBLE FIGURINES
      </div>
    </div>,
    size,
  );
}
