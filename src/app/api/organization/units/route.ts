import { NextResponse } from "next/server";

import { listOrganizationUnitOptions } from "@/lib/server/client-repository";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export async function GET() {
  if (!(await getAuthenticatedUser())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ data: await listOrganizationUnitOptions() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load organizational units." }, { status: 500 });
  }
}
