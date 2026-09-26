import { readFileSync } from "node:fs";
import path from "node:path";

const packageVersion = (rootDir, name) =>
  JSON.parse(
    readFileSync(path.join(rootDir, "node_modules", name, "package.json"), "utf8"),
  ).version;

export const PRICE_OCR_ASSET_SOURCES = [
  ["tesseract.js/dist/worker.min.js", "worker.min.js", 150_000],
  ["tesseract.js-core/tesseract-core-lstm.js", "tesseract-core-lstm.js", 120_000],
  ["tesseract.js-core/tesseract-core-lstm.wasm", "tesseract-core-lstm.wasm", 3_200_000],
  ["tesseract.js-core/tesseract-core-simd-lstm.js", "tesseract-core-simd-lstm.js", 120_000],
  ["tesseract.js-core/tesseract-core-simd-lstm.wasm", "tesseract-core-simd-lstm.wasm", 3_200_000],
  ["@tesseract.js-data/fin/4.0.0_best_int/fin.traineddata.gz", "lang/fin.traineddata.gz", 4_200_000],
];

export const priceOcrAssetDir = (rootDir) =>
  [
    "assets/ocr/tesseract",
    packageVersion(rootDir, "tesseract.js"),
    "core",
    packageVersion(rootDir, "tesseract.js-core"),
    "fin",
    packageVersion(rootDir, "@tesseract.js-data/fin"),
  ].join("-");

export const priceOcrAssets = (rootDir) => {
  const directory = priceOcrAssetDir(rootDir);

  return PRICE_OCR_ASSET_SOURCES.map(([source, target, maxBytes]) => ({
    source: path.join(rootDir, "node_modules", source),
    fileName: `${directory}/${target}`,
    maxBytes,
  }));
};
