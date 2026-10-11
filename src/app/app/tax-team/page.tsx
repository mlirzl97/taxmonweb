import TaxTeamReportPage from "@/components/app/tax-team-report-page";
import { requireModuleAccess } from "@/lib/server/module-access";

type SearchParams = Promise<{ view?: string }>;

export default async function TaxTeamRoute({ searchParams }: { searchParams: SearchParams }) {
  await requireModuleAccess("tax_team");
  const params = await searchParams;
  const reportViews = new Set(["monthly", "qa", "rca", "audit"]);
  const initialView = params.view === "deadline-control"
    ? "deadline-control"
    : params.view === "period-locks"
      ? "period-locks"
      : reportViews.has(params.view ?? "")
        ? params.view as "monthly" | "qa" | "rca" | "audit"
        : "overview";
  return <TaxTeamReportPage initialView={initialView} />;
}
