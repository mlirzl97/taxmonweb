import { notFound } from "next/navigation";

import { ClientWorkspace } from "@/components/app/client-workspace";
import { FixturePageFrame } from "@/components/app/workspace-components";
import { fixtureClients } from "@/lib/fixtures";
import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import { isCalibrationOpenEditMode, isPrototypeDemoMode } from "@/lib/supabase/config";
import { getPortfolioClient } from "@/lib/server/client-repository";
import { requireModuleAccess } from "@/lib/server/module-access";

export default async function ClientWorkspacePage({ params }: { params: Promise<{ clientId: string }> }) {
  await requireModuleAccess("clients");
  const { clientId } = await params;
  const liveClient = await getPortfolioClient(clientId);
  // Fixture records are intentionally available only in the explicitly gated
  // sanitized prototype. Production must never resolve an unknown client to a
  // local fixture, even when the requested id happens to match one.
  const client = liveClient
    ? portfolioClientToFixtureClient(liveClient)
    : isPrototypeDemoMode()
      ? fixtureClients.find((item) => item.id === clientId)
      : undefined;

  if (!client) notFound();

  return <FixturePageFrame><ClientWorkspace calibrationEditMode={isCalibrationOpenEditMode()} client={client} demoMode={isPrototypeDemoMode()} serverAuthorized={Boolean(liveClient)} /></FixturePageFrame>;
}
