import { notFound } from "next/navigation";

import { FixturePageFrame, WorkDetail } from "@/components/app/workspace-components";
import { adaptLiveGeneratedWork } from "@/lib/domain/live-work-adapter";
import { fixtureWork } from "@/lib/fixtures";
import { requireModuleAccess } from "@/lib/server/module-access";
import { listLiveGeneratedWork } from "@/lib/server/generated-work-repository";
import { isPrototypeDemoMode } from "@/lib/supabase/config";

export default async function WorkJourneyRoute({ params }: { params: Promise<{ workId: string }> }) {
  await requireModuleAccess("work");
  const { workId } = await params;
  const work = isPrototypeDemoMode()
    ? fixtureWork.find((item) => item.id === workId)
    : (await listLiveGeneratedWork()).filter((item) => item.id === workId).map((item) => adaptLiveGeneratedWork(item))[0];
  if (!work) notFound();

  return <FixturePageFrame><WorkDetail fullPage serverAuthorized={!isPrototypeDemoMode()} work={work} /></FixturePageFrame>;
}
