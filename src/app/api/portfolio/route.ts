import { NextResponse } from "next/server";

import { isManualClientSetupSourceAllowed, parseManualClientSetupInput } from "@/lib/domain/manual-client-setup";
import { apiErrorResponse, inferredApiErrorStatus } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { requireSameOrigin } from "@/lib/server/request-origin";
import { createManualClientSetup, listPortfolioClients } from "@/lib/server/client-repository";
import { isPrototypeDemoMode } from "@/lib/supabase/config";

export async function GET(request: Request) {
  const denied = await requireApiCapability(["ViewScopedPortfolio", "ReviewTaxProfile", "MaintainClientRepository"]);
  if (denied) return denied;

  try {
    const detail = new URL(request.url).searchParams.get("detail") === "registry" ? "registry" : "full";
    const data = await listPortfolioClients({ detail });
    return NextResponse.json({ data, fixtureSafe: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the portfolio.", { logContext: "load portfolio" });
  }
}

export async function POST(request: Request) {
  const denied = await requireApiCapability(["MaintainClientRepository"]);
  if (denied) return denied;
  const originDenied = requireSameOrigin(request);
  if (originDenied) return originDenied;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const parsed = parseManualClientSetupInput(body);

  if (!parsed.ok) {
    return NextResponse.json({ error: "Invalid client setup.", details: parsed.errors }, { status: 400 });
  }

  const prototypeMode = isPrototypeDemoMode();
  if (!isManualClientSetupSourceAllowed(parsed.value.sourceSystem, prototypeMode)) {
    return NextResponse.json(
      { error: prototypeMode ? "Only synthetic fixture setup is enabled in this environment." : "Synthetic fixture setup is disabled outside explicit prototype mode." },
      { status: 403 },
    );
  }

  try {
    const data = await createManualClientSetup(parsed.value);
    return NextResponse.json({ data, fixtureSafe: parsed.value.sourceSystem === "synthetic_fixture" }, { status: 201 });
  } catch (error) {
    return apiErrorResponse(error, "Unable to create the client setup.", { status: inferredApiErrorStatus(error), logContext: "create client setup" });
  }
}
