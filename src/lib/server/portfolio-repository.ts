import { createSupabaseServerClient } from "@/lib/supabase/server";
import { temporary2303StorageBucket } from "@/lib/supabase/config";

import type { ManualClientSetupInput } from "@/lib/domain/manual-client-setup";
import type { TemporaryDocumentStatus } from "@/lib/domain/temporary-document";

export type PortfolioClient = {
  id: string;
  reference_code: string;
  display_name: string;
  status: "active" | "inactive" | "setup_pending";
  taxpayer_entities: Array<{
    id: string;
    reference_code: string;
    display_name: string;
    tin_status: "unresolved" | "provided" | "validated";
    registration_units: Array<{
      id: string;
      reference_code: string;
      display_name: string;
      unit_kind: "head_office" | "branch" | "other";
      active: boolean;
      registration_source_references: Array<{
        source_kind: "bir_form_2303" | "other_registration_source";
        source_system: "sharepoint" | "synthetic_fixture" | "manual_reference";
        source_reference: string;
        status: "reference_only" | "needs_review" | "verified";
      }>;
    }>;
  }>;
};

export async function listPortfolioClients(): Promise<PortfolioClient[]> {
  const client = await createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured for this environment.");
  }

  const { data, error } = await client
    .from("clients")
    .select(`
      id,
      reference_code,
      display_name,
      status,
      taxpayer_entities (
        id,
        reference_code,
        display_name,
        tin_status,
        registration_units (
          id,
          reference_code,
          display_name,
          unit_kind,
          active,
          registration_source_references (
            source_kind,
            source_system,
            source_reference,
            status
          )
        )
      )
    `)
    .order("display_name");

  if (error) {
    throw new Error(`Unable to load the client portfolio: ${error.message}`);
  }

  return (data ?? []) as PortfolioClient[];
}

export async function createManualClientSetup(input: ManualClientSetupInput): Promise<{
  clientId: string;
  taxpayerEntityId: string;
  registrationUnitId: string;
  setupStatus: "setup_pending";
}> {
  const client = await createSupabaseServerClient();

  if (!client) {
    throw new Error("Supabase is not configured for this environment.");
  }

  const { data, error } = await client.rpc("create_manual_client_setup", {
    p_client_reference_code: input.clientReferenceCode,
    p_client_display_name: input.clientDisplayName,
    p_entity_reference_code: input.entityReferenceCode,
    p_entity_display_name: input.entityDisplayName,
    p_tin: input.tin ?? null,
    p_unit_reference_code: input.unitReferenceCode,
    p_unit_display_name: input.unitDisplayName,
    p_unit_kind: input.unitKind,
    p_registration_reference: input.registrationReference ?? null,
    p_organization_unit_id: input.organizationUnitId,
    p_source_reference: input.sourceReference,
    p_source_system: input.sourceSystem,
    p_source_notes: input.sourceNotes ?? null,
  });

  if (error) {
    throw new Error(`Unable to create the client setup record: ${error.message}`);
  }

  return data as {
    clientId: string;
    taxpayerEntityId: string;
    registrationUnitId: string;
    setupStatus: "setup_pending";
  };
}

export type TemporarySourceDocument = {
  id: string;
  registration_unit_id: string;
  source_kind: "bir_form_2303";
  source_system: "sharepoint" | "synthetic_fixture" | "manual_reference";
  source_reference: string;
  original_filename: string;
  content_type: string;
  byte_size: number;
  storage_bucket: string;
  storage_path: string;
  status: TemporaryDocumentStatus;
  idempotency_key: string;
  processing_attempts: number;
  failure_code: string | null;
  uploaded_at: string | null;
  processing_queued_at: string | null;
  purge_eligible_at: string | null;
  purged_at: string | null;
  created_at: string;
};

type TemporaryDocumentCommandResult = {
  id: string;
  registrationUnitId?: string;
  storageBucket?: string;
  storagePath?: string;
  status: TemporaryDocumentStatus;
  reused?: boolean;
};

export async function createTemporary2303Document(input: {
  registrationUnitId: string;
  sourceSystem: TemporarySourceDocument["source_system"];
  sourceReference: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  idempotencyKey: string;
}): Promise<TemporaryDocumentCommandResult> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client.rpc("create_temporary_2303_document", {
    p_registration_unit_id: input.registrationUnitId,
    p_source_system: input.sourceSystem,
    p_source_reference: input.sourceReference,
    p_original_filename: input.originalFilename,
    p_content_type: input.contentType,
    p_byte_size: input.byteSize,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throw new Error(`Unable to create the temporary document record: ${error.message}`);
  return data as TemporaryDocumentCommandResult;
}

export async function uploadTemporary2303Object(input: {
  storageBucket: string;
  storagePath: string;
  file: File;
  contentType: string;
}) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { error } = await client.storage.from(input.storageBucket || temporary2303StorageBucket).upload(input.storagePath, input.file, {
    contentType: input.contentType,
    cacheControl: "60",
    upsert: true,
  });
  if (error) throw new Error(`Unable to store the temporary document: ${error.message}`);
}

export async function completeTemporary2303Upload(documentId: string): Promise<TemporaryDocumentCommandResult> {
  return callTemporaryDocumentCommand("complete_temporary_2303_upload", { target_document: documentId });
}

export async function failTemporary2303Upload(documentId: string, failureCode: string): Promise<TemporaryDocumentCommandResult> {
  return callTemporaryDocumentCommand("fail_temporary_2303_upload", { target_document: documentId, p_failure_code: failureCode });
}

export async function queueTemporary2303Processing(documentId: string): Promise<TemporaryDocumentCommandResult> {
  return callTemporaryDocumentCommand("queue_temporary_2303_processing", { target_document: documentId });
}

async function callTemporaryDocumentCommand(functionName: string, parameters: Record<string, string>) {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");
  const { data, error } = await client.rpc(functionName, parameters);
  if (error) throw new Error(`Unable to update the temporary document: ${error.message}`);
  return data as TemporaryDocumentCommandResult;
}

export async function getTemporary2303Document(documentId: string): Promise<TemporarySourceDocument | null> {
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");

  const { data, error } = await client
    .from("temporary_source_documents")
    .select("*")
    .eq("id", documentId)
    .maybeSingle();
  if (error) throw new Error(`Unable to load the temporary document: ${error.message}`);
  return data as TemporarySourceDocument | null;
}

export async function createTemporary2303SignedUrl(document: TemporarySourceDocument): Promise<string | null> {
  if (document.status === "purged" || !document.storage_path) return null;
  const client = await createSupabaseServerClient();
  if (!client) throw new Error("Supabase is not configured for this environment.");
  const { data, error } = await client.storage.from(document.storage_bucket || temporary2303StorageBucket).createSignedUrl(document.storage_path, 60);
  if (error) throw new Error(`Unable to create temporary document access: ${error.message}`);
  return data?.signedUrl ?? null;
}
