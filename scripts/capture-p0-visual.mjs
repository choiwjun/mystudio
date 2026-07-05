import { chromium } from "@playwright/test";

const baseUrl = process.env.PAPERCLIP_BASE_URL ?? "http://127.0.0.1:3000";
const evidenceDir = ".omo/evidence/p0";
const viewports = [
  { name: "mobile", width: 375, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
];

const browser = await chromium.launch();
const results = [];

for (const viewport of viewports) {
  const page = await browser.newPage({ viewport });
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load");
  await page.waitForTimeout(300);
  const path = `${evidenceDir}/hq-${viewport.name}.png`;
  await page.screenshot({ path, fullPage: true });
  const metrics = await page.evaluate(() => {
    const body = document.body;
    const text = body.innerText;
    return {
      title: document.title,
      textLength: text.length,
      scrollWidth: body.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      hasHorizontalOverflow: body.scrollWidth > document.documentElement.clientWidth,
    };
  });
  results.push({ viewport, path, metrics });
  await page.close();
}

await browser.close();
console.log(JSON.stringify({ baseUrl, results }, null, 2));
