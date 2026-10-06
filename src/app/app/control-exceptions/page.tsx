import { redirect } from "next/navigation";

export default function ControlExceptionsPage() {
  redirect("/app/control-tower?view=overview&signal=attention");
}
