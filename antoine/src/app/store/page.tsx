import type { Metadata } from "next";

import { Store } from "./store";

export const metadata: Metadata = { title: "Store" };

export default function StorePage() {
  return <Store />;
}
