import { afterEach, describe, expect, it, vi } from "vitest";

import { isCalibrationOpenEditMode, isPrototypeDemoMode, isPrototypeEmptyMode } from "./config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("prototype access safety", () => {
  it("allows explicit sanitized calibration locally", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("TAXMON_DEMO_MODE", "true");
    vi.stubEnv("TAXMON_DATA_MODE", "sanitized");
    vi.stubEnv("TAXMON_CALIBRATION_EDIT_MODE", "true");

    expect(isPrototypeDemoMode()).toBe(true);
    expect(isCalibrationOpenEditMode()).toBe(true);
  });

  it("allows an empty prototype only outside Vercel", () => {
    vi.stubEnv("TAXMON_EMPTY_MODE", "true");
    expect(isPrototypeEmptyMode()).toBe(true);
    expect(isPrototypeDemoMode()).toBe(true);
  });

  it("cannot be enabled on a production deployment", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("TAXMON_DEMO_MODE", "true");
    vi.stubEnv("TAXMON_PUBLIC_SANITIZED_DEMO", "true");
    vi.stubEnv("TAXMON_DATA_MODE", "sanitized");
    vi.stubEnv("TAXMON_CALIBRATION_EDIT_MODE", "true");
    vi.stubEnv("TAXMON_EMPTY_MODE", "true");

    expect(isPrototypeDemoMode()).toBe(false);
    expect(isPrototypeEmptyMode()).toBe(false);
    expect(isCalibrationOpenEditMode()).toBe(false);
  });

  it("does not open the edit surface for an unmarked preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TAXMON_CALIBRATION_EDIT_MODE", "true");
    vi.stubEnv("TAXMON_DATA_MODE", "sanitized");

    expect(isPrototypeDemoMode()).toBe(false);
    expect(isCalibrationOpenEditMode()).toBe(false);
  });

  it("allows the explicitly marked sanitized preview demo", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("TAXMON_PUBLIC_SANITIZED_DEMO", "true");
    vi.stubEnv("TAXMON_DATA_MODE", "sanitized");

    expect(isPrototypeDemoMode()).toBe(true);
  });
});
