import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-2-1 Create a Repository Issue
// seed: signed-in user with issue-write permission on acme-docs; "New issue" is a link

test('REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  const title = 'pw-issue-' + h.uniqueSuffix();
  await h.signIn(page);
  await h.openRepoIssues(page, h.SEED.repo);
  await expect(page.getByRole('link', { name: h.rx('New issue') }).first()).toBeVisible();
  await page.getByRole('link', { name: h.rx('New issue') }).first().click();
  await h.fillField(page, 'Title', title);
  await h.fillField(page, 'Description', 'Created by Playwright.');
  await h.clickNamed(page, 'Submit new issue');
  await expect(page.getByRole('heading', { name: h.rx(title) })).toBeVisible();
  await expect(page.getByText(h.rx('Open')).first()).toBeVisible();
  await h.expectVisible(page, 'Created by Playwright.');
  await page.goBack();
  await h.expectVisible(page, title);
});

test('REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openRepoIssues(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('New issue') }).first().click();
  await h.fillField(page, 'Title', '   ');
  await h.clickNamed(page, 'Submit new issue');
  await h.expectVisible(page, 'Title is required');
  await h.expectVisible(page, 'Title');
});
