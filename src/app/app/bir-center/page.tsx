import { BirCenter } from "@/components/app/bir-center";
import { listBirOfficeReference } from "@/lib/server/bir-center-repository";
import { listTaxFoundationReference } from "@/lib/server/tax-foundation-repository";

export default async function BirCenterPage() {
  const [offices, reference] = await Promise.all([
    listBirOfficeReference(),
    listTaxFoundationReference(),
  ]);

  // Taxpayer-to-office links and audit context will come from the normalized
  // Tax Profile projection. Do not reintroduce fixture clients here while
  // that source is intentionally unresolved.
  return <BirCenter offices={offices} taxpayers={[]} taxTypes={reference.taxTypes} forms={reference.forms} />;
}
