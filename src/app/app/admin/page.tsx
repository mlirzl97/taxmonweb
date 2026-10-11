import AdminPage from "@/components/app/admin-page";
import { requireModuleAccess } from "@/lib/server/module-access";

export default async function AdminRoute() {
  await requireModuleAccess("admin");
  return <AdminPage />;
}
