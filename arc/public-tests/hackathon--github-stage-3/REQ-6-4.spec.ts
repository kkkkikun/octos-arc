import { expect, test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-4 Request or Remove Pull Request Reviewers
// seed (stage-3): Open PR "Reviewer request onboarding PR" authored by
// pr-author with no requested reviewer; eligible collaborator bob-reviewer.
// The THEN's "then is absent after removal" is anchored to the standalone
// username text and the `Remove bob-reviewer` button: timeline activity
// sentences that merely mention the username must not fail the check.

test('REQ-6-4: Request or Remove Pull Request Reviewers - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.prAuthor);
  await h.openPullRequest(page, h.SEED.prReviewerRequest);
  await h.clickNamed(page, 'Reviewers');
  await h.fillField(page, 'Search', h.SEED.member);
  await h.clickNamed(page, h.rx(h.SEED.member));
  await h.expectVisible(page, h.SEED.member);
  await h.reload(page);
  await h.expectVisible(page, h.SEED.member);
  await h.clickNamed(page, `Remove ${h.SEED.member}`);
  await h.reload(page);
  await expect(page.getByText(h.rx(h.SEED.member)).first()).toBeHidden();
  await expect(page.getByRole('button', { name: h.rx(`Remove ${h.SEED.member}`) })).toHaveCount(0);
  await h.expectVisible(page, h.SEED.prReviewerRequest);
});
