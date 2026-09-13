import Link from "next/link";
import { Aperture } from "lucide-react";
import { AccountMenu } from "./account-menu";
export function Header() {
  return (
    <header className="site-header">
      <Link href="/" className="brand" aria-label="EditingApp home">
        <span className="brand-icon">
          <Aperture size={23} />
        </span>
        EditingApp<span className="brand-period">.</span>
      </Link>
      <nav aria-label="Main navigation">
        <Link href="/#tools">All tools</Link>
        <Link href="/pricing">Pricing</Link>
        <Link href="/guides">Photo guides</Link>
      </nav>
      <AccountMenu />
    </header>
  );
}
export function Footer() {
  return (
    <footer className="site-footer">
      <Link href="/" className="brand">
        <Aperture size={22} />
        EditingApp.
      </Link>
      <p>A little imagination. A lot of you.</p>
      <div>
        <Link href="/guides">Guides</Link>
        <Link href="/about">About</Link>
        <Link href="/#faq">FAQs</Link>
        <Link href="/privacy">Photo privacy</Link>
        <Link href="/terms">Terms</Link>
        <span>© {new Date().getUTCFullYear()} EditingApp</span>
      </div>
    </footer>
  );
}
