"use client";

import { useState } from "react";

import { WorkRegisterView } from "@/components/app/control-tower-views";
import { FixturePageFrame, PageHeader, ScopeSwitcher, type ScopeFilter } from "@/components/app/workspace-components";

export default function MyWorkPage() {
  const [scope, setScope] = useState<ScopeFilter>("all");

  return (
    <FixturePageFrame>
      <PageHeader title="My Work" description="The execution view behind the Due Register: see the next step, control gates, and evidence still needed." />

      <div className="page-toolbar page-toolbar--stackable my-work-toolbar">
        <ScopeSwitcher onChange={setScope} value={scope} />
      </div>

      <WorkRegisterView scope={scope} />
    </FixturePageFrame>
  );
}
