import { BirCenter } from "@/components/app/bir-center";
import { listBirOfficeReference } from "@/lib/server/bir-center-repository";

export default async function BirCenterPage() {
  const offices = await listBirOfficeReference();
  return <BirCenter offices={offices} />;
}
