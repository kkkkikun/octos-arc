// Observe only contexts the test itself requests. Never alter application handlers or assertions.
import { test } from '@playwright/test';
export function register() {
  test.use({ context: async ({ context }, use) => {
    let remaining = 8;
    const listeners = new Map();
    const attach = page => {
      if (listeners.has(page)) return;
      const onError = error => {
        if (remaining-- > 0) console.error('__OCTOS_PAGE_ERROR__' + JSON.stringify(String(error.stack || error).slice(0, 1600)));
      };
      listeners.set(page, onError);
      page.on('pageerror', onError);
    };
    context.pages().forEach(attach);
    context.on('page', attach);
    try { await use(context); }
    finally {
      context.off('page', attach);
      for (const [page, listener] of listeners) page.off('pageerror', listener);
    }
  } });
}
