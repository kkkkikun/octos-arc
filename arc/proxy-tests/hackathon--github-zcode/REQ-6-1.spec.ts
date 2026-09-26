import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-1 Protect Branches with Review and Status-Check Requirements
// seed: Admin alice-dev, non-Admin viewer, Open PR targeting protected main with test check pending

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await h.signIn(page);
  await h.openRepoSettings(page, h.SEED.repo);
  await h.clickNamed(page, 'Branches');
  await h.clickNamed(page, 'Add branch protection rule');
  await h.fillField(page, 'Branch name pattern', h.SEED.branchMain);
  await h.setCheckbox(page, 'Require 1 approval', true);
  await h.setCheckbox(page, 'Require status check test', true);
  await h.clickNamed(page, 'Create');
  await h.expectVisible(page, h.rx(h.SEED.branchMain));
  await h.reload(page);
  await h.expectVisible(page, h.rx('1 approval'));
  await h.expectVisible(page, h.rx('Require status check test'));
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Checks');
  await h.expectVisible(page, 'test: pending');
  await h.selectLabeled(page, 'test status', 'success');
  await h.clickNamed(page, 'Save');
  await h.expectVisible(page, 'test: success');
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  const user = 'pw-viewer-' + h.uniqueSuffix();
  await h.registerAccount(page, user, user + '@example.test', h.SEED.alice.password);
  await h.signInOnPage(page, user + '@example.test', h.SEED.alice.password);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Settings');
  await h.clickNamed(page, 'Branches');
  await h.expectAbsent(page, 'Add branch protection rule');
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await h.signIn(page);
  await h.openPullRequest(page, h.SEED.prOpen);
  await h.clickNamed(page, 'Checks');
  await h.expectVisible(page, 'test: pending');
  await h.selectLabeled(page, 'test status', 'success');
  await h.clickNamed(page, 'Save');
  await h.expectVisible(page, 'test: success');
  await h.reload(page);
  await h.expectVisible(page, 'test: success');
});
