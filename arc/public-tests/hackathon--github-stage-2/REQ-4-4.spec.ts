import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-4 Manage Repository Files Through the Web Interface
// seed: public repository file-management-demo; file-contributor has Write
// permission on it. The generated pw-file-<unique suffix>.md path is unused.
// The description pins the literals "Invalid file path" and "Commit message
// is required"; the "nonempty content" wording leaves the content value free,
// so the created file view is asserted against the exact submitted value.

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  const file = 'pw-file-' + h.uniqueSuffix() + '.md';
  const content = 'File content created by Playwright.';
  const message = 'Add ' + file;
  await h.signInAs(page, h.SEED.users.fileContributor);
  await h.openRepo(page, h.SEED.fileRepo);
  await h.clickNamed(page, 'Add file');
  await h.clickNamed(page, 'Create new file');
  await h.fillField(page, 'File name', file);
  await h.fillField(page, 'File contents', content);
  await h.fillField(page, 'Commit message', message);
  await h.clickNamed(page, 'Commit changes');
  await h.expectVisible(page, content);
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, message);
});

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  await h.signInAs(page, h.SEED.users.fileContributor);
  await h.openRepo(page, h.SEED.fileRepo);
  await h.clickNamed(page, 'Add file');
  await h.clickNamed(page, 'Create new file');
  await h.fillField(page, 'File name', '../invalid.md');
  await h.fillField(page, 'File contents', 'must not be saved');
  await h.clickNamed(page, 'Commit changes');
  await h.expectVisible(page, /Invalid file path|Commit message is required/i);
  await h.openRepo(page, h.SEED.fileRepo);
  await h.expectAbsent(page, 'must not be saved');
});
