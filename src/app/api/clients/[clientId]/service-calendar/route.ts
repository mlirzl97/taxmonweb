import { NextResponse } from "next/server";

import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { loadClientServiceCalendar } from "@/lib/server/client-calendar";
import { getPortfolioClient } from "@/lib/server/client-repository";

function requestedYear(value: string | null) {
  const year = Number(value ?? new Date().getUTCFullYear());
  return Number.isInteger(year) && year >= 2020 && year <= 2200 ? year : null;
}

export async function GET(request: Request, { params }: { params: Promise<{ clientId: string }> }) {
  const denied = await requireApiCapability(["ReviewTaxProfile", "ViewScopedPortfolio", "ViewTaxControlHistory"]);
  if (denied) return denied;

  const year = requestedYear(new URL(request.url).searchParams.get("year"));
  if (year === null) return NextResponse.json({ error: "A valid calendar year is required." }, { status: 400 });

  try {
    const { clientId } = await params;
    const portfolioClient = await getPortfolioClient(clientId);
    if (!portfolioClient) return NextResponse.json({ error: "Client not found." }, { status: 404 });

    const calendar = await loadClientServiceCalendar(portfolioClientToFixtureClient(portfolioClient), year);
    return NextResponse.json({ data: calendar.rows, heldRows: calendar.heldRows, notices: calendar.notices, source: "published-calendar", fixtureSafe: true });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the client service calendar.", { status: 503, logContext: "load client service calendar" });
  }
}
