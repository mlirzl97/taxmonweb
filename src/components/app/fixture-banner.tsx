import { fixtureEnvironment } from "@/lib/fixtures";

export function FixtureBanner() {
  return (
    <div className="fixture-banner" role="note">
      <span className="fixture-banner__dot" />
      <span>
        <strong>Prototype</strong><span aria-hidden="true"> · </span>{fixtureEnvironment.label === "EMPTY LOCAL MODE" ? "Empty local workspace" : "Sanitized data"}
      </span>
    </div>
  );
}
