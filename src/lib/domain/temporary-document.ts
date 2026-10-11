export const temporaryDocumentContentTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/tiff',
] as const;

export type TemporaryDocumentContentType = (typeof temporaryDocumentContentTypes)[number];

export const temporaryDocumentStatuses = [
  'upload_pending',
  'uploaded',
  'processing_queued',
  'failed',
  'purge_eligible',
  'purged',
] as const;

export type TemporaryDocumentStatus = (typeof temporaryDocumentStatuses)[number];

// This is a technical upload guard, not a tax-content assumption. Retention is
// deliberately not encoded here; purge eligibility remains governed data.
export const temporary2303MaxBytes = 15 * 1024 * 1024;

export type TemporaryDocumentMetadata = {
  originalFilename: string;
  contentType: string;
  byteSize: number;
  idempotencyKey: string;
  sourceReference: string;
  sourceSystem: 'sharepoint' | 'synthetic_fixture' | 'manual_reference';
};

const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function startsWithBytes(bytes: Uint8Array, expected: readonly number[]): boolean {
  return expected.every((value, index) => bytes[index] === value);
}

export function contentMatchesDeclaredType(contentType: string, bytes: Uint8Array): boolean {
  switch (contentType) {
    case 'application/pdf':
      return startsWithBytes(bytes, [0x25, 0x50, 0x44, 0x46]);
    case 'image/jpeg':
      return startsWithBytes(bytes, [0xff, 0xd8, 0xff]);
    case 'image/png':
      return startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'image/tiff':
      return startsWithBytes(bytes, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(bytes, [0x4d, 0x4d, 0x00, 0x2a]);
    default:
      return false;
  }
}

export function validateTemporaryDocumentMetadata(metadata: TemporaryDocumentMetadata, bytes: Uint8Array): string[] {
  const errors: string[] = [];

  if (!metadata.originalFilename.trim() || metadata.originalFilename.length > 180) {
    errors.push('A filename between 1 and 180 characters is required.');
  }
  if (!temporaryDocumentContentTypes.includes(metadata.contentType as TemporaryDocumentContentType)) {
    errors.push('Only PDF, JPEG, PNG, and TIFF files are accepted.');
  }
  if (!Number.isSafeInteger(metadata.byteSize) || metadata.byteSize <= 0) {
    errors.push('The file size must be a positive whole number.');
  } else if (metadata.byteSize > temporary2303MaxBytes) {
    errors.push('The file exceeds the temporary 2303 upload limit.');
  }
  if (bytes.byteLength !== metadata.byteSize) {
    errors.push('The received file size does not match its metadata.');
  }
  if (!idempotencyKeyPattern.test(metadata.idempotencyKey)) {
    errors.push('A retry-safe idempotency key is required.');
  }
  if (!metadata.sourceReference.trim() || metadata.sourceReference.length > 240) {
    errors.push('A source reference between 1 and 240 characters is required.');
  }
  if (!['sharepoint', 'synthetic_fixture', 'manual_reference'].includes(metadata.sourceSystem)) {
    errors.push('The source system is not supported.');
  }
  if (errors.length === 0 && !contentMatchesDeclaredType(metadata.contentType, bytes)) {
    errors.push('The file content does not match the declared file type.');
  }

  return errors;
}
