import {
  fixtureCalendar,
  fixtureClients,
  fixtureCompliance,
  fixtureExceptions,
  fixtureOrgDirectoryMembers,
  fixtureSpecialistCases,
  fixtureWork,
} from "@/lib/fixtures";

export type FixtureIntegrityIssue = {
  code: string;
  recordId: string;
  detail: string;
};

function issue(issues: FixtureIntegrityIssue[], code: string, recordId: string, detail: string) {
  issues.push({ code, recordId, detail });
}

export function getFixtureIntegrityIssues(): FixtureIntegrityIssue[] {
  const issues: FixtureIntegrityIssue[] = [];
  const clientsById = new Map(fixtureClients.map((client) => [client.id, client]));
  const membersByName = new Map(fixtureOrgDirectoryMembers.map((member) => [member.name, member]));
  const membersById = new Map(fixtureOrgDirectoryMembers.map((member) => [member.id, member]));
  const workById = new Map(fixtureWork.map((work) => [work.id, work]));

  for (const member of fixtureOrgDirectoryMembers) {
    if (member.reportsToOrgNodeId && !membersById.has(member.reportsToOrgNodeId)) {
      issue(issues, "MISSING_REPORTING_LINE", member.id, `Reports to missing member ${member.reportsToOrgNodeId}.`);
    }
    const seen = new Set<string>([member.id]);
    let parent = member.reportsToOrgNodeId;
    while (parent) {
      if (seen.has(parent)) {
        issue(issues, "REPORTING_CYCLE", member.id, "Reporting line contains a cycle.");
        break;
      }
      seen.add(parent);
      parent = membersById.get(parent)?.reportsToOrgNodeId ?? null;
    }
  }

  for (const client of fixtureClients) {
    if (!client.entities.length || !client.entities.every((entity) => entity.units.length > 0)) {
      issue(issues, "CLIENT_REGISTRATION_GAP", client.id, "Every demo taxpayer must have an entity and registration unit.");
    }
    const assignments = [client.assignment.preparer, client.assignment.checker, client.assignment.reviewer];
    for (const assignee of assignments) {
      if (assignee !== "Unassigned" && !membersByName.has(assignee)) issue(issues, "UNKNOWN_ASSIGNMENT", client.id, `Assignment points to unknown employee ${assignee}.`);
    }
    if (client.assignment.tower !== client.scope) issue(issues, "CLIENT_SCOPE_MISMATCH", client.id, "Client scope and assignment tower differ.");
  }

  for (const work of fixtureWork) {
    const client = clientsById.get(work.clientId);
    if (!client) {
      issue(issues, "WORK_CLIENT_MISSING", work.id, `Work points to unknown client ${work.clientId}.`);
      continue;
    }
    if (work.scope !== client.scope) issue(issues, "WORK_SCOPE_MISMATCH", work.id, "Work scope differs from its taxpayer assignment scope.");
    const assignedNames = new Set([client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]);
    if (work.owner !== "Tax Control" && !assignedNames.has(work.owner)) issue(issues, "WORK_OWNER_UNASSIGNED", work.id, `Owner ${work.owner} is not assigned to the taxpayer.`);
  }

  for (const item of fixtureCalendar) {
    const work = workById.get(item.workId);
    const client = clientsById.get(item.clientId);
    if (!work) issue(issues, "CALENDAR_WORK_MISSING", item.id, `Calendar item points to unknown work ${item.workId}.`);
    if (!client) issue(issues, "CALENDAR_CLIENT_MISSING", item.id, `Calendar item points to unknown client ${item.clientId}.`);
    if (work && work.clientId !== item.clientId) issue(issues, "CALENDAR_CLIENT_MISMATCH", item.id, "Calendar client differs from work client.");
    if (work && work.scope !== item.scope) issue(issues, "CALENDAR_SCOPE_MISMATCH", item.id, "Calendar scope differs from work scope.");
  }

  for (const item of fixtureExceptions) {
    const work = workById.get(item.workId);
    if (!work || work.clientId !== item.clientId) issue(issues, "EXCEPTION_WORK_MISMATCH", item.id, "Exception does not resolve to its stated work and taxpayer.");
    if (item.owner !== "Tax Control" && !membersByName.has(item.owner)) issue(issues, "EXCEPTION_OWNER_UNKNOWN", item.id, `Exception points to unknown owner ${item.owner}.`);
    const client = clientsById.get(item.clientId);
    if (client && item.owner !== "Tax Control" && !new Set([client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]).has(item.owner)) {
      issue(issues, "EXCEPTION_OWNER_UNASSIGNED", item.id, `Exception owner ${item.owner} is not assigned to the taxpayer.`);
    }
  }

  for (const item of fixtureCompliance) {
    const client = clientsById.get(item.clientId);
    if (!client) issue(issues, "COMPLIANCE_CLIENT_MISSING", item.id, `Compliance item points to unknown client ${item.clientId}.`);
    if (item.owner !== "Tax Control" && !membersByName.has(item.owner)) issue(issues, "COMPLIANCE_OWNER_UNKNOWN", item.id, `Compliance item points to unknown owner ${item.owner}.`);
    if (client && item.serviceScope === "In TMF Scope" && item.owner !== "Tax Control" && !new Set([client.assignment.preparer, client.assignment.checker, client.assignment.reviewer]).has(item.owner)) {
      issue(issues, "COMPLIANCE_OWNER_UNASSIGNED", item.id, `Owner ${item.owner} is not assigned to the taxpayer.`);
    }
  }

  for (const item of fixtureSpecialistCases) {
    if (!clientsById.has(item.taxpayerClientId)) issue(issues, "SPECIALIST_CLIENT_MISSING", item.id, `Specialist case points to unknown client ${item.taxpayerClientId}.`);
    for (const memberId of item.assigneeMemberIds) {
      if (!membersById.has(memberId)) issue(issues, "SPECIALIST_ASSIGNEE_UNKNOWN", item.id, `Specialist case points to unknown employee ${memberId}.`);
    }
    if (!membersById.has(item.accountableMemberId)) issue(issues, "SPECIALIST_ACCOUNTABLE_UNKNOWN", item.id, `Specialist case points to unknown accountable employee ${item.accountableMemberId}.`);
  }

  return issues;
}
