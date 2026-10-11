import { NextResponse } from "next/server";

import { isManualClientSetupSourceAllowed, parseManualClientSetupInput } from "@/lib/domain/manual-client-setup";
import { createManualClientSetup, listPortfolioClients } from "@/lib/server/client-repository";
import { isPrototypeDemoMode } from "@/lib/supabase/config";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const detail = new URL(request.url).searchParams.get("detail") === "registry" ? "registry" : "full";
    const data = await listPortfolioClients({ detail });
    return NextResponse.json({ data, fixtureSafe: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load the portfolio." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    const message = error instanceof Error ? error.message : "Unable to create the client setup.";
    const status = message.includes("not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
