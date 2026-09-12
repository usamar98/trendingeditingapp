import type { Metadata } from "next";
import "./globals.css";
import { appUrl } from "@/lib/server/config";
export const metadata: Metadata = {
  metadataBase: new URL(appUrl()),
  title: {
    default: "AI Retro Portrait Generator — 1980s Photos | EditingApp",
    template: "%s | EditingApp",
  },
  description:
    "Turn a selfie into an 80s studio portrait, cinematic retro photo, or vintage album keepsake. Choose a style, compare your AI portrait, and download with EditingApp.",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Your face. A different decade. | EditingApp",
    description:
      "Create a retro portrait from your selfie. Three styles, one nostalgic trip.",
    type: "website",
    siteName: "EditingApp",
    locale: "en_US",
  },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
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
