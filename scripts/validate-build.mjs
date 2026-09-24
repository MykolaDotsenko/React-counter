import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

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
const MAX_PUBLIC_CSS_BYTES = 80_000;
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

const totalSize = async (names) =>
  (
    await Promise.all(
      names.map(async (file) => (await stat(path.join(assets, file))).size),
    )
  ).reduce((sum, size) => sum + size, 0);

const totalJsBytes = await totalSize(jsFiles);
const totalCssBytes = await totalSize(cssFiles);

if (totalJsBytes > MAX_PUBLIC_JS_BYTES) {
  throw new Error(
    `Public JavaScript budget exceeded: ${totalJsBytes} > ${MAX_PUBLIC_JS_BYTES} bytes.`,
  );
}

if (totalCssBytes > MAX_PUBLIC_CSS_BYTES) {
  throw new Error(
    `Public CSS budget exceeded: ${totalCssBytes} > ${MAX_PUBLIC_CSS_BYTES} bytes.`,
  );
}

for (const file of jsFiles) {
  const content = await readFile(path.join(assets, file), "utf8");

  for (const marker of forbiddenMarkers) {
    if (content.includes(marker)) {
      throw new Error(
        `Public bundle leaked guarded evidence code marker "${marker}" in ${file}.`,
      );
    }
  }
}

console.log(
  `Public build validated: ${totalJsBytes} JS bytes, ${totalCssBytes} CSS bytes, installable offline shell present, no guarded evidence markers.`,
);
