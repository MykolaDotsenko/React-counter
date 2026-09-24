export type EvidenceBuildRevision = string;

const FULL_GIT_SHA = /^[0-9a-f]{40}$/;

export const isEvidenceBuildRevision = (
  value: unknown,
): value is EvidenceBuildRevision =>
  value === "local-dev" ||
  (typeof value === "string" && FULL_GIT_SHA.test(value));

const configuredBuildRevision =
  import.meta.env.VITE_EVIDENCE_BUILD_REVISION?.trim();

if (
  configuredBuildRevision !== undefined &&
  configuredBuildRevision !== "" &&
  !isEvidenceBuildRevision(configuredBuildRevision)
) {
  throw new Error(
    "VITE_EVIDENCE_BUILD_REVISION must be a 40-character lowercase Git SHA",
  );
}

export const EVIDENCE_BUILD_REVISION: EvidenceBuildRevision =
  configuredBuildRevision === undefined ||
  configuredBuildRevision === ""
    ? "local-dev"
    : configuredBuildRevision;
