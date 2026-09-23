import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const assets = path.join(root, "dist", "assets");

const MAX_PUBLIC_JS_BYTES = 430_000;
const MAX_PUBLIC_CSS_BYTES = 80_000;
const forbiddenMarkers = [
  "Retention Beta",
  "Local beta evidence",
  "Empirical Timing QA",
  "budget-cart:qa:retention-v1",
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
        `Public bundle leaked guarded QA/beta code marker "${marker}" in ${file}.`,
      );
    }
  }
}

console.log(
  `Public build validated: ${totalJsBytes} JS bytes, ${totalCssBytes} CSS bytes, no guarded evidence markers.`,
);
