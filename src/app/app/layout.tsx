import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { isPrototypeDemoMode } from "@/lib/supabase/config";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export default async function ProtectedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const demoMode = isPrototypeDemoMode();
  const user = demoMode ? null : await getAuthenticatedUser();

  if (!demoMode && !user) {
    redirect("/login");
  }

  return <AppShell demoMode={demoMode} email={user?.email ?? "HOD demo persona"}>{children}</AppShell>;
}
