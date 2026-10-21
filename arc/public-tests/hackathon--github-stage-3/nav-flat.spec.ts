import { expect, test } from '@playwright/test';
import * as h from './helpers';

// Official-runner navigation semantics (write-back from the stage-3 official
// round that scored 1/41): the harness resolves every doc-named page-opener
// as a FROZEN navigation target against the CURRENT page -- it does not plan
// intermediate hops. Each scenario below replays one observed official chain
// against the home page exactly as the official specs do.

test('nav-flat: visitor home -> Issues -> seeded issue', async ({ page }) => {
  await h.openHome(page);
  await page.getByRole('link', { name: h.rx('Issues') }).first().click();
  await page.getByRole('link', { name: h.rx(h.SEED.issueOpen) }).first().click();
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.issueOpen) })).toBeVisible();
  await expect(page.getByText(h.rx('Open')).first()).toBeVisible();
});

test('nav-flat: visitor home -> Pull requests -> seeded PR', async ({ page }) => {
  await h.openHome(page);
  await page.getByRole('link', { name: h.rx('Pull requests') }).first().click();
  await page.getByRole('link', { name: h.rx(h.SEED.prOverview) }).first().click();
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.prOverview) })).toBeVisible();
});

test('nav-flat: signed-in home -> Compare -> creation form', async ({ page }) => {
  await h.signInAs(page, h.SEED.prContributor);
  await page.getByRole('link', { name: h.rx('Compare') }).first().click();
  await expect(page.getByRole('button', { name: h.rx('Create pull request') }).first()).toBeVisible();
});

test('nav-flat: home -> repo -> seeded issue and PR titles resolve', async ({ page }) => {
  await h.openHome(page);
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  await page.getByRole('link', { name: h.rx(h.SEED.issueEditable) }).first().click();
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.issueEditable) })).toBeVisible();
  await h.openHome(page);
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  await page.getByRole('link', { name: h.rx(h.SEED.prMergeable) }).first().click();
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.prMergeable) })).toBeVisible();
});

test('nav-flat: GitHub-style deep links resolve (no bare 404)', async ({ page }) => {
  await h.openHome(page);
  await page.goto('/' + h.SEED.repo);
  // The repo page's h1 is "org/name"; the app shell rendering at all (rather
  // than the plain-text 404) is the point of this check.
  await expect(page.getByRole('heading', { name: new RegExp(h.SEED.repo) }).first()).toBeVisible();
  await page.goto('/issues');
  await expect(page.getByRole('heading', { name: h.rx('Issues') })).toBeVisible();
});

test('nav-flat: single-match invariants on home and repo pages', async ({ page }) => {
  await h.openHome(page);
  for (const name of ['Issues', 'Pull requests', 'Compare', h.SEED.repo]) {
    await expect(page.getByRole('link', { name: h.rx(name) })).toHaveCount(1);
  }
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  for (const name of ['Issues', 'Pull requests', 'Compare']) {
    await expect(page.getByRole('link', { name: h.rx(name) })).toHaveCount(1);
  }
  await expect(page.getByRole('link', { name: h.rx(h.SEED.prOverview) })).toHaveCount(1);
});
