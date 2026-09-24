import { readFileSync } from "node:fs";
import { join } from "node:path";

const sbomDirectory = join(".build-evidence", "sbom");

function readJson(filename) {
  const path = join(sbomDirectory, filename);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read valid SBOM JSON from ${path}: ${error.message}`, { cause: error });
  }
}

function packageNameFromComponent(component) {
  if (typeof component?.purl === "string" && component.purl.startsWith("pkg:npm/")) {
    const withoutPrefix = component.purl.slice("pkg:npm/".length);
    const versionSeparator = withoutPrefix.lastIndexOf("@");
    const encodedName = versionSeparator > 0 ? withoutPrefix.slice(0, versionSeparator) : withoutPrefix;

    try {
      return decodeURIComponent(encodedName);
    } catch {
      // Fall through to group/name when a malformed purl is encountered.
    }
  }

  if (typeof component?.name !== "string") {
    return null;
  }

  return typeof component.group === "string" && component.group.length > 0
    ? `${component.group}/${component.name}`
    : component.name;
}

function componentNames(sbom) {
  return new Set(
    Array.isArray(sbom.components)
      ? sbom.components.map(packageNameFromComponent).filter(Boolean)
      : [],
  );
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function validateStructure(sbom, label) {
  assert(sbom?.bomFormat === "CycloneDX", `${label}: bomFormat must be CycloneDX`);
  assert(
    typeof sbom.specVersion === "string" && sbom.specVersion.length > 0,
    `${label}: specVersion is required`,
  );
  assert(sbom?.metadata?.component?.type === "application", `${label}: root component must be an application`);
  assert(
    sbom?.metadata?.component?.name === "shopping-budget-companion",
    `${label}: unexpected root component name`,
  );
  assert(sbom?.metadata?.component?.version === "2.0.0", `${label}: unexpected root component version`);
  assert(Array.isArray(sbom.components) && sbom.components.length > 0, `${label}: components are required`);
  assert(Array.isArray(sbom.dependencies) && sbom.dependencies.length > 0, `${label}: dependency graph is required`);

  const rootRef = sbom.metadata.component["bom-ref"];
  assert(typeof rootRef === "string" && rootRef.length > 0, `${label}: root bom-ref is required`);
  assert(
    sbom.dependencies.some((entry) => entry?.ref === rootRef && Array.isArray(entry.dependsOn)),
    `${label}: root dependency graph entry is missing`,
  );
}

function requirePackages(names, expected, label) {
  for (const packageName of expected) {
    assert(names.has(packageName), `${label}: expected package ${packageName} is missing`);
  }
}

function forbidPackages(names, forbidden, label) {
  for (const packageName of forbidden) {
    assert(!names.has(packageName), `${label}: dev-only package ${packageName} must be omitted`);
  }
}

const runtime = readJson("runtime.cdx.json");
const build = readJson("build.cdx.json");

validateStructure(runtime, "runtime SBOM");
validateStructure(build, "build SBOM");

const runtimePackages = componentNames(runtime);
const buildPackages = componentNames(build);

requirePackages(runtimePackages, ["react", "react-dom", "zod"], "runtime SBOM");
forbidPackages(runtimePackages, ["vitest", "@vitest/coverage-v8", "vite"], "runtime SBOM");

requirePackages(
  buildPackages,
  ["react", "react-dom", "zod", "vitest", "@vitest/coverage-v8", "vite"],
  "build SBOM",
);

assert(
  buildPackages.size > runtimePackages.size,
  "build SBOM must contain more components than the runtime-only SBOM",
);

console.log(
  `Validated CycloneDX SBOMs: runtime=${runtimePackages.size} components, build=${buildPackages.size} components`,
);
