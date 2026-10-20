import type { FixtureTower } from "@/lib/domain/organization-catalog";
import type { ClientDeadlinePolicy } from "@/lib/domain/client-deadline-policy";

export type FixtureScope = FixtureTower;
export type FixtureStatus = "GREEN" | "AMBER" | "RED" | "UNRESOLVED";
export type FixtureSourceWeightClassification = "Extremely Heavy" | "Heavy" | "Moderate" | "Light" | "Super Light";
export type FixtureSource = "source_weighted_portfolio" | "synthetic_portfolio_test";
export type FixtureOperatingModel = "ENGAGEMENT_AGILE" | "ENGAGEMENT_DEDICATED" | "TAX_TEAM";
export type FixtureContractRecordStatus = "Active" | "Pending review" | "Closed";
export type FixtureMasterEngagementDocumentKind = "MSA" | "LSA" | "Addendum";
export type FixtureAdditionalEngagementKind = "Change Request Form";
export type FixtureWorkStepState = "complete" | "current" | "waiting" | "blocked" | "not-started" | "unresolved";

export type FixtureWorkStep = {
  id: string;
  label: string;
  state: FixtureWorkStepState;
  detail: string;
};

export type FixtureWorkComponent = {
  label: "Submission" | "Payment" | "Attachments" | "Evidence";
  state: string;
  detail: string;
  /** Component deadline from the governed work read model, when available. */
  deadline?: string | null;
};

export type FixturePaymentApplicability = "REQUIRED" | "NOT_APPLICABLE" | "UNRESOLVED";

export type FixtureDataReadiness = {
  state: "READY" | "NOT_READY";
  source: "CLIENT_RECORDS" | "TMF_BOOKS";
  reason: string;
  actor: string;
  recordedAt: string;
};

export type FixtureWorkflowSnapshot = {
  currentGate: "PREPARER" | "CHECKER" | "REVIEWER" | null;
  attempts: readonly {
    id: string;
    role: "PREPARER" | "CHECKER" | "REVIEWER";
    decision: "CERTIFY" | "APPROVE" | "RETURN";
    note: string;
    answers: Record<string, boolean>;
    taxDueAmount?: number;
    actor: string;
    recordedAt: string;
    elevatedOverride?: boolean;
    overrideReason?: string;
  }[];
  checklistAnswers: Partial<Record<"PREPARER" | "CHECKER" | "REVIEWER", Readonly<Record<string, boolean>>>>;
  checklistHistory: readonly {
    id: string;
    role: "PREPARER" | "CHECKER" | "REVIEWER";
    questionId: string;
    completed: boolean;
    actor: string;
    recordedAt: string;
  }[];
  processStatuses: Readonly<Record<string, "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "NOT_APPLICABLE" | "NEEDS_ATTENTION">>;
  processHistory: readonly {
    id: string;
    stepId: string;
    status: "NOT_STARTED" | "IN_PROGRESS" | "DONE" | "NOT_APPLICABLE" | "NEEDS_ATTENTION";
    actor: string;
    recordedAt: string;
    evidenceReference?: string;
    completedOn?: string;
    acknowledgedOn?: string;
    validatedOn?: string;
    attachmentName?: string;
    sharepointUrl?: string;
    elevatedOverride?: boolean;
    overrideReason?: string;
  }[];
  dataReadiness?: FixtureDataReadiness;
  archiveFacts?: {
    filingDate?: string;
    filingReferenceNumber?: string;
    proceedToPay?: string;
    paymentAcknowledgementDate?: string;
    paymentAcknowledgement?: string;
    eSubmissionSubmission?: string;
    eSubmissionSubmissionDate?: string;
    birAcknowledgedDate?: string;
    birValidatedDate?: string;
    attachmentName?: string;
  };
  changeHistory: readonly {
    id: string;
    kind: "PAYMENT_AMOUNT" | "PAYMENT_PROFILE";
    detail: string;
    actor: string;
    recordedAt: string;
  }[];
  periodLock: { locked: boolean; actor?: string; recordedAt?: string; reason?: string; elevatedOverride?: boolean };
  periodLockHistory: readonly { locked: boolean; actor?: string; recordedAt?: string; reason?: string; elevatedOverride?: boolean }[];
  finalCertification?: { actor: string; recordedAt: string; note: string; elevatedOverride?: boolean; overrideReason?: string };
};

