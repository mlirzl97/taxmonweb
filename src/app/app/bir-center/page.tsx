import { BirCenter } from "@/components/app/bir-center";
import { fixtureClients } from "@/lib/fixtures";
import { listBirOfficeReference } from "@/lib/server/bir-center-repository";

export default async function BirCenterPage() {
  const offices = await listBirOfficeReference();
  const taxpayers = fixtureClients.map((client) => ({
    id: client.id,
    name: client.name,
    group: client.clientGroup ?? "Unassigned group",
    rdoOrLts: client.entities[0]?.profile.rdoOrLts ?? "",
  }));
  return <BirCenter offices={offices} taxpayers={taxpayers} />;
}
