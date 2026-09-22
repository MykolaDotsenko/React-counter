import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const docsRoot = path.join(root, "docs");

const requiredFiles = [
  "README.md",
  "AGENTS.md",
  "docs/README.md",
  "docs/PRODUCT.md",
  "docs/ARCHITECTURE.md",
  "docs/DOMAIN.md",
  "docs/DESIGN.md",
  "docs/ROADMAP.md",
  "docs/TESTING.md",
  "docs/DECISIONS.md",
  "docs/specs/RELEASE-SPEC.md",
  "docs/specs/MONEY-SPEC.md",
  "docs/specs/STATE-MACHINES.md",
  "docs/specs/STORAGE-SCHEMA.md",
  "docs/specs/PRICE-ENTRY-CONTRACT.md",
  "docs/architecture/DATA-PERSISTENCE.md",
  "docs/quality/ACCESSIBILITY.md",
  "docs/reference/CODE-OWNERSHIP.md",
];

const retiredPaths = [
  "docs/specs/MVP-SPEC.md",
  "docs/specs/CONTRACTS.md",
  "docs/reference/FUNCTIONALITY.md",
];

const allowedDocsRootFiles = new Set([
  "README.md",
  "PRODUCT.md",
  "ARCHITECTURE.md",
  "DOMAIN.md",
  "DESIGN.md",
  "ROADMAP.md",
  "TESTING.md",
  "DECISIONS.md",
]);

const failures = [];

const toRepoPath = (absolutePath) =>
  path.relative(root, absolutePath).split(path.sep).join("/");

const walkMarkdown = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walkMarkdown(absolute)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(absolute);
    }
  }

  return files;
};

for (const file of requiredFiles) {
  if (!existsSync(path.join(root, file))) {
    failures.push(`Missing required documentation file: ${file}`);
  }
}

for (const retiredPath of retiredPaths) {
  if (existsSync(path.join(root, retiredPath))) {
    failures.push(`Retired documentation path must not return: ${retiredPath}`);
  }
}

for (const entry of await readdir(docsRoot, { withFileTypes: true })) {
  if (
    entry.isFile() &&
    entry.name.endsWith(".md") &&
    !allowedDocsRootFiles.has(entry.name)
  ) {
    failures.push(
      `Unexpected docs-root Markdown file: docs/${entry.name}. Classify it under specs/, architecture/, quality/, decisions/, reference/, evidence/, research/, marketing/, or archive/.`,
    );
  }
}

const markdownFiles = [
  path.join(root, "README.md"),
  path.join(root, "AGENTS.md"),
  ...(await walkMarkdown(docsRoot)),
];

const markdownLinkPattern = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

for (const file of markdownFiles) {
  const source = await readFile(file, "utf8");

  for (const match of source.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1];

    if (
      rawTarget.startsWith("#") ||
      rawTarget.startsWith("/") ||
      /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
    ) {
      continue;
    }

    const pathOnly = rawTarget.split("#", 1)[0].split("?", 1)[0];

    if (pathOnly.length === 0) {
      continue;
    }

    let decodedTarget;

    try {
      decodedTarget = decodeURIComponent(pathOnly);
    } catch {
      failures.push(
        `Invalid encoded Markdown link in ${toRepoPath(file)}: ${rawTarget}`,
      );
      continue;
    }

    const absoluteTarget = path.resolve(path.dirname(file), decodedTarget);
    const relativeToRoot = path.relative(root, absoluteTarget);

    if (
      relativeToRoot === ".." ||
      relativeToRoot.startsWith(`..${path.sep}`) ||
      path.isAbsolute(relativeToRoot)
    ) {
      failures.push(
        `Markdown link escapes repository in ${toRepoPath(file)}: ${rawTarget}`,
      );
      continue;
    }

    if (!existsSync(absoluteTarget)) {
      failures.push(
        `Broken relative Markdown link in ${toRepoPath(file)}: ${rawTarget}`,
      );
    }
  }
}

if (failures.length > 0) {
  console.error("Documentation validation failed:\n");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exitCode = 1;
} else {
  console.log(
    `Documentation validation passed for ${markdownFiles.length} Markdown files.`,
  );
}
