import { NextResponse } from "next/server";

import { toBirOfficeOption } from "@/lib/domain/bir-office-reference";
import { apiErrorResponse } from "@/lib/server/api-error";
import { requireApiCapability } from "@/lib/server/api-authorization";
import { listBirOfficeReference } from "@/lib/server/bir-center-repository";

export async function GET() {
  // Governed reference data: anyone who reads or corrects client profiles needs the office master.
  const denied = await requireApiCapability(["MaintainClientRepository", "CorrectTaxProfile", "ReviewTaxProfile", "ViewScopedPortfolio"]);
  if (denied) return denied;

  try {
    const offices = await listBirOfficeReference();
    const data = offices
      .filter((office) => office.officeType === "rdo")
      .map((office) => toBirOfficeOption({ code: office.code, name: office.name }))
      .filter((office): office is NonNullable<typeof office> => office !== null);
    return NextResponse.json({ data, source: "bir_offices" });
  } catch (error) {
    return apiErrorResponse(error, "Unable to load the BIR office reference.", { logContext: "load BIR offices" });
  }
}
