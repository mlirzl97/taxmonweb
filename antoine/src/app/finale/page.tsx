import type { Metadata } from "next";

import { Finale } from "./finale";

export const metadata: Metadata = { title: "Season finale" };

export default function FinalePage() {
  return <Finale />;
}
