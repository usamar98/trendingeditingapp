"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="legal" id="main">
      <h1>We hit a snag.</h1>
      <p>
        Your existing portrait request is remembered in this browser. Reconnect
        to check its status.
      </p>
      <button className="primary" onClick={reset}>
        Try loading again
      </button>
    </main>
  );
}
