import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-3-2-2 Fork a Repository into Another Namespace
// seed: fork-user may read public repository acme-docs and create repositories
// in its personal namespace, which already contains the fork acme-docs-fork
// (Scenario 2). The fork form defaults to the personal namespace (doc), so
// only the name is edited. "Forked from <source>" may render as split nodes,
// so the marker and the source name are asserted separately. The "target
// owner's repository list" refresh and the "commits to the fork do not
// modify the source" clause expose no pinned literals and are not exercised.

test('REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 1', async ({ page }) => {
  const fork = 'pw-fork-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.users.forkUser);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Fork');
  await h.fillField(page, 'Repository name', fork);
  await h.clickNamed(page, 'Create fork');
  await expect(page.getByRole('heading', { name: h.rxContains(fork) }).first()).toBeVisible();
  await h.expectVisible(page, 'Forked from');
  await h.expectVisible(page, h.SEED.repo);
  await h.expectVisible(page, h.SEED.dir);
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rxContains(fork) }).first()).toBeVisible();
  await h.expectVisible(page, 'Forked from');
  await h.expectVisible(page, h.SEED.repo);
});

test('REQ-3-2-2: Fork a Repository into Another Namespace - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.forkUser);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Fork');
  await h.fillField(page, 'Repository name', h.SEED.forkName);
  await h.clickNamed(page, 'Create fork');
  await h.expectVisible(page, 'Repository name');
  await expect(page.getByRole('heading', { name: h.rxContains(h.SEED.forkName) })).toHaveCount(0);
});
