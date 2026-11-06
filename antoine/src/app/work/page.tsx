import type { Metadata } from "next";
import { Suspense } from "react";

import { WorkQueue } from "./work-queue";

export const metadata: Metadata = { title: "Work" };

export default function WorkPage() {
  return (
    <Suspense fallback={<main className="app" />}>
      <WorkQueue />
    </Suspense>
  );
}
