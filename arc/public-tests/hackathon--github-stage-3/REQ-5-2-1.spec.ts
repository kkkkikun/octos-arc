import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-2-1 Create a Repository Issue
// seed (stage-3): issue-author account (issue-author@example.test /
// Valid-password-123!) with issue-create permission on public repo acme-docs.
// "New issue" is a link; the form has Title/Description and "Submit new issue".
// The doc pins only "a title-required validation message"; the stage-2 product
// wording is "Title is required", so the assertion accepts any title+required
// phrasing.

test('REQ-5-2-1: Create a Repository Issue - Scenario 1', async ({ page }) => {
  const title = 'pw-issue-' + h.uniqueSuffix();
  const body = 'Created by Playwright.';
  await h.signInAs(page, h.SEED.issueAuthor);
  await h.openRepoIssues(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('New issue') }).first().click();
  await h.fillField(page, 'Title', title);
  await h.fillField(page, 'Description', body);
  await h.clickNamed(page, 'Submit new issue');
  await expect(page.getByRole('heading', { name: h.rx(title) })).toBeVisible();
  await h.expectVisible(page, body);
  await h.openRepoIssues(page, h.SEED.repo);
  await h.expectVisible(page, title);
});

test('REQ-5-2-1: Create a Repository Issue - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.issueAuthor);
  await h.openRepoIssues(page, h.SEED.repo);
  await page.getByRole('link', { name: h.rx('New issue') }).first().click();
  await h.fillField(page, 'Title', '   ');
  await h.clickNamed(page, 'Submit new issue');
  await h.expectVisible(page, /title.{0,32}required|required.{0,32}title/i);
  // success opens the new issue detail page, so the still-visible submit
  // button is the observable for "no new issue is created"
  await h.expectVisible(page, 'Submit new issue');
});