export type FixtureWorkItem = {
  id: string;
  /** Live only: the person accountable for each control role, by user id and display name. */
  assignedUsers?: Partial<Record<"PREPARER" | "CHECKER" | "REVIEWER", { id: string; name: string }>>;
  /** Governed requirement context used to join live work to released calendar entries. */
  requirementId?: string;
  requirementVersionId?: string;
  /** Stable governed return code used by Tax Team's centralized lock control. */
  requirementCode?: string;
  /** Stable accounting-period key used by the period-close boundary. */
  periodKey?: string;
  clientId: string;
  client: string;
  entity: string;
  registrationUnitId?: string;
  registrationUnit: string;
  title: string;
  period: string;
  detail: string;
  stage: "PREPARE" | "REVIEW" | "CLIENT" | "FILE" | "POST-FILING";
  nextAction: string;
  status: FixtureStatus;
  statusReason: string;
  deadline: string;
  /** Governed due date used to prevent locking a return before it is due. */
  dueDate?: string | null;
  deadlineType: "TMF internal target" | "Client / service milestone" | "Control milestone";
  owner: string;
  scope: FixtureScope;
  /** Normalized organizational projection; unresolved until a canonical cluster is linked. */
  cluster?: string;
  paymentApplicability: FixturePaymentApplicability;
  paymentAmount?: number | null;
  steps: readonly FixtureWorkStep[];
  components: readonly FixtureWorkComponent[];
  workflowSnapshot?: FixtureWorkflowSnapshot;
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
  officerName?: string;
  officerRole?: string;
  officerContact?: string;
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
  taxYearBasis?: "Calendar year" | "Fiscal year";
  fiscalYearEnd?: string;
  goLiveDate?: string;
  /** First compliance period included in the engagement, stored as YYYY-MM. */
  firstPeriodToFile?: string;
  permanentFileLink?: string;
  accountingSystem?: string;
  booksType?: string;
  invoicing?: string;
  registeredTaxTypeCodes?: readonly string[];
  registeredReturnCodes?: readonly string[];
  paymentRoute: "Client Pays" | "TMF Pays" | "Not configured";
  deadlinePolicy?: ClientDeadlinePolicy;
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

export type FixtureContractDocument = {
  id: string;
  kind: FixtureMasterEngagementDocumentKind;
  isCurrent: boolean;
  referenceCode: string;
  title: string;
  status: FixtureContractRecordStatus;
  effectiveFrom: string;
  sourceReference: string;
};

export type FixtureMasterEngagement = {
  id: string;
  referenceCode: string;
  title: string;
  status: FixtureContractRecordStatus;
  effectiveFrom: string;
  documents: readonly FixtureContractDocument[];
};

export type FixtureAdditionalEngagement = {
  id: string;
  kind: FixtureAdditionalEngagementKind;
  referenceCode: string;
  title: string;
  status: FixtureContractRecordStatus;
  effectiveFrom: string;
  sourceReference: string;
  scopeSummary: string;
};

export type FixtureChangeRequestFormType = "Tax audit support" | "Additional tax service" | "Registration remediation" | "Other";
export type FixtureChangeRequestFormStatus = "Draft" | "Pending review" | "Approved" | "Active" | "Closed";

/**
 * CRF is the prototype projection of an additional engagement. It remains
 * linked to the client's single Contract Repository; it is not a second
 * taxpayer, Tax Profile, or audit-case record.
 */
export type FixtureChangeRequestForm = {
  id: string;
  referenceCode: string;
  clientId: string;
  contractRepositoryId: string;
  clientName: string;
  title: string;
  type: FixtureChangeRequestFormType;
  status: FixtureChangeRequestFormStatus;
  requestedOn: string;
  requestedBy: string;
  owner: string;
  scopeSummary: string;
  sourceReference: string;
  templateVersion: "CRF v1";
  auditContext?: FixtureAuditExposure;
};

export type FixtureContractRepository = {
  id: string;
  referenceCode: string;
  masterEngagement?: FixtureMasterEngagement;
  additionalEngagements: readonly FixtureAdditionalEngagement[];
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
  organizationUnitId?: string | null;
  operatingModel: FixtureOperatingModel;
  specialistTeam?: "Tax Team";
  careerServiceLevel?: string;
  reportsToOrgNodeId?: string | null;
  reportingLineExceptionReason?: string;
  assignmentAliases?: readonly string[];
  /** Effective date for the current fixture roster state. Production commands must audit this. */
  effectiveFrom?: string;
  /** Human-entered context only; does not change assignment or workload semantics. */
  remarks?: string;
};
