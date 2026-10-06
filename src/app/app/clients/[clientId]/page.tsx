import { notFound } from "next/navigation";

import { ClientWorkspace } from "@/components/app/client-workspace";
import { FixturePageFrame } from "@/components/app/workspace-components";
import { fixtureClients } from "@/lib/fixtures";
import { isPrototypeDemoMode } from "@/lib/supabase/config";

export default async function ClientWorkspacePage({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params;
  const client = fixtureClients.find((item) => item.id === clientId);

  if (!client) notFound();

  return <FixturePageFrame><ClientWorkspace client={client} dataMode={process.env.TAXMON_DATA_MODE ?? "sanitized"} demoMode={isPrototypeDemoMode()} /></FixturePageFrame>;
}
