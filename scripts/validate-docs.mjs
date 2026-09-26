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

const allowedRepoRootMarkdown = new Set([
  "README.md",
  "AGENTS.md",
  "CONTRIBUTING.md",
  "SECURITY.md",
]);

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

for (const entry of await readdir(root, { withFileTypes: true })) {
  if (
    entry.isFile() &&
    entry.name.endsWith(".md") &&
    !allowedRepoRootMarkdown.has(entry.name)
  ) {
    failures.push(
      `Unexpected repository-root Markdown file: ${entry.name}. Keep root documentation limited to ${[...allowedRepoRootMarkdown].join(", ")}.`,
    );
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

const docsMarkdown = await walkMarkdown(docsRoot);
const markdownFiles = [
  ...[...allowedRepoRootMarkdown].map((file) => path.join(root, file)),
  ...docsMarkdown,
];
const markdownSet = new Set(markdownFiles.map((file) => path.resolve(file)));
const linkGraph = new Map(
  markdownFiles.map((file) => [path.resolve(file), new Set()]),
);

const markdownLinkPattern =
  /!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;

const resolveLocalTarget = (sourceFile, rawTarget) => {
  if (
    rawTarget.startsWith("#") ||
    rawTarget.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)
  ) {
    return null;
  }

  const pathOnly = rawTarget.split("#", 1)[0].split("?", 1)[0];

  if (pathOnly.length === 0) {
    return null;
  }

  let decodedTarget;

  try {
    decodedTarget = decodeURIComponent(pathOnly);
  } catch {
    failures.push(
      `Invalid encoded Markdown link in ${toRepoPath(sourceFile)}: ${rawTarget}`,
    );
    return null;
  }

  const absoluteTarget = path.resolve(path.dirname(sourceFile), decodedTarget);
  const relativeToRoot = path.relative(root, absoluteTarget);

  if (
    relativeToRoot === ".." ||
    relativeToRoot.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativeToRoot)
  ) {
    failures.push(
      `Markdown link escapes repository in ${toRepoPath(sourceFile)}: ${rawTarget}`,
    );
    return null;
  }

  if (!existsSync(absoluteTarget)) {
    failures.push(
      `Broken relative Markdown link in ${toRepoPath(sourceFile)}: ${rawTarget}`,
    );
    return null;
  }

  const directoryReadme = path.join(absoluteTarget, "README.md");

  if (existsSync(directoryReadme)) {
    return path.resolve(directoryReadme);
  }

  return path.resolve(absoluteTarget);
};

const headingAnchors = (source) => {
  const anchors = new Set();
  const occurrences = new Map();
  const withoutFences = source.replace(
    /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[^\n]*$/gm,
    "",
  );

  for (const match of withoutFences.matchAll(
    /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm,
  )) {
    const base = match[1]
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const seen = occurrences.get(base) ?? 0;

    occurrences.set(base, seen + 1);
    anchors.add(seen === 0 ? base : `${base}-${seen}`);
  }

  return anchors;
};

const anchorCache = new Map();

const anchorsOf = async (file) => {
  if (!anchorCache.has(file)) {
    anchorCache.set(file, headingAnchors(await readFile(file, "utf8")));
  }

  return anchorCache.get(file);
};

const decodedFragment = (rawTarget) => {
  const fragment = rawTarget.slice(rawTarget.indexOf("#") + 1);

  try {
    return decodeURIComponent(fragment).toLowerCase();
  } catch {
    return fragment.toLowerCase();
  }
};

for (const file of markdownFiles) {
  const source = await readFile(file, "utf8");

  for (const match of source.matchAll(markdownLinkPattern)) {
    const rawTarget = match[1];
    const sameFile = rawTarget.startsWith("#");
    const target = sameFile
      ? path.resolve(file)
      : resolveLocalTarget(file, rawTarget);

    if (target === null) {
      continue;
    }

    if (!sameFile && markdownSet.has(target)) {
      linkGraph.get(path.resolve(file))?.add(target);
    }

    if (
      rawTarget.includes("#") &&
      target.endsWith(".md") &&
      !(await anchorsOf(target)).has(decodedFragment(rawTarget))
    ) {
      failures.push(
        `Broken Markdown anchor in ${toRepoPath(file)}: ${rawTarget}`,
      );
    }
  }
}

const docsEntry = path.resolve(docsRoot, "README.md");
const reachableDocs = new Set([docsEntry]);
const queue = [docsEntry];

while (queue.length > 0) {
  const current = queue.shift();

  for (const target of linkGraph.get(current) ?? []) {
    if (!target.startsWith(`${path.resolve(docsRoot)}${path.sep}`)) {
      continue;
    }

    if (!reachableDocs.has(target)) {
      reachableDocs.add(target);
      queue.push(target);
    }
  }
}

for (const file of docsMarkdown) {
  const absolute = path.resolve(file);

  if (!reachableDocs.has(absolute)) {
    failures.push(
      `Documentation file is not reachable from docs/README.md: ${toRepoPath(file)}`,
    );
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
