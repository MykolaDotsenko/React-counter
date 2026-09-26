import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const target = fileURLToPath(new URL("../fixtures/price-tag-1-29.mjpeg", import.meta.url));

const label = `<style>
body{margin:0;width:640px;height:480px;display:grid;place-items:center;background:#7d848a}
.tag{width:500px;padding:18px 24px;background:#ffe14d;border-radius:6px;font-family:"DejaVu Sans",Arial,sans-serif;color:#111}
.name{font-size:26px;font-weight:700}
.price{font-size:118px;font-weight:800;line-height:1.02;letter-spacing:-2px}
.price small{font-size:46px;margin-left:6px}
.unit{font-size:22px}
</style>
<div class="tag"><div class="name">Valio kevytmaito 1 l</div><div class="price">1,29<small>€</small></div><div class="unit">1,29 €/l</div></div>`;

const browser = await chromium.launch(
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE === undefined
    ? {}
    : { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE },
);
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
await page.setContent(label);
writeFileSync(target, await page.screenshot({ type: "jpeg", quality: 90 }));
await browser.close();
console.log(`Wrote ${target}`);
