import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-2-1 Create a Repository with Owner, Visibility, and Initialization Options
// seed: personal namespace of alice-dev already contains secret-research

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 1', async ({ page }) => {
  const name = 'pw-repo-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.clickNamed(page, 'New repository');
  await h.fillField(page, 'Repository name', name);
  await h.fillField(page, 'Description', 'Repository created by Playwright');
  await h.clickNamed(page, 'Private');
  await h.setCheckbox(page, 'Add a README file', true);
  await h.clickNamed(page, 'Create repository');
  await h.expectVisible(page, name);
  await h.expectVisible(page, 'Repository created by Playwright');
  await h.expectVisible(page, 'Private');
  await h.expectVisible(page, 'README.md');
  await h.reload(page);
  await h.expectVisible(page, name);
  await h.expectVisible(page, 'Private');
  await h.expectVisible(page, 'README.md');
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.clickNamed(page, 'New repository');
  await h.fillField(page, 'Repository name', h.SEED.privateRepo);
  await h.clickNamed(page, 'Create repository');
  await h.expectVisible(page, 'Create repository');
  await h.expectVisible(page, 'Repository name');
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.privateRepo) })).toHaveCount(0);
});

test('REQ-3-2-1: Create a Repository with Owner, Visibility, and Initialization Options - Scenario 3', async ({ page }) => {
  await h.signIn(page);
  await h.clickNamed(page, 'New repository');
  await h.clickNamed(page, 'Create repository');
  await h.expectVisible(page, 'Repository name');
  await h.expectVisible(page, 'Create repository');
});
