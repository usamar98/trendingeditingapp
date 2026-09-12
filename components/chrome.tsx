import Link from "next/link";
import { Aperture, ArrowUpRight } from "lucide-react";
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
        <Link href="/#how-it-works">How it works</Link>
        <Link href="/#styles">The styles</Link>
        <Link href="/#faq">FAQs</Link>
      </nav>
      <Link className="header-cta" href="/#studio">
        Make a little history <ArrowUpRight size={17} />
      </Link>
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
      <p>New memories. Old-school feeling.</p>
      <div>
        <Link href="/privacy">Photo privacy</Link>
        <Link href="/terms">Terms</Link>
        <span>© {new Date().getUTCFullYear()} EditingApp</span>
      </div>
    </footer>
  );
}
