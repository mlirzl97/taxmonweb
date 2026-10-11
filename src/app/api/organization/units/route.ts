import { NextResponse } from "next/server";

import { listOrganizationUnitOptions } from "@/lib/server/client-repository";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";

export async function GET() {
  const denied = await requireApiCapability(["ViewScopedPortfolio", "MaintainClientRepository", "AdministerUsers", "AdministerOrganization"]);
  if (denied) return denied;
  try {
    return NextResponse.json({ data: await listOrganizationUnitOptions() });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load organizational units.", { logContext: "load organizational units" });
  }
}
