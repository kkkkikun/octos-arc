import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-6-3-4 Submit a Pull Request Review
// seed (stage-3): non-author reviewer pr-reviewer with no prior effective
// decision; "Reviewable onboarding PR" for Approve and the separate
// "Change request onboarding PR" for Request changes. The review form's
// optional summary field is unnamed by the doc ("summary/comment field"),
// so the fill tries the summary then comment label.

async function fillReviewSummary(page: any, text: string): Promise<void> {
  for (const label of ['Summary', 'Review summary', 'Comment']) {
    const pattern = h.rxContains(label);
    const candidates = [
      page.getByLabel(pattern).first(),
      page.getByRole('textbox', { name: pattern }).first(),
      page.getByPlaceholder(pattern).first(),
    ];
    for (const field of candidates) {
      if (await field.isVisible().catch(() => false)) {
        await field.fill(text);
        return;
      }
    }
  }
  await h.fillField(page, 'Comment', text);
}

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 1', async ({ page }) => {
  await h.signInAs(page, h.SEED.prReviewer);
  await h.openPullRequest(page, h.SEED.prReviewable);
  await h.clickNamed(page, 'Files changed');
  await h.clickNamed(page, 'Review changes');
  await h.clickNamed(page, 'Approve');
  await h.clickNamed(page, 'Submit review');
  await h.expectVisible(page, 'Approved');
});

test('REQ-6-3-4: Submit a Pull Request Review - Scenario 2', async ({ page }) => {
  const summary = 'pw-review-' + h.uniqueSuffix();
  await h.signInAs(page, h.SEED.prReviewer);
  await h.openPullRequest(page, h.SEED.prChangeRequest);
  await h.clickNamed(page, 'Files changed');
  await h.clickNamed(page, 'Review changes');
  await fillReviewSummary(page, summary);
  await h.clickNamed(page, 'Request changes');
  await h.clickNamed(page, 'Submit review');
  await h.expectVisible(page, 'Changes requested');
  await h.expectVisible(page, summary);
  await h.reload(page);
  await h.expectVisible(page, 'Changes requested');
});
