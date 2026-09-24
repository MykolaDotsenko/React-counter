import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const outputDirectory = join(".build-evidence", "sbom");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function generateSbom(filename, extraArgs = []) {
  const args = [
    "sbom",
    "--package-lock-only",
    "--sbom-format=cyclonedx",
    "--sbom-type=application",
    ...extraArgs,
  ];

  const result = spawnSync(npmCommand, args, {
    encoding: "utf8",
    env: process.env,
    shell: false,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const diagnostic = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    throw new Error(`npm sbom failed for ${filename}${diagnostic ? `:\n${diagnostic}` : ""}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`npm sbom returned invalid JSON for ${filename}: ${error.message}`);
  }

  writeFileSync(join(outputDirectory, filename), `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
}

rmSync(outputDirectory, { recursive: true, force: true });
mkdirSync(outputDirectory, { recursive: true });

generateSbom("runtime.cdx.json", ["--omit=dev"]);
generateSbom("build.cdx.json");

console.log(`Generated CycloneDX SBOM evidence in ${outputDirectory}`);
