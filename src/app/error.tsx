"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="app-error-page">
      <section aria-labelledby="error-title" className="app-error-card">
        <p className="eyebrow">TaxMonWeb</p>
        <h1 id="error-title">We could not load this workspace</h1>
        <p>The error has been kept visible so it can be investigated without losing control context.</p>
        <button className="button button--primary" onClick={reset} type="button">Try again</button>
      </section>
    </main>
  );
}
