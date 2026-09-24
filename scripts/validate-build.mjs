import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";

import { extractInitialAssetPaths } from "./build-budget.mjs";

const root = process.cwd();
const dist = path.join(root, "dist");
const assets = path.join(dist, "assets");
const requiredPwaFiles = [
  "manifest.webmanifest",
  "sw.js",
  "pwa-icon-192.png",
  "pwa-icon-512.png",
];

for (const file of requiredPwaFiles) {
  await stat(path.join(dist, file));
}

const manifest = JSON.parse(
  await readFile(path.join(dist, "manifest.webmanifest"), "utf8"),
);

if (
  manifest.name !== "Shopping Budget Companion" ||
  manifest.short_name !== "Shop Budget" ||
  manifest.display !== "standalone" ||
  manifest.start_url !== "./" ||
  manifest.scope !== "./"
) {
  throw new Error("Public PWA manifest does not match the release contract.");
}

const iconSizes = new Set(
  (manifest.icons ?? []).map((icon) => icon.sizes),
);

for (const requiredSize of ["192x192", "512x512"]) {
  if (!iconSizes.has(requiredSize)) {
    throw new Error(
      `Public PWA manifest is missing required icon size ${requiredSize}.`,
    );
  }
}

const indexHtml = await readFile(path.join(dist, "index.html"), "utf8");

if (!indexHtml.includes('rel="manifest"')) {
  throw new Error("Public build does not link its web app manifest.");
}

const MAX_PUBLIC_JS_BYTES = 430_000;
const MAX_INITIAL_JS_BYTES = 425_000;
const MAX_SINGLE_JS_CHUNK_BYTES = 425_000;
const MAX_PUBLIC_JS_GZIP_BYTES = 126_000;
const MAX_INITIAL_JS_GZIP_BYTES = 123_000;
const MAX_PUBLIC_CSS_BYTES = 80_000;
const MAX_INITIAL_CSS_BYTES = 70_000;
const MAX_PUBLIC_CSS_GZIP_BYTES = 12_000;
const MAX_INITIAL_CSS_GZIP_BYTES = 11_000;
const forbiddenMarkers = [
  "Retention Beta",
  "Local beta evidence",
  "Empirical Timing QA",
  "budget-cart:qa:retention-v1",
  "Retention cohort analyzer",
  "retention-cohort-summary",
  "Barcode interaction benchmark",
  "budget-cart:qa:barcode-benchmark-v1",
];

const files = await readdir(assets);
const jsFiles = files.filter((file) => file.endsWith(".js"));
const cssFiles = files.filter((file) => file.endsWith(".css"));

if (jsFiles.length === 0) {
  throw new Error("Public build contains no JavaScript asset.");
}

const assetSize = async (file) => (await stat(path.join(assets, file))).size;
const assetGzipSize = async (file) =>
  gzipSync(await readFile(path.join(assets, file))).byteLength;

const totalSize = async (names, sizeReader) =>
  (
    await Promise.all(
      names.map(async (file) => sizeReader(file)),
    )
  ).reduce((sum, size) => sum + size, 0);

const toAssetName = (distAssetPath) =>
  distAssetPath.startsWith("assets/")
    ? distAssetPath.slice("assets/".length)
    : distAssetPath;

const {
  js: initialJsPaths,
  css: initialCssPaths,
} = extractInitialAssetPaths(indexHtml);

if (initialJsPaths.length === 0) {
  throw new Error(
    "Public index does not expose an initial module JavaScript asset.",
  );
}

if (initialCssPaths.length === 0) {
  throw new Error(
    "Public index does not expose an initial stylesheet asset.",
  );
}

const initialJsFiles = initialJsPaths.map(toAssetName);
const initialCssFiles = initialCssPaths.map(toAssetName);

for (const file of [...initialJsFiles, ...initialCssFiles]) {
  await stat(path.join(assets, file));
}

const initialJsSet = new Set(initialJsFiles);
const lazyJsFiles = jsFiles.filter((file) => !initialJsSet.has(file));

