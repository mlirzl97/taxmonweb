import { requireModuleAccess } from "@/lib/server/module-access";

export default async function ClientsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireModuleAccess("clients");
  return children;
}
