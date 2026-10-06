import { redirect } from "next/navigation";

export default function CalendarPage() {
  redirect("/app/control-tower?view=calendar");
}
