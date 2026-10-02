import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-1 Protect Branches with Review and Status-Check Requirements
// seed (stage-3): repo branch-protection-demo with branch main; Admin
// protection-admin and non-Admin protection-viewer accounts; Open PR
// "Protection status onboarding PR" whose Checks area holds `test` pending.
// The doc allows "Create" or "Save changes" (rule form) and "Save" or
// "Update" (check status); the THEN literals are `main`, `1 approval`, and
// the status-check test requirement.

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.protectionAdmin);
  await h.openRepoSettings(page, h.SEED.protectionRepo);
  await h.clickNamed(page, 'Branches');
  await h.clickNamed(page, 'Add branch protection rule');
  await h.fillField(page, 'Branch name pattern', h.SEED.branchMain);
  await h.setCheckbox(page, 'Require 1 approval', true);
  await h.setCheckbox(page, 'Require status check test', true);
  await h.clickFirstAvailable(page, ['Create', 'Save changes']);
  await h.reload(page);
  // the Branches page must show the persisted rule; re-navigate only if the
  // reload landed elsewhere (direct navigation is equally valid per the doc)
  if (!(await page.getByText(/1 approval/i).first().isVisible().catch(() => false))) {
    await h.openRepoSettings(page, h.SEED.protectionRepo);
    await h.clickNamed(page, 'Branches');
  }
  await h.expectVisible(page, h.SEED.branchMain);
  await h.expectVisible(page, '1 approval');
  await h.expectVisible(page, /status.check test/i);
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.protectionViewer);
  await h.openRepo(page, h.SEED.protectionRepo);
  // "follows Settings and Branches when those links are available": a
  // compliant app may hide either link for a non-Admin -- guard the clicks,
  // assert the entry button is absent.
  const settings = page.getByRole('link', { name: h.rx('Settings') }).first();
  if (await settings.isVisible().catch(() => false)) {
    await settings.click();
    const branches = page.getByRole('link', { name: h.rx('Branches') }).first();
    if (await branches.isVisible().catch(() => false)) {
      await branches.click();
    }
  }
  await h.expectAbsent(page, 'Add branch protection rule');
});

test('REQ-6-1: Protect Branches with Review and Status-Check Requirements - Scenario 3', async ({ page }) => {
  await h.signInAs(page, h.SEED.protectionAdmin);
  await h.openPullRequest(page, h.SEED.prProtection, h.SEED.protectionRepo);
  await h.clickNamed(page, 'Checks');
  await h.expectVisible(page, 'pending');
  for (const label of ['test status', h.SEED.check]) {
    try {
      await h.selectLabeled(page, label, 'success');
      break;
    } catch {
      // try the alternate naming of the check combobox
    }
  }
  await h.clickFirstAvailable(page, ['Save', 'Update']);
  await h.expectVisible(page, 'success');
  await h.expectVisible(page, h.SEED.protectionAdmin.username);
  await h.reload(page);
  await h.expectVisible(page, 'success');
});
