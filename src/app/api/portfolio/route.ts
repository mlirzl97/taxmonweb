import { NextResponse } from "next/server";

import { parseManualClientSetupInput } from "@/lib/domain/manual-client-setup";
import { listPortfolioClients } from "@/lib/server/portfolio-repository";
import { createManualClientSetup } from "@/lib/server/portfolio-repository";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await listPortfolioClients();
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

  if (process.env.TAXMON_DATA_MODE !== "production" && parsed.value.sourceSystem !== "synthetic_fixture") {
    return NextResponse.json(
      { error: "Only synthetic fixture setup is enabled in this environment." },
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
