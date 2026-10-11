export default function RootLoading() {
  return (
    <main aria-label="Loading TaxMonWeb" className="app-error-page">
      <div className="loading-stack" style={{ width: "min(420px, 80vw)" }}>
        <div className="skeleton" style={{ height: 34, width: "55%" }} />
        <div className="skeleton" style={{ width: "100%" }} />
        <div className="skeleton" style={{ width: "82%" }} />
      </div>
    </main>
  );
}
