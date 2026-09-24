import { readFileSync } from "node:fs";
import { join } from "node:path";

const sbomPath = join(".build-evidence", "sbom", "release.cdx.json");

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Unable to read valid JSON from ${path}: ${error.message}`, { cause: error });
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
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
      // Fall through to group/name if an invalid purl appears.
    }
  }

  if (typeof component?.name !== "string") {
    return null;
  }

  return typeof component.group === "string" && component.group.length > 0
    ? `${component.group}/${component.name}`
    : component.name;
}

function packagePathFromComponent(component) {
  const property = Array.isArray(component?.properties)
    ? component.properties.find((entry) => entry?.name === "cdx:npm:package:path")
    : undefined;

  return typeof property?.value === "string" ? property.value : null;
}

const sbom = readJson(sbomPath);
const packageJson = readJson("package.json");
const packageLock = readJson("package-lock.json");

assert(sbom?.bomFormat === "CycloneDX", "SBOM bomFormat must be CycloneDX");
assert(typeof sbom.specVersion === "string" && sbom.specVersion.length > 0, "SBOM specVersion is required");
assert(sbom?.metadata?.component?.type === "application", "SBOM root component must be an application");
assert(
  sbom?.metadata?.component?.name === packageJson.name,
  "SBOM root component name must match package.json",
);
assert(
  sbom?.metadata?.component?.version === packageJson.version,
  "SBOM root component version must match package.json",
);
assert(Array.isArray(sbom.components) && sbom.components.length > 0, "SBOM components are required");
assert(Array.isArray(sbom.dependencies) && sbom.dependencies.length > 0, "SBOM dependency graph is required");

const rootRef = sbom.metadata.component["bom-ref"];
assert(typeof rootRef === "string" && rootRef.length > 0, "SBOM root bom-ref is required");

const rootDependency = sbom.dependencies.find((entry) => entry?.ref === rootRef);
assert(rootDependency && Array.isArray(rootDependency.dependsOn), "SBOM root dependency graph entry is missing");

const componentsByRef = new Map();
const componentNames = new Set();
const componentPaths = new Set();

for (const component of sbom.components) {
  assert(
    typeof component?.["bom-ref"] === "string" && component["bom-ref"].length > 0,
    "Every SBOM component must have a bom-ref",
  );
  assert(!componentsByRef.has(component["bom-ref"]), `Duplicate SBOM bom-ref: ${component["bom-ref"]}`);
  componentsByRef.set(component["bom-ref"], component);

  const packageName = packageNameFromComponent(component);
  assert(packageName, `Unable to identify npm package for ${component["bom-ref"]}`);
  componentNames.add(packageName);

  const packagePath = packagePathFromComponent(component);
  assert(packagePath, `Missing cdx:npm:package:path for ${component["bom-ref"]}`);
  assert(!componentPaths.has(packagePath), `Duplicate SBOM package path: ${packagePath}`);
  componentPaths.add(packagePath);
}

const lockPackagePaths = new Set(
  Object.keys(packageLock.packages ?? {}).filter((path) => path.length > 0),
);

assert(
  componentPaths.size === lockPackagePaths.size,
  `SBOM/package-lock component count mismatch: sbom=${componentPaths.size}, lock=${lockPackagePaths.size}`,
);

for (const packagePath of lockPackagePaths) {
  assert(componentPaths.has(packagePath), `SBOM is missing package-lock entry: ${packagePath}`);
}

const directDependencyNames = new Set([
  ...Object.keys(packageJson.dependencies ?? {}),
  ...Object.keys(packageJson.devDependencies ?? {}),
  ...Object.keys(packageJson.optionalDependencies ?? {}),
]);

const rootDependencyNames = new Set(
  rootDependency.dependsOn.map((ref) => {
    const component = componentsByRef.get(ref);
    assert(component, `Root dependency references unknown component: ${ref}`);
    return packageNameFromComponent(component);
  }),
);

assert(
  rootDependencyNames.size === directDependencyNames.size,
  `Root dependency count mismatch: sbom=${rootDependencyNames.size}, package.json=${directDependencyNames.size}`,
);

for (const packageName of directDependencyNames) {
  assert(componentNames.has(packageName), `SBOM is missing direct package: ${packageName}`);
  assert(rootDependencyNames.has(packageName), `SBOM root graph is missing direct package: ${packageName}`);
}

for (const entry of sbom.dependencies) {
  assert(typeof entry?.ref === "string" && entry.ref.length > 0, "Every dependency entry needs a ref");
  assert(Array.isArray(entry.dependsOn), `Dependency entry ${entry.ref} must expose dependsOn`);

  if (entry.ref !== rootRef) {
    assert(componentsByRef.has(entry.ref), `Dependency graph references unknown component: ${entry.ref}`);
  }

  for (const dependencyRef of entry.dependsOn) {
    assert(
      componentsByRef.has(dependencyRef),
      `Dependency ${entry.ref} points to unknown component: ${dependencyRef}`,
    );
  }
}

console.log(
  `Validated CycloneDX release SBOM: ${sbom.components.length} components, ${sbom.dependencies.length} dependency nodes, ${rootDependency.dependsOn.length} direct dependencies`,
);
