import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-2-1 View Repository Commit History
// seed: public repository acme-docs with commit message "Document search
// flow" authored by alice-dev; timestamps are relative ("ago"). A <time> or
// <span> never matches the probe ladder's button fallback, so the "ago"
// substring is asserted with getByText directly.

test('REQ-4-2-1: View Repository Commit History - Scenario 1', async ({ page }) => {
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, h.SEED.commitMessage);
  await h.expectVisible(page, h.SEED.commitAuthor);
  await expect(page.getByText(/ago/i).first()).toBeVisible();
});
