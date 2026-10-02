import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-5-1-2 View an Issue and Its Discussion
// seed (stage-3): public repo acme-docs, Open issue "Improve onboarding" with
// description "Describe the onboarding improvement." and discussion/activity
// content. Readable without sign-in; heading carries the title without number.

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 1', async ({ page }) => {
  await h.openIssue(page, h.SEED.issueOpen);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.issueOpen) })).toBeVisible();
  await h.expectVisible(page, h.SEED.issueDescription);
  await h.expectStatus(page, 'Open');
  await h.expectVisible(page, /Comment|Activity/i);
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 2', async ({ page }) => {
  await h.openIssue(page, h.SEED.issueOpen);
  await h.reload(page);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.issueOpen) })).toBeVisible();
  await h.expectVisible(page, h.SEED.issueDescription);
});

test('REQ-5-1-2: View an Issue and Its Discussion - Scenario 3', async ({ page }) => {
  await h.openIssue(page, h.SEED.issueOpen);
  await h.openHome(page);
  await h.openIssue(page, h.SEED.issueOpen);
  await expect(page.getByRole('heading', { name: h.rx(h.SEED.issueOpen) })).toBeVisible();
  await h.expectStatus(page, 'Open');
});
