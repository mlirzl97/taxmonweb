import { NextResponse } from "next/server";

import type { TaxProfilePersistencePayload } from "@/lib/domain/client-profile-persistence";
import { getLatestTaxProfileVersion, saveTaxProfileVersion, validateTaxProfileVersion } from "@/lib/server/portfolio-repository";
import { getAuthenticatedUser } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ clientId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication is required to read a Tax Profile." }, { status: 401 });

  try {
    const result = await getLatestTaxProfileVersion((await context.params).clientId);
    return NextResponse.json({ clientFound: result?.clientFound ?? false, data: result?.data ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load the saved Tax Profile.";
    const status = /not authorized|outside the caller|authentication/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(request: Request, context: RouteContext) {
  const user = await getAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Authentication is required to change a Tax Profile." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!body || typeof body !== "object") return NextResponse.json({ error: "Profile command is invalid." }, { status: 400 });
  const command = body as Record<string, unknown>;
  const action = command.action;
  const reason = typeof command.reason === "string" ? command.reason.trim() : "";
  if (!reason) return NextResponse.json({ error: "A reason is required for a profile change." }, { status: 400 });

  try {
    if (action === "validate") {
      if (typeof command.versionId !== "string") return NextResponse.json({ error: "A saved profile version is required before validation." }, { status: 400 });
      const data = await validateTaxProfileVersion(command.versionId, reason);
      return NextResponse.json({ data, state: "active" });
    }

    const payload = command.payload as TaxProfilePersistencePayload | undefined;
    if (!payload || typeof payload !== "object" || !payload.profile || !payload.assignment) {
      return NextResponse.json({ error: "A complete profile payload is required." }, { status: 400 });
    }
    const data = await saveTaxProfileVersion((await context.params).clientId, { ...payload, reason });
    if (action === "save-and-validate") {
      const validated = await validateTaxProfileVersion(data.id, reason);
      return NextResponse.json({ data: validated, state: "active" });
    }
    return NextResponse.json({ data, state: "ready_for_validation" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to apply the Tax Profile command.";
    const status = /not authorized|outside the caller/i.test(message) ? 403 : /required|cannot be activated|invalid/i.test(message) ? 422 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
