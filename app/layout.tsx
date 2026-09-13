import type { Metadata } from "next";
import "./globals.css";
import { appUrl } from "@/lib/server/config";
import { pageMetadata } from "@/lib/seo";
import { AccountProvider } from "@/components/account-provider";
export const metadata: Metadata = {
  ...pageMetadata(
    "AI Photo Tools — Retro Portraits & Figurines",
    "Create AI retro portraits and collectible figurine images from your photo. Explore the tools, compare your result and download your favorites.",
    "/",
  ),
  metadataBase: new URL(appUrl()),
  title: {
    default: "AI Photo Tools — Retro Portraits & Figurines | EditingApp",
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
        <AccountProvider>{children}</AccountProvider>
      </body>
    </html>
  );
}
