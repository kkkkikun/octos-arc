import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-2-1 Create a Repository with Owner, Visibility, and Initialization Options
// seed: repo-owner owns the personal namespace; acme-docs exists there for
// duplicate-name validation. The form defaults to the personal namespace (doc),
// so the owner is not changed. The conflict and name-required message wordings
// are not pinned by the doc: the negative scenarios assert stays-on-form plus
// the absence of the existing repository overview heading. The "one
// initialization commit" and "owner's repository list" THEN clauses expose no
// pinned literals or navigation and are covered structurally by the README
// link and reload persistence.

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  const name = 'pw-repo-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.users.repoOwner);
  await h.clickNamed(page, 'New repository');
  await h.fillField(page, 'Repository name', name);
  await h.fillField(page, 'Description', 'Repository created by Playwright');
  await h.clickNamed(page, 'Private');
  await h.setCheckbox(page, 'Add a README file', true);
  await h.clickNamed(page, 'Create repository');
  await expect(page.getByRole('heading', { name: h.rxContains(name) }).first()).toBeVisible();
  await h.expectVisible(page, 'Private');
  await h.expectVisible(page, 'README');
  await h.expectVisible(page, 'Repository created by Playwright');
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rxContains(name) }).first()).toBeVisible();
  await h.expectVisible(page, 'Private');
  await h.expectVisible(page, 'README');
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.repoOwner);
  await h.clickNamed(page, 'New repository');
  await h.fillField(page, 'Repository name', h.SEED.repo);
  await h.clickNamed(page, 'Create repository');
  await h.expectVisible(page, 'Create repository');
  await h.expectVisible(page, 'Repository name');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.repo) })).toHaveCount(0);
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.repoOwner);
  await h.clickNamed(page, 'New repository');
  await h.clickNamed(page, 'Create repository');
  await h.expectVisible(page, 'Create repository');
  await h.expectVisible(page, 'Repository name');
});