const totalJsBytes = await totalSize(jsFiles, assetSize);
const totalCssBytes = await totalSize(cssFiles, assetSize);
const initialJsBytes = await totalSize(initialJsFiles, assetSize);
const initialCssBytes = await totalSize(initialCssFiles, assetSize);
const totalJsGzipBytes = await totalSize(jsFiles, assetGzipSize);
const totalCssGzipBytes = await totalSize(cssFiles, assetGzipSize);
const initialJsGzipBytes = await totalSize(initialJsFiles, assetGzipSize);
const initialCssGzipBytes = await totalSize(initialCssFiles, assetGzipSize);
const lazyJsBytes = await totalSize(lazyJsFiles, assetSize);
const largestJsChunkBytes = Math.max(
  ...(await Promise.all(jsFiles.map(assetSize))),
);

if (totalJsBytes > MAX_PUBLIC_JS_BYTES) {
  throw new Error(
    `Public JavaScript budget exceeded: ${totalJsBytes} > ${MAX_PUBLIC_JS_BYTES} bytes.`,
  );
}

if (initialJsBytes > MAX_INITIAL_JS_BYTES) {
  throw new Error(
    `Initial JavaScript budget exceeded: ${initialJsBytes} > ${MAX_INITIAL_JS_BYTES} bytes.`,
  );
}

if (largestJsChunkBytes > MAX_SINGLE_JS_CHUNK_BYTES) {
  throw new Error(
    `Single JavaScript chunk budget exceeded: ${largestJsChunkBytes} > ${MAX_SINGLE_JS_CHUNK_BYTES} bytes.`,
  );
}

if (totalJsGzipBytes > MAX_PUBLIC_JS_GZIP_BYTES) {
  throw new Error(
    `Public gzipped JavaScript budget exceeded: ${totalJsGzipBytes} > ${MAX_PUBLIC_JS_GZIP_BYTES} bytes.`,
  );
}

if (initialJsGzipBytes > MAX_INITIAL_JS_GZIP_BYTES) {
  throw new Error(
    `Initial gzipped JavaScript budget exceeded: ${initialJsGzipBytes} > ${MAX_INITIAL_JS_GZIP_BYTES} bytes.`,
  );
}

if (totalCssBytes > MAX_PUBLIC_CSS_BYTES) {
  throw new Error(
    `Public CSS budget exceeded: ${totalCssBytes} > ${MAX_PUBLIC_CSS_BYTES} bytes.`,
  );
}

if (initialCssBytes > MAX_INITIAL_CSS_BYTES) {
  throw new Error(
    `Initial CSS budget exceeded: ${initialCssBytes} > ${MAX_INITIAL_CSS_BYTES} bytes.`,
  );
}

if (totalCssGzipBytes > MAX_PUBLIC_CSS_GZIP_BYTES) {
  throw new Error(
    `Public gzipped CSS budget exceeded: ${totalCssGzipBytes} > ${MAX_PUBLIC_CSS_GZIP_BYTES} bytes.`,
  );
}

if (initialCssGzipBytes > MAX_INITIAL_CSS_GZIP_BYTES) {
  throw new Error(
    `Initial gzipped CSS budget exceeded: ${initialCssGzipBytes} > ${MAX_INITIAL_CSS_GZIP_BYTES} bytes.`,
  );
}

for (const file of jsFiles) {
  const fileContent = await readFile(path.join(assets, file), "utf8");

  for (const marker of forbiddenMarkers) {
    if (fileContent.includes(marker)) {
      throw new Error(
        `Public bundle leaked guarded evidence code marker "${marker}" in ${file}.`,
      );
    }
  }
}

console.log(
  [
    "Public build validated:",
    `initial JS ${initialJsBytes} bytes / ${initialJsGzipBytes} gzip`,
    `total JS ${totalJsBytes} bytes / ${totalJsGzipBytes} gzip`,
    `largest JS chunk ${largestJsChunkBytes} bytes`,
    `lazy JS ${lazyJsFiles.length} chunk(s) / ${lazyJsBytes} bytes`,
    `initial CSS ${initialCssBytes} bytes / ${initialCssGzipBytes} gzip`,
    `total CSS ${totalCssBytes} bytes / ${totalCssGzipBytes} gzip`,
    "installable offline shell present",
    "no guarded evidence markers",
  ].join("; "),
);
