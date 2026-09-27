import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-2-2 Fork a Repository into Another Namespace
// seed: public repository acme-docs; existing name acme-docs-fork in the target personal namespace

test('REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  const fork = 'pw-fork-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Fork');
  await h.fillField(page, 'Repository name', fork);
  await h.clickNamed(page, 'Create fork');
  await h.expectVisible(page, fork);
  await h.expectVisible(page, 'Forked from ' + h.SEED.repo);
  await h.expectVisible(page, h.SEED.file);
  await h.reload(page);
  await h.expectVisible(page, fork);
  await h.expectVisible(page, 'Forked from ' + h.SEED.repo);
});

test('REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Fork');
  await h.fillField(page, 'Repository name', h.SEED.forkName);
  await h.clickNamed(page, 'Create fork');
  await h.expectVisible(page, 'Repository name');
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.forkName) })).toHaveCount(0);
});
