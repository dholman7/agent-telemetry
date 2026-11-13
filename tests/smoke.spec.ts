import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function seriousViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(" ")}`);
}

const PAGES = [
  { path: "/", heading: /./ },
  { path: "/extraction/", heading: /How well Claude reads vendor documents/ },
  { path: "/attacks/", heading: /Prompt injection, measured/ },
];

for (const { path, heading } of PAGES) {
  test(`${path} renders and has no serious accessibility violations`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole("heading", { level: 1 })).toHaveText(heading);
    expect(await seriousViolations(page)).toEqual([]);
  });
}

test("a run's page opens from the overview, with its trials", async ({ page }) => {
  await page.goto("/");
  const first = page.locator('a[href*="/runs/"]').first();
  const name = (await first.innerText()).trim();

  await first.click();

  await expect(page.getByRole("heading", { level: 1 })).toContainText(name.split("\n")[0]);
  await expect(page.getByText("Trials succeeded").first()).toBeVisible();
  expect(await seriousViolations(page)).toEqual([]);
});
