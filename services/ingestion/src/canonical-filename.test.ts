import { describe, it, expect } from "vitest";
import {
  resolveCanonicalAndResponseFilename,
  CANONICAL_GOVERNMENT_FILENAME_REGEX,
  KNOWN_CANONICAL_SOURCE_MAPPINGS
} from "./daily-ingestion-engine";

describe("Phase 4: Canonical Filename Resolution", () => {
  it("Test 1: official filename KR-770.pdf + verified URL basename -> canonical government filename", () => {
    const verifiedUrl = "http://result.keralalotteries.com/images/pdf/276-2368-03-10-2026.pdf";
    const res = resolveCanonicalAndResponseFilename(
      "KR-770.pdf",
      undefined,
      undefined,
      undefined,
      verifiedUrl,
      { candidateDrawNumber: "KR-770" }
    );

    expect(res.canonicalFilename).toBe("276-2368-03-10-2026.pdf");
    expect(res.sourceResponseFilename).toBe("KR-770.pdf");
    expect(res.isCanonicalResolved).toBe(true);
    expect(CANONICAL_GOVERNMENT_FILENAME_REGEX.test(res.canonicalFilename!)).toBe(true);
    // Must NOT use KR-770.pdf as canonicalFilename when verified official URL exposes canonical basename
    expect(res.canonicalFilename).not.toBe("KR-770.pdf");
  });

  it("Test 2: different source response filename", () => {
    const verifiedUrl = "https://statelottery.kerala.gov.in/images/pdf/276-2368-03-10-2026.pdf";
    const res = resolveCanonicalAndResponseFilename(
      "KARUNYA-KR770-OFFICIAL.pdf",
      undefined,
      undefined,
      "KARUNYA-KR770-OFFICIAL.pdf",
      verifiedUrl
    );

    expect(res.canonicalFilename).toBe("276-2368-03-10-2026.pdf");
    expect(res.sourceResponseFilename).toBe("KARUNYA-KR770-OFFICIAL.pdf");
    expect(res.isCanonicalResolved).toBe(true);
  });

  it("Test 3: manually uploaded KR-770.pdf", () => {
    // Manual upload without matching verified official URL or known mapping
    const res = resolveCanonicalAndResponseFilename(
      "KR-770.pdf",
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );

    // Preserves uploaded filename as sourceResponseFilename
    expect(res.sourceResponseFilename).toBe("KR-770.pdf");
    // Canonical filename must remain unresolved / explicitly pending
    expect(res.canonicalFilename).toBeUndefined();
    expect(res.isCanonicalResolved).toBe(false);
    // Must NEVER fabricate a government filename (e.g. guessing prefix 276-...)
    expect(res.canonicalFilename).not.toBe("KR-770.pdf");
  });

  it("Test 4: duplicate SHA", () => {
    // SHA matching known canonical mapping
    const knownSha = "cddb3d4d05c102b98f38050ac1ff297ad15bc442b12087c0505927f7bb1cf3dc";
    const expected = KNOWN_CANONICAL_SOURCE_MAPPINGS[knownSha];
    expect(expected).toBeDefined();

    const res = resolveCanonicalAndResponseFilename(
      "duplicate-upload.pdf",
      knownSha
    );

    expect(res.canonicalFilename).toBe(expected!.canonicalFilename);
    expect(res.sourceResponseFilename).toBe("duplicate-upload.pdf");
    expect(res.isCanonicalResolved).toBe(true);
  });

  it("Test 5: conflicting draw identity", () => {
    const res = resolveCanonicalAndResponseFilename(
      "KR-770.pdf",
      undefined,
      undefined,
      undefined,
      "http://result.keralalotteries.com/images/pdf/276-2368-03-10-2026.pdf",
      {
        candidateDrawNumber: "KR-770",
        existingDrawNumber: "DL-71"
      }
    );

    expect(res.conflict).toBeDefined();
    expect(res.conflict).toContain("Draw identity mismatch");
    expect(res.conflict).toContain("KR-770");
    expect(res.conflict).toContain("DL-71");
  });

  it("Test 6: no verified canonical filename -> do not invent one", () => {
    const res = resolveCanonicalAndResponseFilename("unknown-lottery-scan.pdf");

    expect(res.canonicalFilename).toBeUndefined();
    expect(res.sourceResponseFilename).toBe("unknown-lottery-scan.pdf");
    expect(res.isCanonicalResolved).toBe(false);
  });
});
