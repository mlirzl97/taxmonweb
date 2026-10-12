import { NextResponse } from "next/server";

function configuredOrigins() {
  return (process.env.TAXMON_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function configuredApplicationOrigin() {
  const value = process.env.TAXMON_APP_URL?.trim();
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Resolve the public origin used in links sent outside the application. */
export function applicationOrigin(request: Request) {
  const configured = configuredApplicationOrigin();
  if (configured) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (forwardedHost) {
    const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
    const protocol = forwardedProtocol.endsWith(":") ? forwardedProtocol : `${forwardedProtocol}:`;
    if (protocol !== "http:" && protocol !== "https:") return new URL(request.url).origin;
    try {
      return new URL(`${protocol}//${forwardedHost}`).origin;
    } catch {
      // Fall back to the runtime request URL when proxy headers are invalid.
    }
  }

  return new URL(request.url).origin;
}

/** Protect cookie-authenticated mutations from cross-site browser requests. */
export function requireSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });

  try {
    const requestOrigin = applicationOrigin(request);
    const allowed = new Set([requestOrigin, ...configuredOrigins()]);
    if (!allowed.has(new URL(origin).origin)) {
      return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
  }

  return null;
}
