import type { Metadata } from "next";

import { AnayRaid } from "./raid";

export const metadata: Metadata = { title: "Anay raid" };

export default function AnayPage() {
  return <AnayRaid />;
}
