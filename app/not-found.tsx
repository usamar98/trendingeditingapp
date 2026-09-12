import Link from "next/link";
export default function NotFound() {
  return (
    <main className="legal" id="main">
      <p className="eyebrow">404 / LOST IN TIME</p>
      <h1>This page didn’t develop.</h1>
      <p>Let’s head back to your photo studio.</p>
      <Link className="primary" href="/">
        Back to EditingApp
      </Link>
    </main>
  );
}
