import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { applyGuardedBuildBrandingHtml } from "../scripts/guarded-build-branding.mjs";

const legacyHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="theme-color" content="#070810" />
    <meta
      name="description"
      content="Pulse Counter — a polished React micro-interaction case study focused on motion, accessibility and proportional architecture."
    />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <title>Pulse Counter — Interaction Lab</title>
  </head>
  <body><div id="root"></div></body>
</html>`;

describe("guarded shopping build branding", () => {
  it("replaces legacy Pulse identity without changing unrelated document content", () => {
    const branded = applyGuardedBuildBrandingHtml(legacyHtml, {
      title: "Shopping Budget Companion — Retention Beta",
      description:
        "Internal Shopping Budget Companion real-store retention beta with privacy-safe local evidence.",
    });

    expect(branded).toContain(
      "<title>Shopping Budget Companion — Retention Beta</title>",
    );
    expect(branded).toContain(
      'content="Internal Shopping Budget Companion real-store retention beta with privacy-safe local evidence."',
    );
    expect(branded).toContain(
      '<meta name="theme-color" content="#f5f3ee" />',
    );
    expect(branded).toContain(
      '<meta name="robots" content="noindex,nofollow,noarchive" />',
    );
    expect(branded).toContain(
      '<meta name="application-name" content="Shopping Budget Companion" />',
    );
    expect(branded).toContain(
      '<link rel="icon" type="image/svg+xml" href="./shopping-mark.svg" />',
    );
    expect(branded).not.toContain("Pulse Counter — Interaction Lab");
    expect(branded).not.toContain('href="/favicon.svg"');
    expect(branded).toContain('<div id="root"></div>');
  });

  it("fails closed when the expected legacy shell changes unexpectedly", () => {
    expect(() =>
      applyGuardedBuildBrandingHtml("<html></html>", {
        title: "Shopping Budget Companion — QA",
        description: "Internal QA.",
      }),
    ).toThrow(/could not find expected title/i);
  });

  it("keeps the public source shell on Pulse identity until the release switch", async () => {
    const sourceIndex = await readFile(
      resolve(process.cwd(), "index.html"),
      "utf8",
    );

    expect(sourceIndex).toContain(
      "<title>Pulse Counter — Interaction Lab</title>",
    );
    expect(sourceIndex).toContain('href="/favicon.svg"');
    expect(sourceIndex).not.toContain('href="./shopping-mark.svg"');
  });

  it("keeps the provisional shopping mark aligned with the remaining-room identity", async () => {
    const mark = await readFile(
      resolve(process.cwd(), "public/shopping-mark.svg"),
      "utf8",
    );

    expect(mark).toContain('viewBox="0 0 64 64"');
    expect(mark).toContain('fill="#315f4f"');
    expect(mark).toContain('stroke="#fffdf9"');
    expect(mark).not.toMatch(/linearGradient|radialGradient/i);
    expect(mark).not.toContain("#69f7ff");
    expect(mark).not.toContain("#9a7cff");
    expect(mark).not.toContain("#ff6eb6");
    expect(mark).not.toContain("€");
    expect(mark).not.toContain(">+<");
  });
});
