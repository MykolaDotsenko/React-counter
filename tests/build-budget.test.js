import { describe, expect, it } from "vitest";

import {
  extractInitialAssetPaths,
  toDistAssetPath,
} from "../scripts/build-budget.mjs";

describe("build budget asset classifier", () => {
  it("extracts the current Vite entry script and stylesheet behind a base path", () => {
    const html = `
      <script type="module" crossorigin src="/shopping-budget-companion/assets/index-abc.js"></script>
      <link rel="stylesheet" crossorigin href="/shopping-budget-companion/assets/index-def.css">
      <link rel="manifest" href="/shopping-budget-companion/manifest.webmanifest">
    `;

    expect(extractInitialAssetPaths(html)).toEqual({
      js: ["assets/index-abc.js"],
      css: ["assets/index-def.css"],
    });
  });

  it("includes modulepreload assets and tolerates attribute ordering plus query/hash suffixes", () => {
    const html = `
      <link href="./assets/vendor.js?v=1" crossorigin rel="modulepreload preload">
      <script src="assets/index.js#entry" defer type="module"></script>
      <link href="assets/index.css?v=2#theme" rel="stylesheet">
    `;

    expect(extractInitialAssetPaths(html)).toEqual({
      js: ["assets/index.js", "assets/vendor.js"],
      css: ["assets/index.css"],
    });
  });

  it("ignores remote assets and non-initial links/scripts", () => {
    const html = `
      <script src="/assets/legacy.js"></script>
      <script type="module" src="https://cdn.example.com/app.js"></script>
      <link rel="icon" href="/assets/icon.css">
      <link rel="prefetch" href="/assets/later.js">
      <link rel="stylesheet" href="//cdn.example.com/app.css">
    `;

    expect(extractInitialAssetPaths(html)).toEqual({
      js: [],
      css: [],
    });
  });

  it("normalizes supported local asset URLs and rejects unrelated URLs", () => {
    expect(toDistAssetPath("/shop/assets/app.js?x=1")).toBe(
      "assets/app.js",
    );
    expect(toDistAssetPath("./assets/app.css#v1")).toBe(
      "assets/app.css",
    );
    expect(toDistAssetPath("assets/app.js")).toBe("assets/app.js");
    expect(toDistAssetPath("/manifest.webmanifest")).toBeNull();
    expect(toDistAssetPath("https://example.com/assets/app.js")).toBeNull();
  });

  it("deduplicates repeated initial asset references", () => {
    const html = `
      <script type="module" src="/assets/index.js"></script>
      <link rel="modulepreload" href="/assets/index.js">
      <link rel="stylesheet" href="/assets/index.css">
      <link rel="stylesheet" href="/assets/index.css">
    `;

    expect(extractInitialAssetPaths(html)).toEqual({
      js: ["assets/index.js"],
      css: ["assets/index.css"],
    });
  });
});
