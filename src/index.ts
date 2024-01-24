import puppeteer from "puppeteer";
import * as fs from "fs";
import { join } from "path";

async function asyncFilter<T>(
  array: T[],
  predicate: (value: T, index: number, array: T[]) => Promise<boolean>
) {
  return Promise.all(array.map(predicate)).then((results) =>
    array.filter((_v, index) => results[index])
  );
}

(async () => {
  console.log("Removing old images...");
  fs.readdirSync(join(__dirname, "images")).forEach((file) => {
    if (file.endsWith(".png")) {
      fs.unlinkSync(join(__dirname, "images", file));
    }
  });
  console.log("✅ Done removing old images");

  console.log("Initiating puppeteer browser...");
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  await page.goto("https://getbootstrap.com/docs/5.3/components/buttons/");
  await page.setViewport({ width: 1080, height: 1024 });

  await page.waitForFunction("document.readyState === 'complete'");

  // wait for all initial animations to finish
  console.log("🤔 Awaiting animations...");
  await new Promise((r) => setTimeout(r, 5000));

  console.log("📷  Taking screenshots...");
  const tagButtons = await page.$$("button");
  const classButtons = await page.$$(".button");
  const buttonsSet = new Set();

  // filter buttons that have no content
  const filtered = await asyncFilter(
    [...classButtons, ...tagButtons],
    async (button) => {
      const hasContent =
        ((await button.evaluate((el) => el.textContent)) !== "" ||
          (await button.evaluate((el) => el.textContent))) !== " ";

      if (!hasContent) {
        return false;
      }

      return true;
    }
  );

  for (let i = 0; i < filtered.length; i++) {
    const button = filtered[i];
    const classes = (
      await button.evaluate((el) => el.classList.toString())
    )?.trim();
    const textContent = (await button.evaluate((el) => el.textContent))?.trim();

    // improve uniqueness
    const uniqueString = `${textContent} ${classes}`;

    // skip buttons that have already been screenshot
    if (buttonsSet.has(uniqueString) || !(await button.isVisible())) {
      continue;
    }

    buttonsSet.add(uniqueString);

    await button
      .screenshot({ path: join(__dirname, "images", `button-${i}.png`) })
      .catch((err) => {
        console.log(
          'Button not in page; "Might be a11n or in a modal or different viewport"'
        );
      });
  }

  await browser.close();

  console.log("✅ Done taking screenshots");
})();
