import { notFound } from "next/navigation";

import { ClientWorkspace } from "@/components/app/client-workspace";
import { SubmittedClientWorkspace } from "@/components/app/submitted-client-workspace";
import { FixturePageFrame } from "@/components/app/workspace-components";
import { fixtureClients } from "@/lib/fixtures";
import { portfolioClientToFixtureClient } from "@/lib/domain/live-client-adapter";
import { isCalibrationOpenEditMode, isPrototypeDemoMode } from "@/lib/supabase/config";
import { getPortfolioClient } from "@/lib/server/client-repository";
import { requireModuleAccess } from "@/lib/server/module-access";

export default async function ClientWorkspacePage({ params }: { params: Promise<{ clientId: string }> }) {
  await requireModuleAccess("clients");
  const { clientId } = await params;
  // Fixture records are intentionally available only in the explicitly gated
  // sanitized prototype. Production must never resolve an unknown client to a
  // local fixture, even when the requested id happens to match one.
  const prototypeMode = isPrototypeDemoMode();
  if (prototypeMode && clientId.startsWith("submitted-")) return <FixturePageFrame><SubmittedClientWorkspace calibrationEditMode={isCalibrationOpenEditMode()} clientId={clientId} /></FixturePageFrame>;
  const liveClient = prototypeMode ? null : await getPortfolioClient(clientId);
  const client = prototypeMode
    ? fixtureClients.find((item) => item.id === clientId)
    : liveClient ? portfolioClientToFixtureClient(liveClient) : undefined;

  if (!client) notFound();

  return <FixturePageFrame><ClientWorkspace calibrationEditMode={isCalibrationOpenEditMode()} client={client} demoMode={prototypeMode} serverAuthorized={Boolean(liveClient)} /></FixturePageFrame>;
}
