import { requireModuleAccess } from "@/lib/server/module-access";

export default async function TeamLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireModuleAccess("team");
  return children;
}
