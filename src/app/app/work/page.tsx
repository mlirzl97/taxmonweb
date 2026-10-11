import { redirect } from "next/navigation";

import MyWorkPage from "@/components/app/my-work-page";
import { requireModuleAccess } from "@/lib/server/module-access";

type SearchParams = Promise<{
  date?: string;
  due?: string;
  queue?: string;
  view?: string;
}>;

export default async function WorkRoute({ searchParams }: { searchParams: SearchParams }) {
  await requireModuleAccess("work");
  const params = await searchParams;
  if (params.view === "run") redirect("/app/control-tower?view=my-run");
  if (params.view === "locks") redirect("/app/tax-team?view=period-locks");
  const queue = params.queue === "today" || params.queue === "waiting" || params.queue === "attention" ? params.queue : "all";
  const due = params.due === "today" || params.due === "next-5" || params.due === "week" || params.due === "overdue" || params.due === "attention" || params.due === "blocked" || params.due === "statutory" ? params.due : "all";

  return (
    <MyWorkPage
      initialDate={params.date ?? null}
      initialDue={due}
      initialQueue={queue}
      initialView={params.view === "calendar" ? "calendar" : "queue"}
    />
  );
}
