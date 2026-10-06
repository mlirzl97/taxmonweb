import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-error-page">
      <section aria-labelledby="not-found-title" className="app-error-card">
        <p className="eyebrow">TaxMonWeb</p>
        <h1 id="not-found-title">That workspace view is not available</h1>
        <p>Choose a primary workspace view to continue.</p>
        <Link className="button button--primary" href="/app/control-tower">Open Control Tower</Link>
      </section>
    </main>
  );
}
