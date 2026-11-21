# Chrome extension practices we follow

Short list of the rules the SBDC Advisor Helper (`extension/`) is built to, with the source for each. Checked against the official pages on Nov 15, 2026.

## 1. Manifest V3 service worker: hold no state

- Chrome stops an extension service worker after about 30 seconds idle, and any global variable is lost when it stops. Save values to storage instead. [Service worker lifecycle](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle)
- Register event listeners at the top level of the worker, not inside a callback, so they exist when Chrome restarts it. [Service worker events](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/events)

**What we do:** `background.js` is four lines. It only tells Chrome to open the side panel when the toolbar icon is clicked. A run's state lives in the side panel page, which stays alive while it is open. No keep-alive tricks.

## 2. Least-privilege permissions

- Ask for the fewest permissions and the narrowest host patterns. A narrow list limits what an attacker gets if the extension is ever compromised. [Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)
- Use optional permissions where you can, so the user grants access at the moment they need it. [Declare permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- `activeTab` gives temporary access to one tab when the user invokes the extension. [activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab)
- Chrome Web Store review expects the narrowest permissions and a single clear purpose. [Web Store best practices](https://developer.chrome.com/docs/webstore/program-policies/best-practices), [Permission warnings](https://developer.chrome.com/docs/extensions/develop/concepts/permission-warnings)

**What we do:**
- `permissions`: `sidePanel`, `scripting`, `storage`. No `tabs`, no `<all_urls>`, no `webRequest`, no `cookies`, no `clipboardRead`.
- `host_permissions`: only the live dashboard, `https://sbdc-p3-dd2e46.pages.dev/*`.
- `optional_host_permissions`: `https://*/*`, used only to ask for one named site at a time (AZ Corporation Commission, or the record system address the advisor types in). Chrome shows its own prompt for each one and the advisor can turn it off again in the panel.
- We did not use `activeTab`. The helper runs from buttons inside the side panel, and a click inside the panel does not count as invoking the extension on the tab, so `activeTab` would not reliably cover it. A per-site grant is clearer for the advisor too.

## 3. Content scripts versus `chrome.scripting`

- A content script in the manifest runs on every matching page load. `chrome.scripting.executeScript` injects only when asked. [chrome.scripting](https://developer.chrome.com/docs/extensions/reference/api/scripting)
- Content scripts run in an isolated world: they share the page's DOM but not its JavaScript variables. [Content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts)
- Treat everything read from a web page as untrusted input. [Stay secure](https://developer.chrome.com/docs/extensions/develop/security-privacy/stay-secure)

**What we do:**
- No `content_scripts` in the manifest. `content/agent.js` is injected into one tab, and only after the advisor clicks a button (Fill this page, Point and fill, or Show the boxes).
- It runs in the isolated world. The exceptions are three small packaged functions that run in the page's world, on the dashboard only, to use what the dashboard already exposes: `window.__cicText()` for the client's details, and `window.__tb` to list finished tool runs and to open the Follow-ups tool with a list in its box.
- Page text is only ever written to the panel with `textContent`. Nothing from a page is used as HTML, as a selector or as code.
- The drawing on the page (ring and Stop bar) sits in a closed shadow root with a constructed stylesheet, so it does not change the page's own elements or styles.

## 4. Side panel

- The side panel is available from Chrome 114. `setPanelBehavior({ openPanelOnActionClick: true })` opens it from the toolbar icon. `sidePanel.open()` (Chrome 116) needs a user gesture. [chrome.sidePanel](https://developer.chrome.com/docs/extensions/reference/api/sidePanel)

**What we do:** one side panel page, opened from the toolbar icon. It stays open next to the page, so the advisor watches the form and the step list together. `minimum_chrome_version` is 116.

## 5. Messaging

- Validate the sender of every message and never act on message content as code. Content scripts are less trusted than extension pages. [Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)
- Use a long-lived port when you need to know the other side went away. [Message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging)

**What we do:**
- The page agent only obeys messages from this extension's own pages (`sender.id` is ours and the sender is not a tab). The panel only accepts "stop" from the tab it is running in.
- No `externally_connectable`, so web pages and other extensions cannot message the helper.
- During a run the panel holds a port open to the page. If the panel closes, the port drops and the agent removes its ring and bar.
- Messages are a fixed set of ten small requests (`scan`, `values`, `table`, `show`, `fill`, `click`, `banner`, `clear`, `pickStart`, `pickStop`).

## 6. Storage

- `storage.session` is kept in memory, is cleared when the browser restarts, and by default is not exposed to content scripts. Chrome recommends it for sensitive data. `storage.local` persists on disk. [chrome.storage](https://developer.chrome.com/docs/extensions/reference/api/storage)

**What we do:**
- The pasted block (which can hold client details) goes in `storage.session` only. It is gone when Chrome closes.
- `storage.local` holds three settings: run speed, the list of sites the advisor added, and the label pairings learned from Point and fill (labels only). No client data, no keys, no tokens.
- `storage.sync` is not used, so nothing is copied to a Google account.

## 7. CSP and no remote code

- Manifest V3 does not allow remotely hosted code: all logic must ship in the package. `eval()` and inline scripts are blocked on extension pages. [Remote hosted code](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code)
- The default extension page policy is `script-src 'self'; object-src 'self'`, and it can be made stricter. [Content Security Policy](https://developer.chrome.com/docs/extensions/reference/manifest/content-security-policy)

**What we do:**
- Stricter CSP than the default: `default-src 'none'`, scripts, styles, images and fonts from the package only, and `connect-src 'none'`. The extension pages cannot make a network request at all.
- No `eval`, no `new Function`, no inline scripts or inline styles, no CDN. Fonts (DM Sans, Instrument Serif) and the background image are packaged files.
- No `web_accessible_resources`, so web pages cannot load the extension's files or detect it that way.
- No runtime dependencies. Playwright is a dev-only tool for tests.

## 8. Testing

- Extensions load in Playwright only with a persistent context. Use the Chromium that ships with Playwright (`channel: 'chromium'`, which also allows headless), because Google Chrome and Edge removed the flags for side-loading. [Playwright: Chrome extensions](https://playwright.dev/docs/chrome-extensions)
- Chrome 137 stopped honoring `--load-extension` in branded Chrome builds; Chromium and Chrome for Testing still support it. [Chromium extensions PSA](https://groups.google.com/a/chromium.org/g/chromium-extensions/c/1-g8EFx2BBY)
- Get the extension ID from the service worker URL and open extension pages directly to test them. [End-to-end testing](https://developer.chrome.com/docs/extensions/how-to/test/end-to-end-testing)

**What we do:**
- `npm test` in `extension/` runs unit tests (parser, matcher, address check) and an end-to-end run in Playwright's Chromium with a throwaway profile. The advisor's own Chrome is never used.
- The end-to-end run uses a local copy of the dashboard and a practice record page. Every request that is not to this computer is blocked, and the test fails if anything other than the dashboard's font request is even attempted.
- Tests assert the safety rules: the form is never submitted, Save and Delete are refused, password and SSN boxes stay empty, and a page that is not turned on gets nothing injected.

## 9. Packaging

- Ship only what the extension needs; keep the package small and readable for review. Code must not be obfuscated. [Web Store best practices](https://developer.chrome.com/docs/webstore/program-policies/best-practices)

**What we do:** `npm run package` writes `extension/dist/sbdc-advisor-helper-<version>.zip` with the 19 runtime files (about 300 KB). No build step, no minifying, no tests or `node_modules` inside. Nothing is uploaded: publishing to the Chrome Web Store waits for Riley's approval.
