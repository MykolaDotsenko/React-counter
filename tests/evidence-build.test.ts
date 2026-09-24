import { describe, expect, it } from "vitest";

import {
  EVIDENCE_BUILD_REVISION,
  isEvidenceBuildRevision,
  isImmutableEvidenceBuildRevision,
} from "../src/qa/evidence-build";

describe("evidence build provenance", () => {
  it("uses an explicit local sentinel outside stamped CI builds", () => {
    expect(EVIDENCE_BUILD_REVISION).toBe("local-dev");
  });

  it("distinguishes local development from immutable field revisions", () => {
    expect(isImmutableEvidenceBuildRevision("local-dev")).toBe(false);
    expect(
      isImmutableEvidenceBuildRevision(
        "0123456789abcdef0123456789abcdef01234567",
      ),
    ).toBe(true);
    expect(isImmutableEvidenceBuildRevision("0123456")).toBe(false);
  });

  it("accepts only the local sentinel or a full lowercase Git SHA", () => {
    expect(isEvidenceBuildRevision("local-dev")).toBe(true);
    expect(
      isEvidenceBuildRevision(
        "0123456789abcdef0123456789abcdef01234567",
      ),
    ).toBe(true);

    expect(isEvidenceBuildRevision("0123456")).toBe(false);
    expect(
      isEvidenceBuildRevision(
        "0123456789ABCDEF0123456789ABCDEF01234567",
      ),
    ).toBe(false);
    expect(isEvidenceBuildRevision("main")).toBe(false);
    expect(isEvidenceBuildRevision("")).toBe(false);
  });
});
