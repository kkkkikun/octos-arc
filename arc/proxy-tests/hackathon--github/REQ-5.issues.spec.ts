// REQ-5-2-1 Create an Issue / REQ-5-1-1 List and Filter / REQ-5-4 Close.
// Quotes:
//   REQ-5-2-1: "New issue" is a link on the Issues page; form fields "Title"
//   and "Description"; button "Submit new issue"; success shows "a heading
//   named exactly after the entered title and the exact saved description";
//   blank title displays "Title is required".
//   REQ-5-1-1: "A unique searchbox named “Search issues” filters as the user
//   types"; "Open" and "Closed" are links, not buttons or tabs; each result
//   title is a link whose exact accessible name is the title.
//   REQ-5-4: the detail page offers a "Close issue" button when Open and
//   "Reopen issue" when Closed; transitions display status text.
import { test, expect } from '@playwright/test';
import * as h from './helpers';

async function newIssue(page: import('@playwright/test').Page, title: string, description: string) {
  await h.repoNav(page, 'Issues');
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill(title);
  if (description) await page.getByLabel('Description', { exact: true }).fill(description);
  await page.getByRole('button', { name: 'Submit new issue' }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
}

async function setupRepoWithIssues(page: import('@playwright/test').Page, marker: string) {
  const username = h.uname('iss');
  await h.register(page, username, `${username}@example.test`);
  await h.signIn(page, username);
  const repo = `iss-${Date.now().toString(36)}`;
  await h.createRepository(page, repo, { readme: true });
  const open = `${marker} searchword open`;
  const closed = `${marker} searchword closed`;
  await newIssue(page, open, `Body of ${marker} open`);
  await newIssue(page, closed, `Body of ${marker} closed`);
  // close the second one (repo owner acts with Admin)
  await page.getByRole('button', { name: 'Close issue' }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
  return { username, repo, open, closed };
}

test('REQ-5-2-1: create an issue; blank title is rejected', async ({ page }) => {
  const username = h.uname('ni');
  await h.register(page, username, `${username}@example.test`);
  await h.signIn(page, username);
  const repo = `ni-${Date.now().toString(36)}`;
  await h.createRepository(page, repo, { readme: true });

  await h.repoNav(page, 'Issues');
  await page.getByRole('link', { name: 'New issue', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('   ');
  await page.getByRole('button', { name: 'Submit new issue' }).click();
  await h.expectText(page, 'Title is required');

  const title = `Created issue ${Date.now().toString(36)}`;
  await page.getByLabel('Title', { exact: true }).fill(title);
  const body = `Description body ${Date.now().toString(36)}`;
  await page.getByLabel('Description', { exact: true }).fill(body);
  await page.getByRole('button', { name: 'Submit new issue' }).click();
  await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText(body, { exact: true }).first()).toBeVisible();
  // list shows a title link with the same exact name
  await h.repoNav(page, 'Issues');
  await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
});

test('REQ-5-1-1: search filters as typed; Open/Closed links filter status', async ({ page }) => {
  const marker = `m${Date.now().toString(36)}`;
  const { open, closed } = await setupRepoWithIssues(page, marker);

  await h.repoNav(page, 'Issues');
  const search = page.getByRole('searchbox', { name: 'Search issues' });
  await expect(search).toBeVisible();
  await search.fill(marker);
  await expect(page.getByRole('link', { name: open, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: closed, exact: true })).toBeVisible();

  // "Open" and "Closed" are links; Open keeps only the open issue
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await expect(page.getByRole('link', { name: open, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: closed, exact: true })).toHaveCount(0);

  // after reload the filter context and matching result remain
  await page.reload();
  await expect(page.getByRole('link', { name: open, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: closed, exact: true })).toHaveCount(0);

  await page.getByRole('link', { name: 'Closed', exact: true }).click();
  await expect(page.getByRole('link', { name: closed, exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: open, exact: true })).toHaveCount(0);
});

test('REQ-5-4: close and reopen from the issue detail page', async ({ page }) => {
  const marker = `m${Date.now().toString(36)}`;
  const { open } = await setupRepoWithIssues(page, marker);

  await h.repoNav(page, 'Issues');
  const search = page.getByRole('searchbox', { name: 'Search issues' });
  await search.fill(open);
  await page.getByRole('link', { name: 'Open', exact: true }).click();
  await page.getByRole('link', { name: open, exact: true }).click();
  await expect(page.getByRole('heading', { name: open, exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Close issue' }).click();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText('Closed', { exact: true }).first()).toBeVisible();

  await page.getByRole('button', { name: 'Reopen issue' }).click();
  await expect(page.getByText('Open', { exact: true }).first()).toBeVisible();
});
