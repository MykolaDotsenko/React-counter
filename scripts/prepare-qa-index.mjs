import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const target = resolve("dist-qa/index.html");
const original = await readFile(target, "utf8");

const replacements = [
  [
    "<title>Pulse Counter — Interaction Lab</title>",
    "<title>Budget Cart — Empirical Timing QA</title>",
  ],
  [
    'content="Pulse Counter — a polished React micro-interaction case study focused on motion, accessibility and proportional architecture."',
    'content="Internal Budget Cart empirical timing and one-hand usability QA."',
  ],
  [
    '<meta name="theme-color" content="#070810" />',
    '<meta name="theme-color" content="#f5f3ee" />\n    <meta name="robots" content="noindex,nofollow,noarchive" />',
  ],
];

let next = original;

for (const [from, to] of replacements) {
  if (!next.includes(from)) {
    throw new Error(`QA index hardening could not find expected markup: ${from}`);
  }

  next = next.replace(from, to);
}

if (
  !next.includes("<title>Budget Cart — Empirical Timing QA</title>") ||
  !next.includes('name="robots" content="noindex,nofollow,noarchive"')
) {
  throw new Error("QA index hardening verification failed");
}

await writeFile(target, next, "utf8");
