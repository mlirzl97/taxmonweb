import { redirect } from "next/navigation";

import { moduleViewCapabilities } from "@/lib/domain/viewer-access";
import { isPrototypeDemoMode } from "@/lib/supabase/config";
import { getAuthenticatedRequestContext } from "@/lib/supabase/server";

type ProtectedModule = "control_tower" | "work" | "clients" | "team" | "tax_team" | "admin";

const CAPABILITY_LOOKUP_TIMEOUT_MS = 3500;

async function capabilityResult(operation: PromiseLike<{ data: boolean | null; error: unknown }>): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), CAPABILITY_LOOKUP_TIMEOUT_MS);
  });
  try {
    return await Promise.race([Promise.resolve(operation).then(({ data, error }) => !error && data === true).catch(() => false), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const capabilityAlternatives: Readonly<Record<ProtectedModule, readonly string[]>> = moduleViewCapabilities;

/** Client-side persona visibility is UX only; direct route requests need a server guard. */
export async function requireModuleAccess(module: ProtectedModule) {
  if (isPrototypeDemoMode()) return;

  const { client, user } = await getAuthenticatedRequestContext();
  if (!user || !client) redirect("/login");

  const results = await Promise.all(capabilityAlternatives[module].map((capability) =>
    capabilityResult(client.rpc("has_active_capability", { required_capability: capability })),
  ));

  if (!results.some(Boolean)) redirect("/app/control-tower?access=denied");
}
