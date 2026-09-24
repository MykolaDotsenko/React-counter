import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const outputDirectory = join(".build-evidence", "sbom");
const outputFile = join(outputDirectory, "release.cdx.json");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const result = spawnSync(
  npmCommand,
  [
    "sbom",
    "--package-lock-only",
    "--sbom-format=cyclonedx",
    "--sbom-type=application",
  ],
  {
    encoding: "utf8",
    env: process.env,
    shell: false,
  },
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  const diagnostic = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  throw new Error(`npm sbom failed${diagnostic ? `:\n${diagnostic}` : ""}`);
}

let parsed;
try {
  parsed = JSON.parse(result.stdout);
} catch (error) {
  throw new Error(`npm sbom returned invalid JSON: ${error.message}`, { cause: error });
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });
writeFileSync(outputFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");

console.log(`Generated CycloneDX release SBOM at ${outputFile}`);
