import type { Metadata } from "next";
import "./globals.css";
import { appUrl } from "@/lib/server/config";
import { pageMetadata } from "@/lib/seo";
export const metadata: Metadata = {
  ...pageMetadata(
    "AI Retro Portrait Generator — 1980s Photos",
    "Turn your selfie into an 80s AI portrait. Choose studio, cinema or vintage album styling, compare your face, and download your portrait and before-and-after.",
    "/",
  ),
  metadataBase: new URL(appUrl()),
  title: {
    default: "AI Retro Portrait Generator — 1980s Photos | EditingApp",
    template: "%s | EditingApp",
  },
  verification: process.env.GOOGLE_SITE_VERIFICATION
    ? { google: process.env.GOOGLE_SITE_VERIFICATION.trim() }
    : undefined,
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
