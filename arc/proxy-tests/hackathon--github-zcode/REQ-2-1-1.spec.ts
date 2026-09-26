import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-1-1 Browse Organization Repositories
// seed: organization Acme Demo, repository acme-docs, member bob-reviewer, team frontend-team.
// Scenario 1 allows a visitor OR a signed-in member; these tests use the signed-in member
// variant (the only navigation path the requirements document). The visitor-only private-
// repository clauses therefore stay covered by REQ-3-1 and REQ-3-3, which name the private repo.

test('REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openOrgRepositories(page);
  await h.fillField(page, 'Find a repository', h.SEED.repo);
  await h.expectVisible(page, h.SEED.repo);
  const visibilityFilter = page.getByRole('combobox', { name: /visibility|type|filter/i }).first();
  if (await visibilityFilter.isVisible({ timeout: 500 }).catch(() => false)) {
    await visibilityFilter.selectOption({ label: 'Public' });
  } else {
    await (await h.resolveNamed(page, h.rx('Public'))).click();
  }
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  await h.expectVisible(page, 'Acme Demo/acme-docs');
  await h.reload(page);
  await h.expectVisible(page, 'Acme Demo/acme-docs');
});

test('REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openOrgRepositories(page);
  await h.expectVisible(page, 'Find a repository');
  await h.expectVisible(page, h.SEED.repo);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.repo);
});
