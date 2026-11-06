import type { Metadata } from "next";

import { Profile } from "./profile";

export const metadata: Metadata = { title: "Me" };

export default function MePage() {
  return <Profile />;
}
