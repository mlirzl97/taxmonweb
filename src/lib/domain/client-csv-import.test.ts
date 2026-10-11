import { describe, expect, it } from "vitest";

import { parseClientSetupCsv } from "./client-csv-import";

describe("client intake CSV import", () => {
  it("parses quoted values and applies safe defaults", () => {
    const result = parseClientSetupCsv([
      "client_reference_code,client_display_name,entity_reference_code,entity_display_name,tin,unit_reference_code,unit_display_name,source_reference,source_notes",
      'client-001,"Cresthaven, Philippines Inc.",entity-001,"Cresthaven, Philippines Inc.",000-123-456-000,RU-001,Head Office,2303-001,"Imported for source review"',
    ].join("\n"));

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].identity.clientReferenceCode).toBe("CLIENT-001");
    expect(result.rows[0].identity.clientDisplayName).toBe("Cresthaven, Philippines Inc.");
    expect(result.rows[0].identity.unitKind).toBe("head_office");
    expect(result.rows[0].sourceSystem).toBe("manual_reference");
  });

  it("rejects missing required headers, duplicate references, and malformed references", () => {
    const result = parseClientSetupCsv([
      "client_reference_code,client_display_name,entity_reference_code,entity_display_name,unit_reference_code,unit_display_name,source_reference",
      "CLIENT-001,First,ENTITY-001,First Entity,RU-001,Head Office,SRC-001",
      "CLIENT-001,Second,ENTITY 002,Second Entity,RU-002,Branch,SRC-002",
    ].join("\n"));

    expect(result.rows).toHaveLength(1);
    expect(result.errors.map((error) => error.message)).toEqual(expect.arrayContaining([
      "Client reference is duplicated in this file.",
      "Use letters, numbers, dots, underscores, or hyphens only.",
    ]));
    expect(result.errors.some((error) => error.field === "tin" && error.message === "Required column is missing.")).toBe(false);
  });

  it("keeps unknown extra columns visible without treating them as client facts", () => {
    const result = parseClientSetupCsv([
      "client_reference_code,client_display_name,entity_reference_code,entity_display_name,unit_reference_code,unit_display_name,source_reference,contact_email",
      "CLIENT-001,First,ENTITY-001,First Entity,RU-001,Head Office,SRC-001,not-stored@example.test",
    ].join("\n"));

    expect(result.errors).toEqual([]);
    expect(result.ignoredHeaders).toEqual(["contact_email"]);
    expect(result.rows[0].identity).not.toHaveProperty("contact_email");
  });

  it("carries an optional contract record classification into the intake row", () => {
    const result = parseClientSetupCsv([
      "client_reference_code,client_display_name,entity_reference_code,entity_display_name,unit_reference_code,unit_display_name,contract_record_type,contract_reference_code,contract_source_reference,source_reference",
      "CLIENT-001,First,ENTITY-001,First Entity,RU-001,Head Office,lsa,LSA-001,contract-source-001,SRC-001",
    ].join("\n"));

    expect(result.errors).toEqual([]);
    expect(result.rows[0].contract).toEqual({ recordType: "lsa", referenceCode: "LSA-001", sourceReference: "contract-source-001" });
  });
});
