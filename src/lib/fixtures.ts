export const fixtureEnvironment = {
  label: "REVIEW MODE",
  description: "Demonstration data only. No live client information or source documents are included.",
} as const;

/** Explicit clock for sanitized fixtures; screens must not infer dates from the host clock. */
export const fixtureClock = {
  today: "2026-10-05",
  year: 2026,
  month: 9,
  label: "5 October 2026",
} as const;

export type FixtureScope = "Tower North" | "Tower Central" | "Tower South";
export type FixtureStatus = "GREEN" | "AMBER" | "RED" | "UNRESOLVED";
export type FixtureSourceWeightClassification = "Extremely Heavy" | "Heavy" | "Moderate" | "Light" | "Super Light";
export type FixtureSource = "source_weighted_portfolio" | "synthetic_portfolio_test";
export type FixtureOperatingModel = "DELIVERY" | "SPECIALIST_CASE";
export type FixtureWorkStepState = "complete" | "current" | "waiting" | "blocked" | "not-started" | "unresolved";

export type FixtureWorkStep = {
  id: string;
  label: string;
  state: FixtureWorkStepState;
  detail: string;
};

export type FixtureWorkComponent = {
  label: "Submission" | "Payment" | "Evidence";
  state: string;
  detail: string;
};

export type FixtureWorkItem = {
  id: string;
  clientId: string;
  client: string;
  entity: string;
  registrationUnit: string;
  title: string;
  period: string;
  detail: string;
  stage: "PREPARE" | "REVIEW" | "CLIENT" | "FILE" | "POST-FILING";
  nextAction: string;
  status: FixtureStatus;
  statusReason: string;
  deadline: string;
  deadlineType: "TMF internal target" | "Client / service milestone" | "Control milestone";
  owner: string;
  scope: FixtureScope;
  steps: readonly FixtureWorkStep[];
  components: readonly FixtureWorkComponent[];
  returnedFrom?: string;
  blocker?: { category: "CLIENT APPROVAL" | "CLIENT DATA" | "FUNDING" | "INTERNAL" | "BIR/SYSTEM" | "OTHER"; reason: string };
};

export type FixtureExtractionField = {
  label: string;
  value: string;
  sourcePage: string;
  confidence: "High" | "Review required" | "Missing";
  provenance: "2303-derived" | "Human correction" | "Not on source";
  reviewState?: "unreviewed" | "corrected";
};

export type FixtureAuthority = {
  id: string;
  authority: string;
  reference: string;
  status: "Active" | "Review due" | "Not configured";
  effectiveFrom: string;
  effectiveTo?: string;
  entitlement: string;
  source: string;
};

export type FixtureAuditExposure = {
  id: string;
  taxableYear: string;
  matter: string;
  status: "Open" | "Under review" | "Closed";
  asOf: string;
  context: string;
  source: string;
};

export type FixtureTaxProfile = {
  registeredTaxpayerName: string;
  tinDisplay: string;
  branchCode: string;
  rdoOrLts: string;
  entityType: string;
  registeredAddress: string;
  lineOfBusiness: string;
  registrationEffective: string;
  registrationStatus: string;
  registeredActivities: string;
  tradeName: string;
  filingChannel: string;
  filingContext: string;
  eFPSGroup?: string;
  registeredTaxTypes: readonly string[];
  fiscalYearEnd?: string;
  booksType?: string;
  invoicing?: string;
  paymentRoute: "Client Pays" | "TMF Pays" | "Not configured";
  /** Numeric source workload value. Zero is preserved when the supplied source total requires it. */
  weight: number;
  weightLabel: string;
  weightNote?: string;
  sourceWeightClassification?: FixtureSourceWeightClassification;
  sourceFinalWeight: number | null;
  fixtureSource: FixtureSource;
  enateSetup: "Yes" | "No" | "Unknown";
  profileState: "Active" | "Ready for validation" | "Setup incomplete";
  sourceLabel: string;
  sourceKind: "2303-derived" | "approved registration source" | "manual validation";
  lastValidated?: string;
  validator?: string;
  authorities: readonly FixtureAuthority[];
  auditExposures: readonly FixtureAuditExposure[];
  attention: readonly string[];
  extractionFields?: readonly FixtureExtractionField[];
};

export type FixtureRegistrationUnit = {
  name: string;
  type: "Head Office" | "Branch";
  profile: FixtureTaxProfile;
};

export type FixtureTaxpayerEntity = {
  name: string;
  profile: FixtureTaxProfile;
  units: FixtureRegistrationUnit[];
};

export type FixtureAssignment = {
  preparer: string;
  checker: string;
  reviewer: string;
  tower: string;
  cluster: string;
  effectiveFrom: string;
};

export type FixtureTeamMember = {
  id: string;
  name: string;
  title: string;
  role: "HOD / Leader" | "Team Member" | "Reviewer" | "System Admin";
  tower: FixtureScope | "All A&T";
  cluster: string;
  active: boolean;
  email: string;
  operatingModel: FixtureOperatingModel;
  specialistTeam?: "Tax Team";
  careerServiceLevel?: string;
  reportsToOrgNodeId?: string | null;
  assignmentAliases?: readonly string[];
};

// The supplied org-chart photo and the domain-owner corrections provide the
// reporting shape. Lower cells not yet named remain explicit placeholders.
type FixtureOrgChartCareerLevel = "5.2" | "5.1" | "4.2" | "4.1" | "3.2" | "3.1" | "2.2" | "2.1" | "1.1";
type FixtureOrgChartNode = {
  id: string;
  name: string;
  careerServiceLevel: FixtureOrgChartCareerLevel;
  title: string;
  role: string;
  parentId: string | null;
  cluster: string;
  workloadPercent: number;
  rag: FixtureStatus;
  statusReason: string;
  sourceStatus: "confirmed" | "chart-label-pending" | "illustrative";
  photoUrl?: string | null;
};

