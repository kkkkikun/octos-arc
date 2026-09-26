import { test } from '@playwright/test';
import * as h from './helpers';

// requirement: REQ-4-4 Manage Repository Files Through the Web Interface
// seed: writable repository acme-docs on unprotected branch main

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 1', async ({ page }) => {
  const path = 'docs/guide.md';
  const message = 'Add ' + path;
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Add file');
  await h.clickNamed(page, 'Create new file');
  await h.fillField(page, 'File name', path);
  await h.fillField(page, 'File contents', 'Guide content created by Playwright.');
  await h.fillField(page, 'Commit message', message);
  await h.clickNamed(page, 'Commit changes');
  await h.expectVisible(page, 'Guide content created by Playwright.');
  await h.expectVisible(page, path);
  await h.reload(page);
  await h.expectVisible(page, 'Guide content created by Playwright.');
  await h.clickNamed(page, 'Commits');
  await h.expectVisible(page, message);
  await h.reload(page);
  await h.expectVisible(page, message);
});

test('REQ-4-4: Manage Repository Files Through the Web Interface - Scenario 2', async ({ page }) => {
  await h.signIn(page);
  await h.openRepo(page, h.SEED.repo);
  await h.clickNamed(page, 'Add file');
  await h.clickNamed(page, 'Create new file');
  await h.fillField(page, 'File name', '../invalid.md');
  await h.fillField(page, 'File contents', 'must not be saved');
  await h.clickNamed(page, 'Commit changes');
  await h.expectVisible(page, /Invalid file path|Commit message is required/i);
  // neither the file nor the commit exists
  await h.openRepo(page, h.SEED.repo);
  await h.expectAbsent(page, 'must not be saved');
});
