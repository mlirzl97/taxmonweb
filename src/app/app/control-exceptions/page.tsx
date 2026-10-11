import { redirect } from "next/navigation";

export default function ControlExceptionsPage() {
  redirect("/app/work?due=attention");
}
