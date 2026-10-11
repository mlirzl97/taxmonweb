import { NextResponse } from "next/server";

type ApiErrorOptions = {
  status?: number;
  logContext: string;
};

/** Keep infrastructure/schema details in server logs, never in API responses. */
export function apiErrorResponse(error: unknown, fallback: string, options: ApiErrorOptions) {
  console.error(`[api] ${options.logContext}`, error);
  return NextResponse.json({ error: fallback }, { status: options.status ?? 500 });
}

/** Temporary compatibility for repositories that still throw untyped domain errors. */
export function inferredApiErrorStatus(error: unknown, fallback = 500) {
  const message = error instanceof Error ? error.message : "";
  if (/not authorized|outside the caller|authentication|capability/i.test(message)) return 403;
  if (/no longer available for retry/i.test(message)) return 409;
  if (/required|cannot be activated|invalid/i.test(message)) return 422;
  return fallback;
}
