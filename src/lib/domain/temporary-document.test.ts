import { describe, expect, it } from 'vitest';

import {
  contentMatchesDeclaredType,
  temporary2303MaxBytes,
  validateTemporaryDocumentMetadata,
} from './temporary-document';

const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);

function metadata(overrides: Partial<Parameters<typeof validateTemporaryDocumentMetadata>[0]> = {}) {
  return {
    originalFilename: 'synthetic-2303.pdf',
    contentType: 'application/pdf',
    byteSize: pdfBytes.byteLength,
    idempotencyKey: 'upload-2026-10-05-001',
    sourceReference: 'synthetic-2303-01',
    sourceSystem: 'synthetic_fixture' as const,
    ...overrides,
  };
}

describe('temporary 2303 upload boundary', () => {
  it('accepts a source-backed synthetic PDF with matching bytes', () => {
    expect(validateTemporaryDocumentMetadata(metadata(), pdfBytes)).toEqual([]);
  });

  it('rejects a browser MIME claim when the file signature disagrees', () => {
    expect(contentMatchesDeclaredType('application/pdf', new Uint8Array([0x89, 0x50, 0x4e, 0x47]))).toBe(false);
    expect(validateTemporaryDocumentMetadata(metadata({ contentType: 'image/png' }), pdfBytes)).toContain(
      'The file content does not match the declared file type.',
    );
  });

  it('rejects unsupported types, oversize files, and non-retry-safe requests', () => {
    const errors = validateTemporaryDocumentMetadata(
      metadata({ contentType: 'text/plain', byteSize: temporary2303MaxBytes + 1, idempotencyKey: 'short' }),
      pdfBytes,
    );
    expect(errors).toContain('Only PDF, JPEG, PNG, and TIFF files are accepted.');
    expect(errors).toContain('The file exceeds the temporary 2303 upload limit.');
    expect(errors).toContain('A retry-safe idempotency key is required.');
  });

  it('keeps source references explicit without interpreting tax content', () => {
    const errors = validateTemporaryDocumentMetadata(metadata({ sourceReference: '' }), pdfBytes);
    expect(errors).toContain('A source reference between 1 and 240 characters is required.');
  });
});

