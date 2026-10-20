import { NextResponse } from "next/server";

import { getAuthenticatedRequestContext } from "@/lib/supabase/server";

const CAPABILITY_LOOKUP_TIMEOUT_MS = 3500;

async function hasCapability(client: NonNullable<Awaited<ReturnType<typeof getAuthenticatedRequestContext>>["client"]>, capability: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), CAPABILITY_LOOKUP_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      Promise.resolve(client.rpc("has_active_capability", { required_capability: capability })).then(({ data, error }) => !error && data === true).catch(() => false),
      timeout,
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * API command/query boundary. UI visibility is not authorization.
 * Returns a response when access is denied, otherwise null.
 */
export async function requireApiCapability(capabilities: readonly string[]) {
  const { client, user } = await getAuthenticatedRequestContext();
  if (!user || !client) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // hasCapability resolves (never rejects), so every lookup must finish before
  // deciding; taking the first settled result would deny on a fast `false`.
  const results = await Promise.all(capabilities.map((capability) => hasCapability(client, capability)));
  if (!results.some(Boolean)) return NextResponse.json({ error: "You are not authorized for this operation." }, { status: 403 });

  return null;
}

/** Require every listed capability for composite administration commands. */
export async function requireApiCapabilities(capabilities: readonly string[]) {
  for (const capability of capabilities) {
    const denied = await requireApiCapability([capability]);
    if (denied) return denied;
  }
  return null;
}
