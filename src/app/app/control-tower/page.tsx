import { redirect } from "next/navigation";

import ControlTowerPage from "@/components/app/control-tower-page";
import { getAuthorizedControlTowerScope } from "@/lib/server/authorized-scope";
import { requireModuleAccess } from "@/lib/server/module-access";
import { getAuthenticatedUserProfile } from "@/lib/supabase/server";

type SearchParams = Promise<{ signal?: string; view?: string }>;

export default async function ControlTowerRoute({ searchParams }: { searchParams: SearchParams }) {
  await requireModuleAccess("control_tower");
  const params = await searchParams;
  if (params.signal === "attention") redirect("/app/work?due=attention");
  if (params.view === "due") redirect("/app/work");
  const initialScope = await getAuthorizedControlTowerScope();
  const profile = await getAuthenticatedUserProfile();
  return <ControlTowerPage displayName={profile?.displayName ?? "Master Admin"} initialScope={initialScope} initialView={params.view === "my-run" ? "my-run" : "overview"} />;
}
