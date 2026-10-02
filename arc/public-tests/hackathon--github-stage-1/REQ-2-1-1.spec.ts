import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-2-1-1 Browse Organization Repositories
// seed: organization Acme Demo with public repository acme-docs and private
// repository secret-research; fresh unauthenticated visitor session (public
// organization page).

test('REQ-2-1-1: Browse Organization Repositories - Scenario 1', async ({ page }) => {
  await h.openOrganizationAsVisitor(page, h.SEED.org);
  await h.clickNamed(page, 'Repositories');
  await h.fillField(page, 'Find a repository', h.SEED.repo);
  // Click the exact link named acme-docs.
  await page.getByRole('link', { name: h.rx(h.SEED.repo) }).first().click();
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) }).first()).toBeVisible();
  // Click the exact organization link Acme Demo and Repositories again.
  await page.getByRole('link', { name: h.rx(h.SEED.org) }).first().click();
  await h.clickNamed(page, 'Repositories');
  await expect(page.getByRole('link', { name: h.rx(h.SEED.repo) }).first()).toBeVisible();
});

test('REQ-2-1-1: Browse Organization Repositories - Scenario 2', async ({ page }) => {
  await h.openOrganizationAsVisitor(page, h.SEED.org);
  await h.clickNamed(page, 'Repositories');
  await h.fillField(page, 'Find a repository', h.SEED.privateRepo);
  // Filtering by the private repository name never exposes its link.
  await expect(page.getByRole('link', { name: h.rx(h.SEED.privateRepo) }).first()).toBeHidden();
});
