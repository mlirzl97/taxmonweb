import { NextResponse } from "next/server";

function configuredOrigins() {
  return (process.env.TAXMON_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/** Protect cookie-authenticated mutations from cross-site browser requests. */
export function requireSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });

  try {
    const requestOrigin = new URL(request.url).origin;
    const allowed = new Set([requestOrigin, ...configuredOrigins()]);
    if (!allowed.has(new URL(origin).origin)) {
      return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "A same-origin request is required." }, { status: 403 });
  }

  return null;
}
