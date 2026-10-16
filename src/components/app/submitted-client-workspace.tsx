"use client";

import { useEffect, useState } from "react";

import { submittedSetupToFixtureClient, type SubmittedClientSetup } from "@/lib/domain/submitted-client-projection";
import type { FixtureClient } from "@/lib/fixtures";
import { ClientWorkspace } from "./client-workspace";

export function SubmittedClientWorkspace({ clientId, calibrationEditMode }: { clientId: string; calibrationEditMode: boolean }) {
  const [client, setClient] = useState<FixtureClient | null>(null);

  useEffect(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem("taxmon.client.setup.drafts") ?? "[]") as unknown;
      if (!Array.isArray(parsed)) return;
      const setup = parsed.find((item) => {
        if (!item || typeof item !== "object") return false;
        const candidate = item as { status?: unknown; client?: { clientReferenceCode?: unknown } };
        return candidate.status === "submitted" && `submitted-${String(candidate.client?.clientReferenceCode ?? "")}` === clientId;
      }) as SubmittedClientSetup | undefined;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (setup) setClient(submittedSetupToFixtureClient(setup));
    } catch {
      setClient(null);
    }
  }, [clientId]);

  if (!client) return <div className="inline-empty" role="status">This submitted setup is no longer available in local storage.</div>;
  return <ClientWorkspace calibrationEditMode={calibrationEditMode} client={client} demoMode serverAuthorized={false} />;
}
