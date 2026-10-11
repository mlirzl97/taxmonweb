import { redirect } from "next/navigation";

import { AppShell } from "@/components/app/app-shell";
import { isCalibrationOpenEditMode, isPrototypeDemoMode } from "@/lib/supabase/config";
import { getAuthenticatedAppUser, getAuthenticatedUser } from "@/lib/supabase/server";

export default async function ProtectedAppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const demoMode = isPrototypeDemoMode();
  const user = demoMode ? null : await getAuthenticatedUser();
  const appUser = demoMode ? null : await getAuthenticatedAppUser();

  if (!demoMode && !user) {
    redirect("/login");
  }

  if (!demoMode && !appUser) {
    redirect("/login?error=not-provisioned");
  }

  if (!demoMode && appUser?.account_status === "pending") {
    redirect("/activate");
  }

  if (!demoMode && (!appUser?.is_active || appUser.account_status !== "active")) {
    redirect("/login?error=inactive");
  }

  return <AppShell calibrationEditMode={isCalibrationOpenEditMode()} demoMode={demoMode} email={user?.email ?? "Master Admin"} persona={demoMode ? "Master Admin" : undefined}>{children}</AppShell>;
}
