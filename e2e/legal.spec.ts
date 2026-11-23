import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { legal, privacy, terms } from "../src/messages/legal";
import { shell } from "../src/messages/shell";
import { saveScreen } from "./screens";

// The privacy and terms pages and the footer that links to them on every page
// (FR-SYS-03, WP-6.3), on the production build.

// 320 px is the narrowest width NFR-A11Y-05 names; the rest are the screenshot widths.
const WIDTHS = [320, 375, 768, 1280];
const TARGET = 44;
const PAGES = [
  { path: "/privacy", content: privacy, screen: "privacy" },
  { path: "/terms", content: terms, screen: "terms" },
] as const;

for (const { path, content } of PAGES) {
  test(`[FR-SYS-03] ${path} answers 200 with its title, date and sections`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(`${content.title} | ${shell.productName}`);
    await expect(page.getByRole("heading", { level: 1, name: content.title })).toBeVisible();
    await expect(page.getByText(`${legal.updatedLabel} ${content.updated.text}`)).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(
      content.sections.map((section) => section.heading),
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      content.description,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      "href",
      new RegExp(`${path}$`),
    );
    // Legal pages are indexed (docs/spec/03-experience.md section 3).
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
  });
}

// Every kind of page the site has today: the legal pages and the not-found page.
for (const path of ["/privacy", "/terms", "/no-such-page"]) {
  test(`[FR-SYS-03] the footer on ${path} links to both legal pages`, async ({ page }) => {
    await page.goto(path);
    const footer = page.getByRole("contentinfo");
    await expect(footer).toBeVisible();
    await expect(footer.getByRole("link")).toHaveText([shell.footer.privacy, shell.footer.terms]);
    await footer.getByRole("link", { name: shell.footer.terms }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { level: 1, name: terms.title })).toBeVisible();
    await page.getByRole("contentinfo").getByRole("link", { name: shell.footer.privacy }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { level: 1, name: privacy.title })).toBeVisible();
  });
}

test("[NFR-A11Y-03] the footer links are reached by keyboard after the page content", async ({
  page,
}) => {
  await page.goto("/privacy");
  const footer = page.getByRole("contentinfo");
  const privacyLink = footer.getByRole("link", { name: shell.footer.privacy });
  const termsLink = footer.getByRole("link", { name: shell.footer.terms });
  // Skip link, wordmark, then the footer: the privacy page has no other control.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(privacyLink).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(termsLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/terms$/);
  await expect(page.getByRole("heading", { level: 1, name: terms.title })).toBeVisible();
});

for (const { path, content } of PAGES) {
  test(`[FR-SYS-03] the footer marks ${path} as the current page`, async ({ page }) => {
    await page.goto(path);
    const current = page.getByRole("contentinfo").locator('[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await expect(current).toHaveAttribute("href", path);
    await expect(page.getByRole("heading", { level: 1, name: content.title })).toBeVisible();
  });
}

test("[FR-SYS-03] the terms link to the privacy policy", async ({ page }) => {
  const links = terms.sections.flatMap((section) =>
    section.blocks.flatMap((block) => (block.kind === "link" ? [block] : [])),
  );
  for (const link of links) {
    await page.goto("/terms");
    await page.getByRole("main").getByRole("link", { name: link.label }).click();
    await expect(page).toHaveURL(new RegExp(`${link.href}$`));
  }
  expect(links).toHaveLength(1);
  await expect(page).toHaveURL(/\/privacy$/);
});

for (const width of WIDTHS) {
  for (const { path, screen } of PAGES) {
    test(`[NFR-A11Y-02] ${path} has no axe violation at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
      await saveScreen(page, screen, width);
    });

    test(`[NFR-A11Y-05] ${path} does not scroll sideways at ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
    });
  }

  test(`[NFR-A11Y-06] the footer links are at least 44 px at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/privacy");
    for (const link of await page.getByRole("contentinfo").getByRole("link").all()) {
      const box = await link.boundingBox();
      const name = await link.textContent();
      expect(box?.width, `${name} width`).toBeGreaterThanOrEqual(TARGET);
      expect(box?.height, `${name} height`).toBeGreaterThanOrEqual(TARGET);
    }
  });
}
