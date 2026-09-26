// REQ-3-2-1 Create a Repository / REQ-3-3 Overview / REQ-4-1 File browsing /
// REQ-3-2-3 Copy clone URL.
// Quotes:
//   REQ-3-2-1: form labels "Owner", "Repository name", "Description";
//   radios "Public"/"Private"; checkbox "Add a README file"; button
//   "Create repository"; empty name -> "Repository name is required";
//   duplicate -> "Repository name already exists"; success shows heading
//   with the new name, a visible Private marker, and a README file link.
//   REQ-3 FOLDER: overview titled "owner/repository name".
//   REQ-4-1: "The directory and file entries are links whose exact
//   accessible names are their respective directory and file names."
//   REQ-3-2-3: clone popover opened by button "Code"; tabs "HTTPS"/"SSH";
//   "Copy clone URL" writes the selected value and displays "Copied".
import { test, expect } from '@playwright/test';
import * as h from './helpers';

test('REQ-3-2-1: create a private repo with README; overview and file page', async ({ page }) => {
  const username = h.uname('repo');
  await h.register(page, username, `${username}@example.test`);
  await h.signIn(page, username);
  const repo = `priv-${Date.now().toString(36)}`;
  await h.createRepository(page, repo, { private: true, readme: true });

  await expect(page.getByText('Private', { exact: true }).first()).toBeVisible();
  // README file link on the default branch
  const readme = page.getByRole('link', { name: 'README.md', exact: true });
  await expect(readme).toBeVisible();
  await readme.click();
  // file page displays the full path (REQ-4-1); README content itself is
  // implementation-defined, so assert the path rather than the body
  await expect(page.getByText('README.md', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('README.md', { exact: true }).first()).toBeVisible();
});

test('REQ-3-2-1: empty and duplicate names are rejected with exact messages', async ({ page }) => {
  const username = h.uname('repo');
  await h.register(page, username, `${username}@example.test`);
  await h.signIn(page, username);

  await h.gotoNewRepository(page);
  await page.getByRole('button', { name: 'Create repository' }).click();
  await h.expectText(page, 'Repository name is required');

  const repo = `dup-${Date.now().toString(36)}`;
  await page.getByLabel('Repository name', { exact: true }).fill(repo);
  await page.getByRole('button', { name: 'Create repository' }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`/${repo}$`) })).toBeVisible();

  // duplicate in the same personal namespace stays on the form
  await h.gotoNewRepository(page);
  await page.getByLabel('Repository name', { exact: true }).fill(repo);
  await page.getByRole('button', { name: 'Create repository' }).click();
  await h.expectText(page, 'Repository name already exists');
});

test('REQ-3-2-3: copy HTTPS and SSH clone URLs', async ({ page }) => {
  const username = h.uname('repo');
  await h.register(page, username, `${username}@example.test`);
  await h.signIn(page, username);
  const repo = `clone-${Date.now().toString(36)}`;
  await h.createRepository(page, repo, { readme: true });

  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  // the clone popover button is distinct from the navigation link "Code"
  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'HTTPS', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone URL' }).click();
  await h.expectText(page, 'Copied');
  const https = await page.evaluate(() => navigator.clipboard.readText());
  expect(https).toContain(`/${username}/${repo}`);
  expect(https.startsWith('http://') || https.startsWith('https://')).toBeTruthy();

  await page.getByRole('button', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'SSH', exact: true }).click();
  await page.getByRole('button', { name: 'Copy clone URL' }).click();
  const ssh = await page.evaluate(() => navigator.clipboard.readText());
  expect(ssh).toMatch(new RegExp(`^[^@/\\s]+@[^:\\s]+:${username}/${repo}\\.git$`));
});