const fixtureOrgChartSeedNodes: readonly FixtureOrgChartNode[] = [
  { id: "org-liezl", name: "Synthetic chart node 01", careerServiceLevel: "5.2", title: "Senior Manager · HOD", role: "HOD", parentId: null, cluster: "All A&T", workloadPercent: 64, rag: "GREEN", statusReason: "Overall team load is within the current operating range.", sourceStatus: "confirmed" },
  { id: "org-luiza", name: "Synthetic chart node 02", careerServiceLevel: "5.1", title: "Manager · Operations", role: "Operations Manager", parentId: "org-liezl", cluster: "All A&T", workloadPercent: 76, rag: "AMBER", statusReason: "Cross-cluster coordination and promotion review are being monitored.", sourceStatus: "confirmed" },

  { id: "org-c1-leader", name: "Synthetic chart node 03", careerServiceLevel: "4.2", title: "Assistant Manager · Barangay Atilano", role: "Cluster Leader", parentId: "org-luiza", cluster: "Barangay Atilano", workloadPercent: 82, rag: "AMBER", statusReason: "Cluster workload is elevated.", sourceStatus: "confirmed" },
  { id: "org-c2-leader", name: "Synthetic chart node 04", careerServiceLevel: "4.2", title: "Assistant Manager · Barangay Beato", role: "Cluster Leader", parentId: "org-luiza", cluster: "Barangay Beato", workloadPercent: 58, rag: "GREEN", statusReason: "Cluster load is currently within the operating range.", sourceStatus: "confirmed" },
  { id: "org-c3-leader", name: "Synthetic chart node 05", careerServiceLevel: "4.2", title: "Assistant Manager · Barangay de Vera", role: "Cluster Leader", parentId: "org-luiza", cluster: "Barangay de Vera", workloadPercent: 88, rag: "RED", statusReason: "Cluster workload is above the current intervention threshold.", sourceStatus: "confirmed" },

  { id: "org-c1-senior-supervisor", name: "Synthetic chart node 06", careerServiceLevel: "4.1", title: "Senior Supervisor · Barangay Atilano", role: "Senior 4.1", parentId: "org-c1-leader", cluster: "Barangay Atilano", workloadPercent: 72, rag: "AMBER", statusReason: "Current charted direct report.", sourceStatus: "confirmed" },
  { id: "org-c1-team-lead", name: "Synthetic chart node 07", careerServiceLevel: "3.2", title: "Experienced Team Lead · Barangay Atilano", role: "Experienced 3.2", parentId: "org-c1-leader", cluster: "Barangay Atilano", workloadPercent: 61, rag: "GREEN", statusReason: "Current charted direct report.", sourceStatus: "confirmed" },
  { id: "org-c1-junior-supervisor", name: "Barangay Atilano · Supervisor", careerServiceLevel: "4.1", title: "Junior Supervisor", role: "Junior 4.1", parentId: "org-c1-senior-supervisor", cluster: "Barangay Atilano", workloadPercent: 67, rag: "AMBER", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c1-senior-associate", name: "Barangay Atilano · Senior Associate", careerServiceLevel: "3.1", title: "Senior Associate", role: "Senior Associate", parentId: "org-c1-senior-supervisor", cluster: "Barangay Atilano", workloadPercent: 54, rag: "GREEN", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c1-associate-a", name: "Barangay Atilano · Associate A", careerServiceLevel: "2.2", title: "Junior Associate", role: "Associate", parentId: "org-c1-junior-supervisor", cluster: "Barangay Atilano", workloadPercent: 49, rag: "GREEN", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c1-associate-b", name: "Barangay Atilano · Associate B", careerServiceLevel: "2.1", title: "Associate", role: "Associate", parentId: "org-c1-junior-supervisor", cluster: "Barangay Atilano", workloadPercent: 77, rag: "AMBER", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c1-junior-associate", name: "Barangay Atilano · Junior Associate", careerServiceLevel: "2.2", title: "Junior Associate", role: "Associate", parentId: "org-c1-team-lead", cluster: "Barangay Atilano", workloadPercent: 44, rag: "GREEN", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },

  { id: "org-c2-senior-supervisor", name: "Synthetic chart node 08", careerServiceLevel: "4.1", title: "Supervisor · Barangay Beato", role: "4.1 Supervisor", parentId: "org-c2-leader", cluster: "Barangay Beato", workloadPercent: 69, rag: "AMBER", statusReason: "Current charted direct report.", sourceStatus: "confirmed" },
  { id: "org-c2-team-lead", name: "Synthetic chart node 09", careerServiceLevel: "4.1", title: "Supervisor · Barangay Beato", role: "4.1 Supervisor", parentId: "org-c2-leader", cluster: "Barangay Beato", workloadPercent: 47, rag: "GREEN", statusReason: "Current charted direct report.", sourceStatus: "confirmed" },
  { id: "org-c2-junior-supervisor", name: "Barangay Beato · Supervisor", careerServiceLevel: "4.1", title: "Junior Supervisor", role: "Junior 4.1", parentId: "org-c2-senior-supervisor", cluster: "Barangay Beato", workloadPercent: 73, rag: "AMBER", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c2-senior-associate", name: "Barangay Beato · Senior Associate", careerServiceLevel: "3.1", title: "Senior Associate", role: "Senior Associate", parentId: "org-c2-senior-supervisor", cluster: "Barangay Beato", workloadPercent: 39, rag: "GREEN", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c2-associate-a", name: "Barangay Beato · Associate A", careerServiceLevel: "2.2", title: "Junior Associate", role: "Associate", parentId: "org-c2-junior-supervisor", cluster: "Barangay Beato", workloadPercent: 63, rag: "AMBER", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c2-associate-b", name: "Barangay Beato · Associate B", careerServiceLevel: "2.1", title: "Associate", role: "Associate", parentId: "org-c2-junior-supervisor", cluster: "Barangay Beato", workloadPercent: 35, rag: "GREEN", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c2-junior-associate", name: "Barangay Beato · Junior Associate", careerServiceLevel: "2.2", title: "Junior Associate", role: "Associate", parentId: "org-c2-team-lead", cluster: "Barangay Beato", workloadPercent: 71, rag: "AMBER", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },

  { id: "org-c3-senior-supervisor", name: "Synthetic chart node 10", careerServiceLevel: "4.1", title: "Supervisor · Barangay de Vera", role: "4.1 Supervisor", parentId: "org-c3-leader", cluster: "Barangay de Vera", workloadPercent: 91, rag: "RED", statusReason: "Current charted direct report.", sourceStatus: "confirmed" },
  { id: "org-c3-team-lead", name: "Synthetic chart node 11", careerServiceLevel: "4.1", title: "Supervisor · Barangay de Vera", role: "4.1 Supervisor", parentId: "org-c3-leader", cluster: "Barangay de Vera", workloadPercent: 84, rag: "RED", statusReason: "Current charted direct report.", sourceStatus: "confirmed" },
  { id: "org-c3-junior-supervisor", name: "Barangay de Vera · Supervisor", careerServiceLevel: "4.1", title: "Junior Supervisor", role: "Junior 4.1", parentId: "org-c3-senior-supervisor", cluster: "Barangay de Vera", workloadPercent: 78, rag: "AMBER", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c3-senior-associate", name: "Barangay de Vera · Senior Associate", careerServiceLevel: "3.1", title: "Senior Associate", role: "Senior Associate", parentId: "org-c3-senior-supervisor", cluster: "Barangay de Vera", workloadPercent: 86, rag: "RED", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c3-associate-a", name: "Barangay de Vera · Associate A", careerServiceLevel: "2.2", title: "Junior Associate", role: "Associate", parentId: "org-c3-junior-supervisor", cluster: "Barangay de Vera", workloadPercent: 74, rag: "AMBER", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c3-associate-b", name: "Barangay de Vera · Associate B", careerServiceLevel: "2.1", title: "Associate", role: "Associate", parentId: "org-c3-junior-supervisor", cluster: "Barangay de Vera", workloadPercent: 92, rag: "RED", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
  { id: "org-c3-junior-associate", name: "Barangay de Vera · Junior Associate", careerServiceLevel: "2.2", title: "Junior Associate", role: "Associate", parentId: "org-c3-team-lead", cluster: "Barangay de Vera", workloadPercent: 66, rag: "AMBER", statusReason: "Name pending further drill-down.", sourceStatus: "illustrative" },
] as const;

const orgChartClusters = [
  { key: "c1", label: "Barangay Atilano", prefix: "Atilano", leadParentId: "org-c1-team-lead", seniorAssociateParentId: "org-c1-senior-associate" },
  { key: "c2", label: "Barangay Beato", prefix: "Beato", leadParentId: "org-c2-team-lead", seniorAssociateParentId: "org-c2-senior-associate" },
  { key: "c3", label: "Barangay de Vera", prefix: "de Vera", leadParentId: "org-c3-team-lead", seniorAssociateParentId: "org-c3-senior-associate" },
] as const;

const illustratedOrgNode = (
  id: string,
  name: string,
  careerServiceLevel: FixtureOrgChartCareerLevel,
  parentId: string,
  cluster: string,
  slot: number,
): FixtureOrgChartNode => {
  const workloadPercent = 24 + ((slot * 13) % 65);
  return {
    id,
    name,
    careerServiceLevel,
    title: `${careerServiceLevel === "3.1" ? "Senior Associate" : careerServiceLevel === "1.1" ? "Intern" : careerServiceLevel === "2.2" ? "Junior Associate" : "Associate"} · ${cluster}`,
    role: careerServiceLevel === "3.1" ? "Senior Associate" : careerServiceLevel === "1.1" ? "Intern" : "Associate",
    parentId,
    cluster,
    workloadPercent,
    rag: workloadPercent >= 78 ? "RED" : workloadPercent >= 58 ? "AMBER" : "GREEN",
    statusReason: "Illustrative roster member pending individual profile confirmation.",
    sourceStatus: "illustrative",
  };
};

const generatedOrgChartNodes: FixtureOrgChartNode[] = orgChartClusters.flatMap((cluster, clusterIndex) => {
  const generated: FixtureOrgChartNode[] = [];
  const extraSeniorAssociateId = `org-${cluster.key}-extra-senior-associate`;
  let slot = clusterIndex * 20;

  // Each named direct report has two direct reports. The added 3.1 node is
  // the second direct report under the named 3.2/4.1 supervisor line.
  generated.push(illustratedOrgNode(extraSeniorAssociateId, `${cluster.prefix} Senior Associate`, "3.1", cluster.leadParentId, cluster.label, ++slot));

  for (let index = 1; index <= 6; index += 1) {
    generated.push(illustratedOrgNode(`org-${cluster.key}-senior-associate-child-${index}`, `${cluster.prefix} Associate ${String(index).padStart(2, "0")}`, index % 2 === 0 ? "2.1" : "2.2", cluster.seniorAssociateParentId, cluster.label, ++slot));
  }

  for (let index = 1; index <= 6; index += 1) {
    generated.push(illustratedOrgNode(`org-${cluster.key}-extra-senior-associate-child-${index}`, `${cluster.prefix} Associate ${String(index + 6).padStart(2, "0")}`, index % 2 === 0 ? "2.1" : "2.2", extraSeniorAssociateId, cluster.label, ++slot));
  }

  generated.push(illustratedOrgNode(`org-${cluster.key}-intern`, `${cluster.prefix} Intern`, "1.1", extraSeniorAssociateId, cluster.label, ++slot));
  return generated;
});

// One additional intern completes the requested 70-person roster once the
// cross-portfolio Tax Control seat is included in the directory.
generatedOrgChartNodes.push(illustratedOrgNode("org-c1-intern-02", "Atilano Intern 02", "1.1", "org-c1-senior-associate", "Barangay Atilano", 99));

const syntheticFilipinoNames = [
  "Ana Villanueva", "Miguel Santos", "Camille Reyes", "Paolo Bautista", "Janelle Garcia", "Rafael Mendoza", "Bianca Cruz", "Carlo Navarro", "Marissa Aquino", "Diego Flores",
  "Katrina Ramos", "Enrico Mercado", "Liana Castillo", "Tomas Salazar", "Patricia Soriano", "Nico Valencia", "Clarisse Pascual", "Gabriel Cabrera", "Alyssa Dominguez", "Mateo Pineda",
  "Beatriz Santiago", "Joaquin Dela Cruz", "Reina Ocampo", "Luis de Leon", "Monica Alvarado", "Emilio David", "Hazel Evangelista", "Andres Legaspi", "Celeste Tolentino", "Marco Villarama",
  "Nina Galang", "Ramon Fajardo", "Isabel Magbanua", "Julian Dizon", "Joyce Marquez", "Adrian Natividad", "Lara Peralta", "Oscar Yap", "Sofia Manalo", "Victor Macapagal",
  "Elena Robles", "Benedict Lim", "Celine Soriano", "Dennis Flores", "Erika Ramos", "Felix Mercado", "Grace Castillo", "Hector Salazar", "Irene Valencia", "Jonas Pascual",
  "Karen Cabrera", "Leandro Dominguez", "Mara Pineda", "Noel Santiago", "Olivia Dela Cruz", "Pedro Villareal", "Queenie Ocampo", "Rico de Leon", "Sheila Alvarado", "Toby David",
  "Uma Evangelista", "Wilfredo Legaspi", "Yasmin Tolentino", "Zandro Villarama", "Arianne Galang", "Berto Fajardo", "Cheska Magbanua", "Daryl Dizon", "Eunice Marquez",
] as const;

const rawFixtureOrgChartNodes = [...fixtureOrgChartSeedNodes, ...generatedOrgChartNodes] as const;

if (rawFixtureOrgChartNodes.length !== syntheticFilipinoNames.length) {
  throw new Error("Synthetic Team roster name count must match the org-chart node count.");
}

export const fixtureOrgChartNodes = rawFixtureOrgChartNodes.map((node, index) => ({ ...node, name: syntheticFilipinoNames[index] }));

const orgNodeTower = (cluster: string): FixtureTeamMember["tower"] => {
  if (cluster === "Barangay Atilano") return "Tower North";
  if (cluster === "Barangay Beato") return "Tower Central";
  if (cluster === "Barangay de Vera") return "Tower South";
  return "All A&T";
};

const orgNodeRole = (node: (typeof fixtureOrgChartNodes)[number]): FixtureTeamMember["role"] => {
  if (node.careerServiceLevel.startsWith("5") || node.careerServiceLevel.startsWith("4")) return "HOD / Leader";
  return "Team Member";
};

// Directory and chart intentionally share this roster. Names are deterministic
// fictional Filipino fixtures and are not sourced from actual staff records.
export const fixtureOrgDirectoryMembers: readonly FixtureTeamMember[] = [
  ...fixtureOrgChartNodes.map((node): FixtureTeamMember => ({
    id: node.id,
    name: node.name,
    title: node.title,
    role: orgNodeRole(node),
    tower: orgNodeTower(node.cluster),
    cluster: node.cluster,
    active: true,
    email: `${node.id}@example.invalid`,
    operatingModel: node.id === "org-c2-team-lead" ? "SPECIALIST_CASE" : "DELIVERY",
    ...(node.id === "org-c2-team-lead" ? { specialistTeam: "Tax Team" as const } : {}),
    careerServiceLevel: node.careerServiceLevel,
    reportsToOrgNodeId: node.parentId,
    assignmentAliases: [],
  })),
  { id: "member-tax-control", name: "Tax Control", title: "Cross-portfolio Tax Control", role: "Reviewer", tower: "All A&T", cluster: "Tax Control", active: true, email: "tax.control@example.invalid", operatingModel: "SPECIALIST_CASE", specialistTeam: "Tax Team", careerServiceLevel: undefined, reportsToOrgNodeId: null, assignmentAliases: [] },
];

export function fixtureTeamMemberName(memberId: string): string {
  return fixtureOrgDirectoryMembers.find((member) => member.id === memberId)?.name ?? "Unassigned";
}

export type FixtureClient = {
  id: string;
  name: string;
  entitySummary: string;
  profileSummary: string;
  clientGroup?: string;
  scope: FixtureScope;
  assignment: FixtureAssignment;
  entities: FixtureTaxpayerEntity[];
};

export function getClientWorkloadWeight(client: FixtureClient): number {
  return client.entities[0]?.profile.sourceFinalWeight ?? 0;
}

const sanitized2303Fields: readonly FixtureExtractionField[] = [
  { label: "Form No.", value: "BIR Form 2303 · Revised April 2019", sourcePage: "Pages 1–3", confidence: "High", provenance: "2303-derived" },
  { label: "OCN", value: "Synthetic OCN · 000000000000", sourcePage: "Page 1", confidence: "High", provenance: "2303-derived" },
  { label: "Date OCN Generated", value: "Synthetic date · 2024", sourcePage: "Page 1", confidence: "High", provenance: "2303-derived" },
  { label: "TIN & Branch Code", value: "000-000-000-000", sourcePage: "Pages 1–3", confidence: "High", provenance: "2303-derived" },
  { label: "Name of Taxpayer", value: "Lakeshore Apparel Manufacturing Inc. (synthetic)", sourcePage: "Pages 1–3", confidence: "High", provenance: "2303-derived" },
  { label: "TIN Issuance Date", value: "Synthetic date · 2022", sourcePage: "Page 1", confidence: "High", provenance: "2303-derived" },
  { label: "Registering Office", value: "Head Office · synthetic", sourcePage: "Page 1", confidence: "High", provenance: "2303-derived" },
  { label: "Registered Address", value: "Synthetic industrial address · Laguna", sourcePage: "Pages 1–3", confidence: "High", provenance: "2303-derived" },
  { label: "Tax Registration Rows", value: "Synthetic income, VAT and withholding rows · see source table", sourcePage: "Pages 1–2", confidence: "Review required", provenance: "2303-derived" },
  { label: "Form Type / Filing Frequency", value: "Illustrative form rows · frequency requires approved rule content", sourcePage: "Pages 1–2", confidence: "Review required", provenance: "2303-derived" },
  { label: "Filing Start / Due Date", value: "Source table structure captured · deadline interpretation deferred to approved rules", sourcePage: "Pages 1–2", confidence: "Review required", provenance: "2303-derived" },
  { label: "Taxpayer Type/s", value: "Synthetic domestic corporation", sourcePage: "Page 2", confidence: "High", provenance: "2303-derived" },
  { label: "Trade Name 1", value: "Lakeshore Apparel (synthetic)", sourcePage: "Page 2", confidence: "High", provenance: "2303-derived" },
  { label: "PSIC", value: "Synthetic industry code", sourcePage: "Page 2", confidence: "High", provenance: "2303-derived" },
  { label: "Line of Business", value: "Synthetic apparel manufacturing", sourcePage: "Page 2", confidence: "High", provenance: "2303-derived" },
  { label: "Business Category / Registration Date", value: "Primary · synthetic registration date", sourcePage: "Page 2", confidence: "High", provenance: "2303-derived" },
  { label: "Certification / Registering Authority", value: "Synthetic certification block · no signature retained", sourcePage: "Page 3", confidence: "High", provenance: "2303-derived" },
  { label: "Fiscal Year-End", value: "Not shown on supplied specimen", sourcePage: "Not on source", confidence: "Missing", provenance: "Not on source" },
  { label: "RDO / LTS", value: "Requires approved supplementary source", sourcePage: "Not on source", confidence: "Missing", provenance: "Not on source" },
  { label: "eFPS Group", value: "Not shown on supplied specimen", sourcePage: "Not on source", confidence: "Missing", provenance: "Not on source" },
];

const activeAuthority: FixtureAuthority = {
  id: "authority-peza-01",
  authority: "PEZA",
  reference: "Synthetic registration reference",
  status: "Active",
  effectiveFrom: "Synthetic effective date",
  entitlement: "Operational entitlement context recorded; tax treatment not inferred here.",
  source: "Approved registration source · synthetic",
};

function profileWithUnit(profile: FixtureTaxProfile, name: string, type: FixtureRegistrationUnit["type"]) {
  return { name, type, profile };
}

export const fixtureClients: FixtureClient[] = [
  {
    id: "fixture-client-01",
    name: "Lakeshore Apparel Services (synthetic)",
    entitySummary: "1 taxpayer entity · 1 head office",
    profileSummary: "Active profile · 2303 structure reviewed",
    clientGroup: "Lakeshore Holdings (synthetic)",
    scope: "Tower North",
    assignment: { preparer: fixtureTeamMemberName("org-c1-team-lead"), checker: fixtureTeamMemberName("org-c1-junior-associate"), reviewer: fixtureTeamMemberName("org-c1-leader"), tower: "Tower North", cluster: "Barangay Atilano", effectiveFrom: "Current assignment" },
    entities: [{
      name: "Lakeshore Apparel Manufacturing Inc. (synthetic)",
      profile: {
        registeredTaxpayerName: "Lakeshore Apparel Manufacturing Inc. (synthetic)", tinDisplay: "000-000-000-000", branchCode: "000", rdoOrLts: "Requires approved source", entityType: "Synthetic corporation", registeredAddress: "Synthetic industrial address · Laguna", lineOfBusiness: "Synthetic apparel manufacturing", registrationEffective: "Synthetic date · 2022", registrationStatus: "Pending validation", registeredActivities: "Synthetic manufacturing activity", tradeName: "Lakeshore Apparel (synthetic)", filingChannel: "eFPS", filingContext: "eFPS filing · synthetic setup", eFPSGroup: "Synthetic eFPS group", registeredTaxTypes: ["Income Tax · illustrative", "Value Added Tax · illustrative", "Withholding Tax · illustrative"], fiscalYearEnd: "Requires approved setup", booksType: "Loose-leaf", invoicing: "Loose-leaf receipts · synthetic permit context", paymentRoute: "TMF Pays", weight: 4, weightLabel: "Heavy", weightNote: "Multiple registration and authority touchpoints.", sourceWeightClassification: "Heavy", sourceFinalWeight: 4, fixtureSource: "source_weighted_portfolio", enateSetup: "Yes", profileState: "Ready for validation", sourceLabel: "Sanitized BIR Form 2303 structural fixture", sourceKind: "2303-derived", lastValidated: undefined, validator: undefined, authorities: [activeAuthority], auditExposures: [], attention: ["Tax Profile validation required before activation", "RDO/LTS requires approved supplementary source", "Fiscal year-end requires approved setup"], extractionFields: sanitized2303Fields,
      },
      units: [],
    }],
  },
  {
    id: "fixture-client-04",
    name: "Northstar Services Taxpayer (synthetic)",
    entitySummary: "1 taxpayer entity · 1 head office",
    profileSummary: "Active profile · open audit context",
    clientGroup: "Northstar Group (synthetic)",
    scope: "Tower North",
    assignment: { preparer: fixtureTeamMemberName("org-c1-senior-associate"), checker: fixtureTeamMemberName("org-c1-junior-associate"), reviewer: fixtureTeamMemberName("org-c1-leader"), tower: "Tower North", cluster: "Barangay Atilano", effectiveFrom: "Current assignment" },
    entities: [{
      name: "Northstar Services Taxpayer (synthetic)",
      profile: { registeredTaxpayerName: "Northstar Services Taxpayer (synthetic)", tinDisplay: "000-000-000-202", branchCode: "000", rdoOrLts: "Illustrative RDO/LTS", entityType: "Synthetic corporation", registeredAddress: "Synthetic registered address · Central district", lineOfBusiness: "Illustrative services activity", registrationEffective: "Synthetic effective date", registrationStatus: "Active · synthetic", registeredActivities: "Illustrative services activity", tradeName: "Northstar Services (synthetic)", filingChannel: "eBIRForms", filingContext: "Electronic filing · synthetic setup", registeredTaxTypes: ["Income Tax · illustrative"], fiscalYearEnd: "Calendar year · illustrative", booksType: "Manual", invoicing: "Registration detail on file · synthetic", paymentRoute: "Client Pays", weight: 2, weightLabel: "Light", sourceWeightClassification: "Light", sourceFinalWeight: 2, fixtureSource: "source_weighted_portfolio", enateSetup: "No", profileState: "Active", sourceLabel: "Approved registration source · synthetic", sourceKind: "approved registration source", lastValidated: "Synthetic validation date", validator: "Tax Control · synthetic", authorities: [], auditExposures: [{ id: "audit-01", taxableYear: "2024", matter: "BIR audit exposure", status: "Open", asOf: "Synthetic as-of date", context: "High-level exposure context only.", source: "Approved audit source · synthetic" }, { id: "audit-02", taxableYear: "2023", matter: "BIR assessment context", status: "Under review", asOf: "Synthetic as-of date", context: "Technical case details are outside this profile.", source: "Approved audit source · synthetic" }], attention: [],
      },
      units: [],
    }],
  },
  {
    id: "fixture-client-02",
    name: "Harborline Services (synthetic)",
    entitySummary: "1 taxpayer entity · 1 head office",
    profileSummary: "Ready for validation · attention required",
    scope: "Tower Central",
    assignment: { preparer: fixtureTeamMemberName("org-c2-senior-associate"), checker: fixtureTeamMemberName("org-c2-junior-associate"), reviewer: fixtureTeamMemberName("org-c2-leader"), tower: "Tower Central", cluster: "Barangay Beato", effectiveFrom: "Current assignment" },
    entities: [{
      name: "Harborline Taxpayer (synthetic)",
      profile: { registeredTaxpayerName: "Harborline Taxpayer (synthetic)", tinDisplay: "000-000-000-303", branchCode: "000", rdoOrLts: "Needs review", entityType: "Synthetic corporation", registeredAddress: "Synthetic registered address · Central district", lineOfBusiness: "Illustrative services activity", registrationEffective: "Needs source review", registrationStatus: "Pending validation", registeredActivities: "Review required", tradeName: "Harborline (synthetic)", filingChannel: "eFPS", filingContext: "Channel extracted; group unresolved", eFPSGroup: "Needs review", registeredTaxTypes: ["Income Tax · illustrative", "Withholding Tax · illustrative"], fiscalYearEnd: undefined, booksType: "Not configured", invoicing: "Not configured", paymentRoute: "Not configured", weight: 3, weightLabel: "Medium", sourceWeightClassification: "Moderate", sourceFinalWeight: 3, fixtureSource: "source_weighted_portfolio", enateSetup: "Unknown", profileState: "Ready for validation", sourceLabel: "Sanitized 2303 review fixture", sourceKind: "2303-derived", authorities: [], auditExposures: [], attention: ["RDO/LTS missing", "Fiscal year-end missing", "Payment route missing", "eNATE setup unknown"], extractionFields: sanitized2303Fields.map((field) => field.label === "Tax Type" ? { ...field, confidence: "Review required" as const } : field),
      },
      units: [],
    }],
  },
  {
    id: "fixture-client-03",
    name: "Cedarfield Holdings (synthetic)",
    entitySummary: "1 taxpayer entity · 2 registration units",
    profileSummary: "Active profile · multiple-unit edge case",
    scope: "Tower South",
    assignment: { preparer: fixtureTeamMemberName("org-c3-senior-associate"), checker: fixtureTeamMemberName("org-c3-junior-associate"), reviewer: fixtureTeamMemberName("org-c3-leader"), tower: "Tower South", cluster: "Barangay de Vera", effectiveFrom: "Current assignment" },
    entities: [{
      name: "Cedarfield Taxpayer (synthetic)",
      profile: { registeredTaxpayerName: "Cedarfield Taxpayer (synthetic)", tinDisplay: "000-000-000-404", branchCode: "000", rdoOrLts: "Illustrative RDO/LTS", entityType: "Synthetic corporation", registeredAddress: "Synthetic registered address · South district", lineOfBusiness: "Illustrative holding activity", registrationEffective: "Synthetic effective date", registrationStatus: "Active · synthetic", registeredActivities: "Illustrative holding activity", tradeName: "Cedarfield (synthetic)", filingChannel: "eFPS", filingContext: "Electronic filing · synthetic setup", registeredTaxTypes: ["Value Added Tax · illustrative"], fiscalYearEnd: "Calendar year · illustrative", booksType: "CAS/CBA · illustrative", invoicing: "Synthetic invoicing registration context", paymentRoute: "Client Pays", weight: 3, weightLabel: "Medium", sourceWeightClassification: "Moderate", sourceFinalWeight: 3, fixtureSource: "source_weighted_portfolio", enateSetup: "No", profileState: "Active", sourceLabel: "Approved registration source · synthetic", sourceKind: "approved registration source", authorities: [], auditExposures: [], attention: [],
      },
      units: [],
    }],
  },
  {
    id: "fixture-client-05",
    name: "Northstar Services Support (synthetic)",
    entitySummary: "1 taxpayer entity · 1 head office",
    profileSummary: "Active profile · sister company",
    clientGroup: "Northstar Group (synthetic)",
    scope: "Tower Central",
    assignment: { preparer: fixtureTeamMemberName("org-c2-team-lead"), checker: fixtureTeamMemberName("org-c2-junior-associate"), reviewer: fixtureTeamMemberName("org-c2-leader"), tower: "Tower Central", cluster: "Barangay Beato", effectiveFrom: "Current assignment" },
    entities: [{
      name: "Northstar Services Support Inc. (synthetic)",
      profile: { registeredTaxpayerName: "Northstar Services Support Inc. (synthetic)", tinDisplay: "000-000-000-505", branchCode: "000", rdoOrLts: "Illustrative LTS context", entityType: "Synthetic corporation", registeredAddress: "Synthetic registered address · Manila district", lineOfBusiness: "Illustrative support services", registrationEffective: "Synthetic effective date", registrationStatus: "Active · synthetic", registeredActivities: "Illustrative support services", tradeName: "Northstar Support (synthetic)", filingChannel: "eFPS", filingContext: "Electronic filing · synthetic setup", registeredTaxTypes: ["Withholding Tax · illustrative"], fiscalYearEnd: "Calendar year · illustrative", booksType: "Loose-leaf", invoicing: "Synthetic invoicing context", paymentRoute: "TMF Pays", weight: 1, weightLabel: "Super Light", sourceWeightClassification: "Super Light", sourceFinalWeight: 1, fixtureSource: "source_weighted_portfolio", enateSetup: "Yes", profileState: "Active", sourceLabel: "Manual baseline · approved synthetic source", sourceKind: "manual validation", authorities: [], auditExposures: [], attention: [],
      },
      units: [],
    }],
  },
  {
    id: "fixture-client-06",
    name: "Cedarfield Operations (synthetic)",
    entitySummary: "1 taxpayer entity · 1 head office",
    profileSummary: "Setup incomplete · assignment conflict",
    clientGroup: "Cedarfield Group (synthetic)",
    scope: "Tower South",
    assignment: { preparer: "Unassigned", checker: fixtureTeamMemberName("org-c3-senior-supervisor"), reviewer: fixtureTeamMemberName("org-c3-senior-supervisor"), tower: "Tower South", cluster: "Barangay de Vera", effectiveFrom: "Pending setup" },
    entities: [{
      name: "Cedarfield Operations Inc. (synthetic)",
      profile: { registeredTaxpayerName: "Cedarfield Operations Inc. (synthetic)", tinDisplay: "000-000-000-606", branchCode: "000", rdoOrLts: "Illustrative RDO/LTS", entityType: "Synthetic corporation", registeredAddress: "Synthetic registered address · South district", lineOfBusiness: "Illustrative operations activity", registrationEffective: "Needs source review", registrationStatus: "Pending validation", registeredActivities: "Review required", tradeName: "Cedarfield Operations (synthetic)", filingChannel: "Not configured", filingContext: "Needs setup", registeredTaxTypes: ["Requires review"], fiscalYearEnd: undefined, booksType: "Not configured", invoicing: "Not configured", paymentRoute: "Client Pays", weight: 5, weightLabel: "Super Heavy", weightNote: "Setup fixture only.", sourceWeightClassification: "Extremely Heavy", sourceFinalWeight: 5, fixtureSource: "source_weighted_portfolio", enateSetup: "Unknown", profileState: "Setup incomplete", sourceLabel: "Manual baseline · synthetic", sourceKind: "manual validation", authorities: [], auditExposures: [], attention: ["Assignment incomplete", "Checker and Reviewer conflict", "Filing channel missing", "eNATE setup unknown"],
      },
      units: [],
    }],
  },
];

for (const client of fixtureClients) {
  for (const entity of client.entities) {
    if (entity.units.length === 0) {
      entity.units.push(profileWithUnit(entity.profile, "Head Office", "Head Office"));
    }
    if (client.id === "fixture-client-03") {
      entity.units.push(profileWithUnit({ ...entity.profile, branchCode: "001", registeredAddress: "Synthetic branch address · South district", lineOfBusiness: "Illustrative operations activity" }, "South Operations Branch", "Branch"));
    }
  }
}

/**
 * Reconciled source population supplied for the portfolio pressure test.
 * Classification and numeric source weight are deliberately separate facts.
 */
export const portfolioWeightReconciliationTarget = {
  "Extremely Heavy": { count: 12, aggregateFinalWeight: 55 },
  Heavy: { count: 4, aggregateFinalWeight: 16 },
  Moderate: { count: 17, aggregateFinalWeight: 51 },
  Light: { count: 29, aggregateFinalWeight: 58 },
  "Super Light": { count: 48, aggregateFinalWeight: 45 },
} as const satisfies Record<FixtureSourceWeightClassification, { count: number; aggregateFinalWeight: number }>;

const generatedPortfolioNamePrefixes = [
  "Cresthaven", "Silverline", "Northbridge", "Mariveles", "Eastvale", "Pinebridge", "Aurelia", "Westhaven",
  "Brightwater", "Stonecrest", "Clearpoint", "Highland", "Blueharbor", "Greenfield", "Redwood", "Larkspur",
  "Meadowgate", "Summitvale", "Goldenstrand", "Ironwood", "Rivermark", "Fairview", "Seabrook", "Willowcrest",
] as const;

const generatedPortfolioIndustries = [
  "Consumer Products", "Logistics Philippines", "Business Services", "Industrial Components", "Food Distribution",
  "Digital Systems", "Property Services", "Renewable Equipment",
] as const;

const generatedPortfolioLegalSuffixes = ["Inc.", "Corp.", "Holdings Inc."] as const;

const generatedPortfolioGroups = [
  "Cresthaven Group", "Silverline Group", "Northbridge Group", "Mariveles Group", "Eastvale Group", "Pinebridge Group",
  "Aurelia Group", "Westhaven Group", "Brightwater Group", "Stonecrest Group", "Clearpoint Group", "Highland Group",
] as const;

const portfolioTowers: readonly FixtureScope[] = ["Tower North", "Tower Central", "Tower South"];
const portfolioClusters: Record<FixtureScope, string> = {
  "Tower North": "Barangay Atilano",
  "Tower Central": "Barangay Beato",
  "Tower South": "Barangay de Vera",
};

const sourceWeightClasses = Object.keys(portfolioWeightReconciliationTarget) as FixtureSourceWeightClassification[];

function numericWeightsForClass(count: number, total: number, preferred: number): number[] {
  const values = Array.from({ length: count }, () => preferred);
  let difference = values.reduce((sum, value) => sum + value, 0) - total;
  let index = values.length - 1;

  while (difference > 0 && index >= 0) {
    const reduction = Math.min(difference, values[index]);
    values[index] -= reduction;
    difference -= reduction;
    index -= 1;
  }

  index = values.length - 1;
  while (difference < 0 && index >= 0) {
    const increase = Math.min(-difference, 5 - values[index]);
    values[index] += increase;
    difference += increase;
    index -= 1;
  }

  if (difference !== 0) throw new Error("Unable to construct the requested source weight distribution.");
  return values;
}

function generatedSourcePlans() {
  return sourceWeightClasses.flatMap((classification) => {
    const existing = fixtureClients.filter((client) => client.entities[0]?.profile.sourceWeightClassification === classification);
    const target = portfolioWeightReconciliationTarget[classification];
    const count = target.count - existing.length;
    const existingTotal = existing.reduce((sum, client) => sum + (client.entities[0]?.profile.sourceFinalWeight ?? 0), 0);
    const total = target.aggregateFinalWeight - existingTotal;
    const preferred = classification === "Extremely Heavy" ? 5 : classification === "Heavy" ? 4 : classification === "Moderate" ? 3 : classification === "Light" ? 2 : 1;

    return numericWeightsForClass(count, total, preferred).map((weight) => ({ classification, weight }));
  });
}

const generatedSourcePlansForPortfolio = generatedSourcePlans();

function generatedPortfolioProfile(
  clientIndex: number,
  registeredName: string,
  classification: FixtureSourceWeightClassification | undefined,
  sourceFinalWeight: number | null,
  fixtureSource: FixtureSource,
): FixtureTaxProfile {
  const needs2303Review = fixtureSource === "source_weighted_portfolio" && clientIndex % 16 === 0;
  const needsRdoSource = fixtureSource === "source_weighted_portfolio" && clientIndex % 17 === 2;
  const missingFiscalYear = fixtureSource === "source_weighted_portfolio" && clientIndex % 13 === 4;
  const missingFilingSetup = fixtureSource === "source_weighted_portfolio" && clientIndex % 19 === 7;
  const eFPS = clientIndex % 3 === 0;
  const incompleteEFPSContext = eFPS && clientIndex % 11 === 3;
  const paymentRoute: FixtureTaxProfile["paymentRoute"] = fixtureSource === "synthetic_portfolio_test"
    ? "Not configured"
    : clientIndex % 5 === 0 ? "TMF Pays" : clientIndex % 5 === 1 ? "Not configured" : "Client Pays";
  const filingChannel = missingFilingSetup ? "Not configured" : eFPS ? "eFPS" : clientIndex % 3 === 1 ? "eBIRForms" : "eSubmission";
  const profileState: FixtureTaxProfile["profileState"] = fixtureSource === "synthetic_portfolio_test"
    ? "Setup incomplete"
    : needs2303Review || needsRdoSource ? "Ready for validation" : missingFilingSetup || missingFiscalYear ? "Setup incomplete" : "Active";
  const attention: string[] = [];

  if (needs2303Review) attention.push("Source review pending; no binary document is stored");
  if (needsRdoSource) attention.push("RDO/LTS requires approved supplementary source");
  if (missingFiscalYear) attention.push("Fiscal year-end missing");
  if (missingFilingSetup) attention.push("Filing channel missing");
  if (incompleteEFPSContext) attention.push("eFPS context requires source review");
  if (paymentRoute === "TMF Pays" && clientIndex % 29 === 0) attention.push("Funding confirmation required before TMF payment");

  const hasAuditExposure = fixtureSource === "source_weighted_portfolio" && clientIndex % 23 === 3;
  const authorities: FixtureAuthority[] = [];
  if (fixtureSource === "source_weighted_portfolio" && clientIndex % 29 === 6) {
    authorities.push({ id: `authority-fixture-${clientIndex}`, authority: "PEZA", reference: "Synthetic registration reference", status: "Active", effectiveFrom: "Synthetic effective date", entitlement: "Operational authority context recorded; tax treatment is not inferred.", source: "Approved registration source · synthetic" });
  } else if (fixtureSource === "source_weighted_portfolio" && clientIndex % 31 === 9) {
    authorities.push({ id: `authority-fixture-${clientIndex}`, authority: "BOI", reference: "Synthetic registration reference", status: "Review due", effectiveFrom: "Synthetic effective date", entitlement: "Authority context requires human review; tax treatment is not inferred.", source: "Approved registration source · synthetic" });
  } else if (fixtureSource === "source_weighted_portfolio" && clientIndex % 37 === 12) {
    authorities.push({ id: `authority-fixture-${clientIndex}`, authority: "Other authority context", reference: "Synthetic registration reference", status: "Review due", effectiveFrom: "Synthetic effective date", entitlement: "Context recorded without an inferred exemption or tax treatment.", source: "Approved registration source · synthetic" });
  }

  if (hasAuditExposure) attention.push("Open BIR audit exposure recorded");

  const sourceKind: FixtureTaxProfile["sourceKind"] = needs2303Review ? "2303-derived" : clientIndex % 4 === 0 ? "approved registration source" : "manual validation";
  const extractionFields = needs2303Review ? sanitized2303Fields.map((field) => ({ ...field, confidence: field.label === "RDO / LTS" ? "Missing" as const : field.confidence })) : undefined;
  const syntheticTinSeed = String(100000000 + clientIndex * 7919).padStart(9, "0").slice(-9);

  return {
    registeredTaxpayerName: registeredName,
    tinDisplay: `${syntheticTinSeed.slice(0, 3)}-${syntheticTinSeed.slice(3, 6)}-${syntheticTinSeed.slice(6, 9)}-000`,
    branchCode: "000",
    rdoOrLts: needsRdoSource ? "Requires approved supplementary source" : clientIndex % 4 === 0 ? "Illustrative RDO/LTS context" : clientIndex % 4 === 1 ? "Illustrative LTS context" : "RDO/LTS context · source verification pending",
    entityType: "Synthetic corporation",
    registeredAddress: `Synthetic registered address · ${clientIndex % 2 === 0 ? "Metro Manila" : clientIndex % 3 === 0 ? "Cavite" : "Laguna"}`,
    lineOfBusiness: `${generatedPortfolioIndustries[clientIndex % generatedPortfolioIndustries.length]} · illustrative`,
    registrationEffective: "Synthetic effective date",
    registrationStatus: profileState === "Active" ? "Active · synthetic" : "Pending validation",
    registeredActivities: "Illustrative activity; approved tax treatment not inferred",
    tradeName: registeredName.replace(/ (Inc\.|Corp\.|Philippines Inc\.|Holdings Inc\.)$/, ""),
    filingChannel,
    filingContext: missingFilingSetup ? "Needs setup" : `${filingChannel} context · row-level applicability remains unresolved`,
    eFPSGroup: eFPS ? incompleteEFPSContext ? "Needs review" : "eFPS group · source configuration pending" : undefined,
    registeredTaxTypes: [
      ["Income Tax · illustrative"],
      ["Value Added Tax · illustrative", "Withholding Tax · illustrative"],
      ["Withholding Tax · illustrative"],
      ["Income Tax · illustrative", "Value Added Tax · illustrative"],
    ][clientIndex % 4],
    fiscalYearEnd: missingFiscalYear ? undefined : clientIndex % 5 === 0 ? "Fiscal year-end · source context" : "Calendar year · source context",
    booksType: clientIndex % 3 === 0 ? "Loose-leaf · illustrative" : clientIndex % 3 === 1 ? "Manual · illustrative" : "Not configured",
    invoicing: clientIndex % 4 === 0 ? "Registration context on file · synthetic" : "Not configured",
    paymentRoute,
    weight: sourceFinalWeight ?? 0,
    weightLabel: sourceFinalWeight === null ? "Excluded from source reconciliation" : sourceFinalWeight === 0 ? "No numeric source weight" : `${sourceFinalWeight} · ${classification}`,
    weightNote: sourceFinalWeight === null ? "Synthetic portfolio-test record; no approved numeric weight." : classification === "Super Light" && sourceFinalWeight === 0 ? "Source classification retained; supplied numeric total includes zero-weight records." : undefined,
    sourceWeightClassification: classification,
    sourceFinalWeight,
    fixtureSource,
    enateSetup: fixtureSource === "synthetic_portfolio_test" ? "Unknown" : clientIndex % 3 === 0 ? "Yes" : clientIndex % 3 === 1 ? "No" : "Unknown",
    profileState,
    sourceLabel: needs2303Review ? "Sanitized 2303 review fixture · no binary document stored" : "Sanitized structured registration baseline · source document not stored",
    sourceKind,
    lastValidated: profileState === "Active" ? "Synthetic validation date" : undefined,
    validator: profileState === "Active" ? "Tax Control · synthetic" : undefined,
    authorities,
    auditExposures: hasAuditExposure ? [{ id: `audit-fixture-${clientIndex}`, taxableYear: "Synthetic tax year", matter: "BIR audit exposure", status: "Open", asOf: "Synthetic as-of date", context: "High-level exposure context only; technical case details are outside this profile.", source: "Approved audit source · synthetic" }] : [],
    attention,
    extractionFields,
  };
}

function generatedPortfolioClient(clientIndex: number, plan?: { classification: FixtureSourceWeightClassification; weight: number }): FixtureClient {
  const prefix = generatedPortfolioNamePrefixes[clientIndex % generatedPortfolioNamePrefixes.length];
  const industry = generatedPortfolioIndustries[Math.floor(clientIndex / generatedPortfolioNamePrefixes.length) % generatedPortfolioIndustries.length];
  const suffix = generatedPortfolioLegalSuffixes[clientIndex % generatedPortfolioLegalSuffixes.length];
  const registeredName = plan ? `${prefix} ${industry} ${suffix}` : clientIndex === 1001 ? "Harborview Portfolio Services Inc." : "Southridge Portfolio Components Corp.";
  const scope = portfolioTowers[clientIndex % portfolioTowers.length];
  const profile = generatedPortfolioProfile(clientIndex, registeredName, plan?.classification, plan?.weight ?? null, plan ? "source_weighted_portfolio" : "synthetic_portfolio_test");
  const units: FixtureRegistrationUnit[] = [{ name: "Head Office", type: "Head Office", profile }];
  if (plan && clientIndex % 9 === 0) {
    units.push({ name: "Operations Branch", type: "Branch", profile: { ...profile, branchCode: "001", registeredAddress: "Synthetic branch address · same taxpayer context" } });
  }

  return {
    id: plan ? `fixture-client-${String(clientIndex + 7).padStart(3, "0")}` : `fixture-portfolio-test-${clientIndex}`,
    name: registeredName.replace(/ (Inc\.|Corp\.|Philippines Inc\.|Holdings Inc\.)$/, ""),
    entitySummary: `1 taxpayer entity · ${units.length} ${units.length === 1 ? "head office" : "registration units"}`,
    profileSummary: profile.profileState === "Active" ? "Active profile · sanitized portfolio test" : `${profile.profileState} · attention required`,
    clientGroup: generatedPortfolioGroups[clientIndex % generatedPortfolioGroups.length],
    scope,
    assignment: { preparer: "Unassigned", checker: "Unassigned", reviewer: "Unassigned", tower: scope, cluster: portfolioClusters[scope], effectiveFrom: "Current assignment" },
    entities: [{ name: registeredName, profile, units }],
  };
}

const generatedPortfolioClients = [
  ...generatedSourcePlansForPortfolio.map((plan, index) => generatedPortfolioClient(index + 1, plan)),
  generatedPortfolioClient(1001),
  generatedPortfolioClient(1002),
];

fixtureClients.push(...generatedPortfolioClients);

type AssignmentRole = "preparer" | "checker" | "reviewer";
const portfolioAssignmentMembers = fixtureOrgDirectoryMembers.filter((member) => member.active && member.tower !== "All A&T" && member.operatingModel === "DELIVERY");
const assignmentRolePools: Record<AssignmentRole, readonly FixtureTeamMember[]> = {
  preparer: portfolioAssignmentMembers.filter((member) => member.role === "Team Member"),
  checker: portfolioAssignmentMembers.filter((member) => member.role === "Team Member" || member.role === "HOD / Leader"),
  reviewer: portfolioAssignmentMembers.filter((member) => member.role === "HOD / Leader"),
};

function assignPortfolioClients() {
  const roleLoads: Record<AssignmentRole, Map<string, { count: number; weight: number }>> = {
    preparer: new Map(),
    checker: new Map(),
    reviewer: new Map(),
  };

  for (const role of Object.keys(assignmentRolePools) as AssignmentRole[]) {
    roleLoads[role] = new Map(assignmentRolePools[role].map((member) => [member.name, { count: 0, weight: 0 }]));
  }

  const clientsByWeight = [...fixtureClients].sort((left, right) => {
    const weightDifference = (right.entities[0]?.profile.sourceFinalWeight ?? 0) - (left.entities[0]?.profile.sourceFinalWeight ?? 0);
    return weightDifference || left.id.localeCompare(right.id);
  });

  function choose(role: AssignmentRole, client: FixtureClient, excluded: readonly string[]) {
    const available = assignmentRolePools[role].filter((member) => !excluded.includes(member.name));
    const scoped = available.filter((member) => member.tower === client.scope);
    const nonCrossPortfolio = available.filter((member) => member.tower !== "All A&T");
    const candidates = scoped.length > 0 ? scoped : nonCrossPortfolio.length > 0 ? nonCrossPortfolio : available;
    return [...candidates].sort((left, right) => {
      const leftLoad = roleLoads[role].get(left.name)!;
      const rightLoad = roleLoads[role].get(right.name)!;
      return leftLoad.weight - rightLoad.weight || leftLoad.count - rightLoad.count || left.id.localeCompare(right.id);
    })[0]?.name ?? "Unassigned";
  }

  for (const client of clientsByWeight) {
    const weight = client.entities[0]?.profile.sourceFinalWeight ?? 0;
    const preparer = choose("preparer", client, []);
    const checker = choose("checker", client, [preparer]);
    const reviewer = choose("reviewer", client, [preparer, checker]);
    client.assignment = { preparer, checker, reviewer, tower: client.scope, cluster: portfolioClusters[client.scope], effectiveFrom: "Current assignment" };

    for (const [role, member] of [["preparer", preparer], ["checker", checker], ["reviewer", reviewer]] as const) {
      const load = roleLoads[role].get(member);
      if (load) {
        load.count += 1;
        load.weight += weight;
      }
    }
  }

  const generatedAssignments = fixtureClients.filter((client) => client.entities[0]?.profile.fixtureSource !== "synthetic_portfolio_test");
  const overrides = [
    { index: 9, role: "preparer" as const },
    { index: 28, role: "checker" as const },
    { index: 52, role: "reviewer" as const },
    { index: 76, role: "conflict" as const },
  ];

  for (const override of overrides) {
    const client = generatedAssignments[override.index];
    if (!client) continue;
    if (override.role === "preparer") client.assignment.preparer = "Unassigned";
    if (override.role === "checker") client.assignment.checker = "Unassigned";
    if (override.role === "reviewer") client.assignment.reviewer = "Unassigned";
    if (override.role === "conflict") client.assignment.reviewer = client.assignment.checker;
    const profile = client.entities[0].profile;
    profile.attention = [...profile.attention, override.role === "conflict" ? "Checker and Reviewer conflict" : `${override.role[0].toUpperCase()}${override.role.slice(1)} assignment missing`];
  }

  const legacyGapClient = fixtureClients.find((client) => client.id === "fixture-client-06");
  if (legacyGapClient) {
    legacyGapClient.assignment.preparer = "Unassigned";
    legacyGapClient.assignment.reviewer = legacyGapClient.assignment.checker;
  }
}

assignPortfolioClients();

/**
 * Controlled Team fixture boundary for specialist work. This is intentionally
 * not a Tax Audit workflow: it only proves that specialist cases can be
 * surfaced beside, without mutating, recurring portfolio ownership.
 */
export type FixtureSpecialistCase = {
  id: string;
  caseType: "Tax Audit";
  taxpayerClientId: string;
  assigneeMemberIds: readonly string[];
  accountableMemberId: string;
  status: "Open" | "Under review";
  attention: FixtureStatus;
  attentionLabel: string;
  deadlineLabel: string;
  statusReason: string;
};

export const fixtureSpecialistCases: readonly FixtureSpecialistCase[] = [
  {
    id: "specialist-case-01",
    caseType: "Tax Audit",
    taxpayerClientId: "fixture-client-02",
    assigneeMemberIds: ["org-c2-team-lead", "member-tax-control"],
    accountableMemberId: "org-c2-team-lead",
    status: "Under review",
    attention: "AMBER",
    attentionLabel: "Control attention",
    deadlineLabel: "Synthetic control target · this week",
    statusReason: "Controlled specialist-case fixture; the Tax Audit workflow is outside this Team slice.",
  },
  {
    id: "specialist-case-02",
    caseType: "Tax Audit",
    taxpayerClientId: "fixture-client-04",
    assigneeMemberIds: ["org-c2-team-lead"],
    accountableMemberId: "org-c2-team-lead",
    status: "Open",
    attention: "GREEN",
    attentionLabel: "Within current control range",
    deadlineLabel: "Synthetic control target · next review",
    statusReason: "Controlled specialist-case fixture; the Tax Audit workflow is outside this Team slice.",
  },
];

export type FixtureComplianceItem = {
  id: string;
  clientId: string;
  entityName: string;
  registrationUnitName: string;
  formLabel: string;
  frequency: string;
  period: string;
  serviceScope: "In TMF Scope" | "Out of TMF Scope";
  deadline: string;
  deadlineState: "configured" | "unresolved";
  statusLabel: string;
  status: FixtureStatus;
  owner: string;
  attentionKind?: "Blocker" | "RAG / Risk" | "Exception";
  workId?: string;
  componentSummary: { submission: string; payment: string; attachments: string; evidence: string };
  nextAction: string;
  statusReason: string;
};

export const fixtureCompliance: FixtureComplianceItem[] = [
  {
    id: "compliance-01",
    clientId: "fixture-client-01",
    entityName: "Lakeshore Apparel Manufacturing Inc. (synthetic)",
    registrationUnitName: "Head Office (synthetic)",
    formLabel: "1601-C · illustrative",
    frequency: "Recurring",
    period: "Sep 2026",
    serviceScope: "In TMF Scope",
    deadline: "Internal target · Today · 3:00 PM",
    deadlineState: "configured",
    statusLabel: "Awaiting client approval",
    status: "AMBER",
    owner: fixtureTeamMemberName("org-c1-team-lead"),
    attentionKind: "Blocker",
    workId: "work-01",
    componentSummary: { submission: "Ready after approval", payment: "Not applicable", attachments: "None indicated", evidence: "Pending after submission" },
    nextAction: "Follow up on client approval",
    statusReason: "Internal review is complete; client approval is still outstanding.",
  },
  {
    id: "compliance-02",
    clientId: "fixture-client-04",
    entityName: "Northstar Services Taxpayer (synthetic)",
    registrationUnitName: "Head Office (synthetic)",
    formLabel: "1702-RT · illustrative",
    frequency: "Annual",
    period: "FY 2026",
    serviceScope: "Out of TMF Scope",
    deadline: "Rule unresolved",
    deadlineState: "unresolved",
    statusLabel: "Expected · out of TMF scope",
    status: "UNRESOLVED",
    owner: "Tax Control",
    attentionKind: "Exception",
    componentSummary: { submission: "Informational only", payment: "Informational only", attachments: "Rule unresolved", evidence: "Not managed by TMF" },
    nextAction: "Confirm approved scope and deadline configuration",
    statusReason: "This out-of-scope return remains visible for reconciliation but does not create TMF delivery work.",
  },
  {
    id: "compliance-03",
    clientId: "fixture-client-02",
    entityName: "Harborline Taxpayer (synthetic)",
    registrationUnitName: "Head Office (synthetic)",
    formLabel: "2550Q · illustrative",
    frequency: "Recurring",
    period: "Sep 2026",
    serviceScope: "In TMF Scope",
    deadline: "Internal target · This week",
    deadlineState: "configured",
    statusLabel: "Evidence to verify",
    status: "RED",
    owner: fixtureTeamMemberName("org-c2-senior-supervisor"),
    attentionKind: "Exception",
    workId: "work-02",
    componentSummary: { submission: "Reported submitted", payment: "Awaiting confirmation", attachments: "None indicated", evidence: "Verification pending" },
    nextAction: "Verify the available submission evidence",
    statusReason: "A submission result has been reported, but control evidence is not verified.",
  },
  {
    id: "compliance-04",
    clientId: "fixture-client-03",
    entityName: "Cedarfield Taxpayer (synthetic)",
    registrationUnitName: "Head Office (synthetic)",
    formLabel: "1601-C · illustrative",
    frequency: "Recurring",
    period: "Sep 2026",
    serviceScope: "In TMF Scope",
    deadline: "Rule unresolved",
    deadlineState: "unresolved",
    statusLabel: "Ready for checking",
    status: "UNRESOLVED",
    owner: fixtureTeamMemberName("org-c3-senior-supervisor"),
    attentionKind: "Exception",
    workId: "work-03",
    componentSummary: { submission: "Preparation recorded", payment: "No payment assertion", attachments: "None indicated", evidence: "Not started" },
    nextAction: "Resolve timing configuration before relying on RAG",
    statusReason: "The work is ready for checking, but approved deadline content is intentionally unresolved in this fixture.",
  },
  {
    id: "compliance-05",
    clientId: "fixture-client-03",
    entityName: "Cedarfield Taxpayer (synthetic)",
    registrationUnitName: "South Operations Branch (synthetic)",
    formLabel: "2550Q · illustrative",
    frequency: "Recurring",
    period: "Sep 2026",
    serviceScope: "In TMF Scope",
    deadline: "Internal target · Tomorrow · 5:00 PM",
    deadlineState: "configured",
    statusLabel: "Preparation in progress",
    status: "GREEN",
    owner: fixtureTeamMemberName("org-c3-senior-supervisor"),
    componentSummary: { submission: "In preparation", payment: "Not applicable", attachments: "Pending review", evidence: "Not started" },
    nextAction: "Complete preparation and send for checking",
    statusReason: "This return belongs to a taxpayer with multiple registration units.",
  },
];

export type FixtureFilingHistory = {
  id: string;
  clientId: string;
  formLabel: string;
  period: string;
  statutoryDeadline: string;
  filingDate: string;
  filingResult: string;
  paymentState: string;
  evidenceState: string;
};

export const fixtureFilingHistory: FixtureFilingHistory[] = [
  {
    id: "filing-history-01",
    clientId: "fixture-client-01",
    formLabel: "1601-C · illustrative",
    period: "Aug 2026",
    statutoryDeadline: "Rule unresolved",
    filingDate: "Reported event · Aug 2026",
    filingResult: "Reported submitted",
    paymentState: "Not applicable",
    evidenceState: "Verified",
  },
  {
    id: "filing-history-02",
    clientId: "fixture-client-02",
    formLabel: "2550Q · illustrative",
    period: "Aug 2026",
    statutoryDeadline: "Rule unresolved",
    filingDate: "Reported event · Aug 2026",
    filingResult: "Reported submitted",
    paymentState: "Awaiting confirmation",
    evidenceState: "Verification pending",
  },
  {
    id: "filing-history-03",
    clientId: "fixture-client-03",
    formLabel: "2550Q · illustrative",
    period: "Jun 2026",
    statutoryDeadline: "Rule unresolved",
    filingDate: "Not recorded",
    filingResult: "Not recorded",
    paymentState: "Not applicable",
    evidenceState: "Not started",
  },
];

export type FixtureTeamHistory = {
  id: string;
  clientId: string;
  effectivePeriod: string;
  preparer: string;
  checker: string;
  reviewer: string;
  tower: string;
  cluster: string;
  reason: string;
};

export const fixtureTeamHistory: FixtureTeamHistory[] = [
  { id: "team-history-01", clientId: "fixture-client-01", effectivePeriod: "Current assignment", preparer: fixtureTeamMemberName("org-c1-team-lead"), checker: fixtureTeamMemberName("org-c1-junior-associate"), reviewer: fixtureTeamMemberName("org-c1-leader"), tower: "Tower North", cluster: "North Cluster", reason: "Current assignment" },
  { id: "team-history-02", clientId: "fixture-client-01", effectivePeriod: "Prior assignment", preparer: fixtureTeamMemberName("org-c1-leader"), checker: fixtureTeamMemberName("org-c1-senior-supervisor"), reviewer: fixtureTeamMemberName("org-c2-senior-supervisor"), tower: "Tower North", cluster: "North Cluster", reason: "Workload rebalance" },
  { id: "team-history-03", clientId: "fixture-client-02", effectivePeriod: "Current assignment", preparer: fixtureTeamMemberName("org-c2-team-lead"), checker: fixtureTeamMemberName("org-c2-junior-associate"), reviewer: fixtureTeamMemberName("org-c2-leader"), tower: "Tower Central", cluster: "Central Cluster", reason: "Current assignment" },
  { id: "team-history-04", clientId: "fixture-client-03", effectivePeriod: "Current assignment", preparer: fixtureTeamMemberName("org-c3-team-lead"), checker: fixtureTeamMemberName("org-c3-junior-associate"), reviewer: fixtureTeamMemberName("org-c3-leader"), tower: "Tower South", cluster: "South Cluster", reason: "Current assignment" },
  { id: "team-history-05", clientId: "fixture-client-04", effectivePeriod: "Current assignment", preparer: fixtureTeamMemberName("org-c1-leader"), checker: fixtureTeamMemberName("org-c1-senior-supervisor"), reviewer: fixtureTeamMemberName("org-c2-senior-supervisor"), tower: "Tower North", cluster: "North Cluster", reason: "Current assignment" },
];

for (const history of fixtureTeamHistory) {
  if (history.effectivePeriod !== "Current assignment") continue;
  const client = fixtureClients.find((item) => item.id === history.clientId);
  if (!client) continue;
  history.preparer = client.assignment.preparer;
  history.checker = client.assignment.checker;
  history.reviewer = client.assignment.reviewer;
  history.tower = client.assignment.tower;
  history.cluster = client.assignment.cluster;
}

export const fixtureHistory = [
  { id: "history-01", clientId: "fixture-client-01", label: "Source context prepared for validation", detail: "2303-derived registration context", date: "Recent" },
  { id: "history-02", clientId: "fixture-client-01", label: "Profile context recorded", detail: "Registration context retained for review", date: "Recent" },
  { id: "history-03", clientId: "fixture-client-01", label: "Baseline profile created", detail: "Initial setup record", date: "Setup" },
] as const;

export const fixtureWork: FixtureWorkItem[] = [
  {
    id: "work-01",
    clientId: "fixture-client-01",
    client: "Lakeshore Apparel Services (synthetic)",
    entity: "Lakeshore Apparel Manufacturing Inc. (synthetic)",
    registrationUnit: "Head Office (synthetic)",
    title: "Recurring compliance review",
    period: "Current period · synthetic",
    detail: "Waiting for client approval",
    stage: "CLIENT",
    nextAction: "Follow up on client approval",
    status: "AMBER",
    statusReason: "Internal review is complete; client approval is still outstanding.",
    deadline: "Today · 3:00 PM",
    deadlineType: "Client / service milestone",
    owner: fixtureTeamMemberName("org-c1-team-lead"),
    scope: "Tower North",
    steps: [
      { id: "prepare", label: "Preparation", state: "complete", detail: "Preparation and reconciliation recorded." },
      { id: "check", label: "Checking", state: "complete", detail: "Internal checking recorded." },
      { id: "review", label: "Review", state: "complete", detail: "Internal review recorded." },
      { id: "client-approval", label: "Client approval", state: "blocked", detail: "Approval is still outstanding before filing." },
      { id: "filing", label: "Filing / submission", state: "not-started", detail: "Not ready until client approval is received." },
      { id: "evidence", label: "Evidence / archiving", state: "not-started", detail: "Evidence is captured with the relevant action." },
    ],
    components: [
      { label: "Submission", state: "Not ready", detail: "Client approval gate is open." },
      { label: "Payment", state: "Not configured", detail: "Payment requirement is not shown in this fixture." },
      { label: "Evidence", state: "Not started", detail: "Evidence will follow the relevant action." },
    ],
    blocker: { category: "CLIENT APPROVAL", reason: "Client response is outstanding after internal review." },
  },
  {
    id: "work-02",
    clientId: "fixture-client-02",
    client: "Harborline Services (synthetic)",
    entity: "Harborline Taxpayer (synthetic)",
    registrationUnit: "Head Office (synthetic)",
    title: "Submission evidence check",
    period: "Current period · synthetic",
    detail: "Evidence needs verification",
    stage: "POST-FILING",
    nextAction: "Verify the available submission evidence",
    status: "RED",
    statusReason: "A submission result has been reported, but control evidence is not verified.",
    deadline: "Overdue · control milestone",
    deadlineType: "Control milestone",
    owner: fixtureTeamMemberName("org-c2-senior-supervisor"),
    scope: "Tower Central",
    steps: [
      { id: "prepare", label: "Preparation", state: "complete", detail: "Preparation record is retained." },
      { id: "check", label: "Checking", state: "complete", detail: "Checking record is retained." },
      { id: "review", label: "Review", state: "complete", detail: "Review record is retained." },
      { id: "client-approval", label: "Client approval", state: "complete", detail: "Client approval is recorded for the work item." },
      { id: "filing", label: "Filing / submission", state: "complete", detail: "A submission result was reported; acceptance is not inferred." },
      { id: "evidence", label: "Evidence / archiving", state: "current", detail: "Verify the available submission evidence." },
    ],
    components: [
      { label: "Submission", state: "Reported", detail: "Reported result is retained; acceptance remains unverified." },
      { label: "Payment", state: "Not shown", detail: "Payment is independent and is not established by this fixture." },
      { label: "Evidence", state: "Needs verification", detail: "Evidence is not yet verified." },
    ],
    returnedFrom: "Evidence check",
  },
  {
    id: "work-03",
    clientId: "fixture-client-03",
    client: "Cedarfield Holdings (synthetic)",
    entity: "Cedarfield Taxpayer (synthetic)",
    registrationUnit: "Head Office (synthetic)",
    title: "Annual review preparation",
    period: "Annual period · synthetic",
    detail: "Ready for checking",
    stage: "REVIEW",
    nextAction: "Open the checking queue",
    status: "GREEN",
    statusReason: "Preparation is recorded and the next internal control step is available.",
    deadline: "Tomorrow · 5:00 PM",
    deadlineType: "TMF internal target",
    owner: fixtureTeamMemberName("org-c3-senior-supervisor"),
    scope: "Tower South",
    steps: [
      { id: "prepare", label: "Preparation", state: "complete", detail: "Preparation is recorded and ready for checking." },
      { id: "check", label: "Checking", state: "current", detail: "Open the checking queue and complete the internal check." },
      { id: "review", label: "Review", state: "not-started", detail: "Review follows successful checking." },
      { id: "client-approval", label: "Client approval", state: "not-started", detail: "Client approval follows internal review." },
      { id: "filing", label: "Filing / submission", state: "not-started", detail: "Not ready until required gates are complete." },
      { id: "evidence", label: "Evidence / archiving", state: "not-started", detail: "Evidence follows the relevant action." },
    ],
    components: [
      { label: "Submission", state: "Not started", detail: "Required internal control gates are not complete." },
      { label: "Payment", state: "Not configured", detail: "Payment requirement is not shown in this fixture." },
      { label: "Evidence", state: "Not started", detail: "Evidence will follow the relevant action." },
    ],
  },
];

export type FixtureException = {
  id: string;
  kind: "Blocker" | "RAG / Risk" | "Exception";
  category: string;
  title: string;
  clientId: string;
  client: string;
  workId: string;
  detail: string;
  severity: FixtureStatus;
  aging: string;
  owner: string;
  nextAction: string;
};

export const fixtureExceptions: FixtureException[] = [
  {
    id: "exception-01",
    kind: "Blocker",
    category: "CLIENT APPROVAL",
    title: "Approval is holding the next step",
    clientId: "fixture-client-01",
    client: "Lakeshore Apparel Services (synthetic)",
    workId: "work-01",
    detail: "The internal review is complete; client response is outstanding.",
    severity: "AMBER",
    aging: "Aging: 1 day",
    owner: fixtureTeamMemberName("org-c1-team-lead"),
    nextAction: "Follow up on client approval",
  },
  {
    id: "exception-02",
    kind: "Exception",
    category: "EVIDENCE",
    title: "Control completion is still open",
    clientId: "fixture-client-02",
    client: "Harborline Services (synthetic)",
    workId: "work-02",
    detail: "A reported submission result exists, but evidence verification is pending.",
    severity: "RED",
    aging: "Open: 2 days",
    owner: fixtureTeamMemberName("org-c2-senior-supervisor"),
    nextAction: "Verify the available submission evidence",
  },
  {
    id: "exception-03",
    kind: "Exception",
    category: "CONFIGURATION",
    title: "Timing cannot be shown yet",
    clientId: "fixture-client-03",
    client: "Cedarfield Holdings (synthetic)",
    workId: "work-03",
    detail: "The timing rule required for this item is unresolved.",
    severity: "UNRESOLVED",
    aging: "Needs domain review",
    owner: "Tax Control",
    nextAction: "Resolve the configuration exception",
  },
  {
    id: "exception-04",
    kind: "RAG / Risk",
    category: "TIMING EXPOSURE",
    title: "Internal target is at risk",
    clientId: "fixture-client-01",
    client: "Lakeshore Apparel Services (synthetic)",
    workId: "work-01",
    detail: "The approved service milestone is approaching while client approval is outstanding.",
    severity: "AMBER",
    aging: "Target today",
    owner: fixtureTeamMemberName("org-c1-team-lead"),
    nextAction: "Review the client dependency",
  },
];

export const fixtureCalendar = [
  {
    id: "calendar-01",
    calendarDate: "2026-10-05",
    dateGroup: "Today",
    date: "Today · 3:00 PM",
    milestone: "Client approval target",
    returnKey: "WHT-1601EQ-2026-09",
    returnLabel: "WHT · 1601EQ",
    period: "September 2026",
    statutoryDeadline: "Rule unresolved",
    internalDeadline: "Today · 3:00 PM",
    serviceMilestone: "Awaiting approval",
    client: "Lakeshore Apparel Services",
    clientId: "fixture-client-01",
    scope: "Tower North" as FixtureScope,
    workId: "work-01",
    type: "Client / service milestone",
    status: "AMBER" as FixtureStatus,
    detail: "Approval is still outstanding before the next valid filing action.",
  },
  {
    id: "calendar-02",
    calendarDate: "2026-10-06",
    dateGroup: "Tomorrow",
    date: "Tomorrow · 5:00 PM",
    milestone: "Internal review target",
    returnKey: "CIT-ANNUAL-2026",
    returnLabel: "CIT · Annual return",
    period: "FY 2026",
    statutoryDeadline: "Rule unresolved",
    internalDeadline: "Tomorrow · 5:00 PM",
    serviceMilestone: "Ready for checking",
    client: "Cedarfield Holdings",
    clientId: "fixture-client-03",
    scope: "Tower South" as FixtureScope,
    workId: "work-03",
    type: "TMF internal target",
    status: "GREEN" as FixtureStatus,
    detail: "Preparation is ready for the next internal control step.",
  },
  {
    id: "calendar-03",
    calendarDate: "2026-10-09",
    dateGroup: "This week",
    date: "This week",
    milestone: "Evidence and archiving",
    returnKey: "WHT-QAP-2026-09",
    returnLabel: "WHT · QAP",
    period: "September 2026",
    statutoryDeadline: "Rule unresolved",
    internalDeadline: "Overdue · control target",
    serviceMilestone: "Evidence open",
    client: "Harborline Services",
    clientId: "fixture-client-02",
    scope: "Tower Central" as FixtureScope,
    workId: "work-02",
    type: "Control milestone",
    status: "RED" as FixtureStatus,
    detail: "Evidence verification remains open after the reported submission result.",
  },
  {
    id: "calendar-04",
    calendarDate: "2026-10-07",
    dateGroup: "This week",
    date: "This week · 4:00 PM",
    milestone: "Preparation target",
    returnKey: "WHT-1601EQ-2026-09",
    returnLabel: "WHT · 1601EQ",
    period: "September 2026",
    statutoryDeadline: "Rule unresolved",
    internalDeadline: "This week · 4:00 PM",
    serviceMilestone: "In preparation",
    client: "Harborline Services",
    clientId: "fixture-client-02",
    scope: "Tower Central" as FixtureScope,
    workId: "work-02",
    type: "TMF internal target",
    status: "GREEN" as FixtureStatus,
    detail: "Preparation is in progress before the next internal control step.",
  },
];

export const fixtureMetrics = [
  { id: "today", label: "Due today", value: "2", tone: "neutral" as const, detail: "service or control milestones" },
  { id: "risk", label: "At risk", value: "2", tone: "amber" as const, detail: "timing exposure needs review" },
  { id: "client", label: "Waiting for client", value: "1", tone: "blue" as const, detail: "approval or data dependency" },
  { id: "control", label: "Control gap", value: "1", tone: "red" as const, detail: "legally reported, control incomplete" },
] as const;

function removeDemoMarker(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(removeDemoMarker);
    return;
  }

  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  Object.keys(record).forEach((key) => {
    const current = record[key];
    if (typeof current === "string") {
      record[key] = current
        .replace(/\s*\(synthetic\)/gi, "")
        .replace(/\bsynthetic\b\s*/gi, "")
        .replace(/\s{2,}/g, " ")
        .trim();
    } else {
      removeDemoMarker(current);
    }
  });
}

[
  fixtureClients,
  fixtureCompliance,
  fixtureFilingHistory,
  fixtureTeamHistory,
  fixtureHistory,
  fixtureWork,
  fixtureExceptions,
].forEach(removeDemoMarker);

const prohibitedFixturePatterns = [
  /\breal\s+TIN\b/i,
  /https?:\/\/[^\s]+sharepoint/i,
  /@gmail\./i,
  /@tmf-group\./i,
];

export function isSanitizedFixtureText(value: string): boolean {
  return !prohibitedFixturePatterns.some((pattern) => pattern.test(value));
}

export function validateFixtureSet(): boolean {
  const values = JSON.stringify({
    fixtureEnvironment,
    fixtureClients,
    fixtureCompliance,
    fixtureFilingHistory,
    fixtureTeamHistory,
    fixtureHistory,
    fixtureWork,
    fixtureCalendar,
    fixtureExceptions,
    fixtureMetrics,
  });

  return isSanitizedFixtureText(values);
}
