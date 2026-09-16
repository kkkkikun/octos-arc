// Observe only contexts the test itself requests. Never alter application handlers or assertions.
import { test } from '@playwright/test';
export function register() {
  test.use({ context: async ({ context }, use, testInfo) => {
    let remaining = 8;
    const listeners = new Map();
    // Shared by every page and by the teardown report below, so one page cannot
    // spend the whole budget and leave the others silent.
    const report = message => {
      if (remaining-- > 0) console.error('__OCTOS_PAGE_ERROR__' + JSON.stringify(String(message).slice(0, 1600)));
    };
    const attach = page => {
      if (listeners.has(page)) return;
      const onError = error => report(error.stack || error);
      // A generated app does most of its work over fetch/XHR, so a failing API
      // call is what empties a list; reporting navigations alone said nothing
      // about it. One line per distinct method+status+path: a view that reloads
      // would otherwise spend the whole budget on the same failure.
      const reported = new Set();
      const onResponse = response => {
        if (response.status() < 400) return;
        if (response.frame() !== page.mainFrame()) return;
        const request = response.request();
        // Keep routing evidence without credentials, query values or fragments.
        const url = new URL(response.url());
        const where = `${url.origin}${url.pathname}`;
        const line = request.isNavigationRequest()
          ? `Navigation HTTP ${response.status()} ${where}`
          : `Request HTTP ${response.status()} ${request.method()} ${where}`;
        if (reported.has(line)) return;
        reported.add(line);
        report(line);
      };
      // An app that catches its own failure renders a placeholder and throws
      // nothing, so `pageerror` never fires and only the symptom survives. Take
      // its error log, on a small budget of its own so ordinary chatter cannot
      // crowd out the page errors and failed requests above.
      let logged = 3;
      const onConsole = message => {
        const text = String(message.text());
        // The browser's own note for a failed request; `onResponse` already
        // reports those with their method, status and path.
        if (message.type() !== 'error' || text.startsWith('Failed to load resource')) return;
        if (reported.has(text) || logged-- <= 0) return;
        reported.add(text);
        report('Console error: ' + text);
      };
      listeners.set(page, { onError, onResponse, onConsole });
      page.on('pageerror', onError);
      page.on('response', onResponse);
      page.on('console', onConsole);
    };
    context.pages().forEach(attach);
    context.on('page', attach);
    // A control hidden with `display: none` is absent from the ARIA snapshot the
    // repair evidence carries, so "not visible" and "never rendered" look the
    // same. Cloud e767e871a6c6 lost all twelve note-card actions to
    // `.note-actions { display: none }` revealed on `:hover`, and the repair
    // turns spent the run theorising about duplicate accessible names instead.
    // Say which named controls are in the page but cannot be seen, and why.
    const hiddenControls = async page => {
      const found = await page.evaluate(() => {
        const SELECTOR = 'button, a[href], input, select, textarea, [role="button"], [role="link"],'
          + ' [role="menuitem"], [role="checkbox"], [role="switch"], [role="tab"]';
        const named = el => (el.getAttribute('aria-label') || el.getAttribute('title')
          || el.textContent || '').trim().replace(/\s+/g, ' ');
        const label = el => {
          const cls = typeof el.className === 'string' ? el.className.trim() : '';
          return cls ? '.' + cls.split(/\s+/).join('.') : el.tagName.toLowerCase();
        };
        const out = [];
        for (const el of document.querySelectorAll(SELECTOR)) {
          if (out.length >= 5) break;
          const name = named(el);
          if (!name) continue;
          // Opacity is deliberately not checked: a control at opacity 0 keeps its
          // box and stays operable, so it is a styling choice, not a defect.
          const visible = typeof el.checkVisibility === 'function'
            ? el.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })
            : !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
          if (visible) continue;
          let why = 'not visible', owner = '';
          const own = getComputedStyle(el);
          if (own.display === 'none') why = 'display:none';
          else if (own.visibility === 'hidden') why = 'visibility:hidden';
          else for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
            const cs = getComputedStyle(p);
            if (cs.display === 'none' || cs.visibility === 'hidden') {
              why = cs.display === 'none' ? 'display:none' : 'visibility:hidden';
              owner = label(p);
              break;
            }
          }
          out.push(`${el.tagName.toLowerCase()} "${name.slice(0, 60)}" is ${why}`
            + (owner ? ` on its ancestor ${owner}` : ` on ${label(el)}`));
        }
        return out;
      });
      return found;
    };
    try { await use(context); }
    finally {
      if (testInfo && testInfo.status !== testInfo.expectedStatus) {
        for (const page of context.pages()) {
          try {
            const hidden = await hiddenControls(page);
            if (hidden.length) {
              report('Named controls present in the page but not visible, so a click cannot reach them '
                + 'and they are absent from the page snapshot above:\n- ' + hidden.join('\n- '));
            }
          } catch (_) { /* Optional diagnostics cannot change the verdict. */ }
          break;  // one page is enough; the app under test is single-page
        }
      }
      context.off('page', attach);
      for (const [page, listener] of listeners) {
        page.off('pageerror', listener.onError);
        page.off('response', listener.onResponse);
        page.off('console', listener.onConsole);
      }
    }
  } });
}
