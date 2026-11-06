import type { Metadata } from "next";

import { Leaderboard } from "./leaderboard";

export const metadata: Metadata = { title: "Colony" };

export default function ColonyPage() {
  return <Leaderboard />;
}
