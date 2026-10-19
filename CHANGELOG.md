# EH LightReader Cloud — CHANGELOG

## v1.4.0-pilot.6 · 2026-10-20

- **User report:** iPhone screenshot showed the beginning of an image bleeding above the reading header in the cloud overlay. The user preferred the compact, edge-to-edge toolbar/pager arrangement shown in the earlier browser Userscripts version.
- **Cause:** In pilot.5 the cloud reader scrolled the entire overlay, using a sticky header and toolbar, and called `scrollIntoView()` on a manga page. On mobile Safari this arrangement can scroll ancestors and leave artwork visible in the header area.
- **UI fix:** Add a reader-only, full-height, isolated layout with a fixed compact heading, mode controls, dedicated middle image-scroll viewport and persistent bottom page navigation. Lock the underlying page while reading; remove the lock on exit. Preserve the user's original two-column gallery and existing reading modes.
- **Scrolling:** Move IntersectionObserver, passive scroll listener, page-position tracking, and next-page jumps onto the internal image viewport. Remove all `scrollIntoView` usage. Keep progressive image loading, safe-area padding, swipe navigation, local progress/mode persistence, and small loaded-image window.
- **Tests:** Add regression checks for isolated reader scrolling, pinning, safe areas, no outer-page `scrollIntoView`, and the page-navigation state machine. Real iPhone Safari layout verification is still pending.
- **Safety:** No changes to R or the working v1.3.2 Safari Userscripts package. No upstream restrictions bypassed.

## v1.4.0-pilot.5 · 2026-10-20

- **Observed:** pilot.4 now displays a real comic image on iPhone, but the client still showed a roughly three-second gateway cooldown message between catalog and image resolution. The cloud overlay also had only previous/next controls, losing the former vertical continuous reader.
- **Reader experience:** Restore two user-selectable modes, `↓ 连续阅读` (full-width vertical page stream, default) and `⇆ 左右翻页` (single page with touch swipes and explicit previous/next controls). Save preferred mode and reading progress in local storage. Keep the two-column discovery grid unchanged.
- **Loading:** Replace the Worker isolate's fixed 3.25-second cooldown response with an async, per-isolate, best-effort upstream queue reserving roughly 950 ms between ordinary site HTML requests and 500 ms between API metadata calls. The browser uses a sequential bounded image URL queue, prioritizes visible pages and prefetches a small nearby window; a network image load and upstream response can still take longer. Source-origin access denials/challenges/real 429 are not bypassed or retried.
- **Performance:** Viewport-based loading in continuous mode, release images outside a small radius while retaining a bounded LRU of resolved image URLs; avoid full-DOM layout work on every normal scroll frame, and only fetch subsequent directory pages near the end.
- **Tests:** Existing Node regression suite plus new mocked catalog→first-image tests and reader mode, image queue, memory-window checks. These are not real iPhone Safari tests.
- **Compatibility:** No changes to R or the older working v1.3.2 Userscripts script.

## v1.4.0-pilot.4 · 2026-10-20

- **Observed:** iPhone reader found a 25-page directory, but immediately requesting page 1 returned "请求太频繁" from our own cooldown timer. The cloud manga directory displayed as a one-column list rather than the previous two-column presentation.
- **Cause:** The Worker requires at least 3.25 seconds between normal upstream HTML requests per running isolate, but the browser immediately requested the first image after fetching the gallery catalog. Returning the local cooldown as a fatal error stopped the reader before trying to resolve the image URL.
- **Fix:** The cloud client waits for and retries only an explicitly tagged `cooldown` response, up to two bounded retries (1–8-second intervals), with visible waiting text. Real E-Hentai rate limits, denied access and challenges are **never** retried.
- **UI:** Restore iPhone two-column portrait-cover grid, preserve large tap targets, lazy cover loading, failure placeholders, and compact card titles.
- **Other:** Guard stale image responses and only advance the directory cursor once the next catalog request succeeds.
- **Tests:** Node tests for two-column layout and gateway-local cooldown recovery without upstream restriction bypass. Real image availability requires iPhone retest. 
- **Scope:** Only `eh-lightreader-cloud`; R and Safari Userscripts v1.3.2 remain unchanged.

## v1.4.0-pilot.3 · 2026-10-20

- **Observed:** iPhone recording showed 24 search results without thumbnails; gallery detail errored with upstream_content_type.
- **Backend:** Accept structurally valid gallery JSON even if served with text/plain MIME. Continue rejecting access challenges, 403 and 429. Cache and reuse search metadata when gallery metadata is unavailable.
- **Thumbnails:** Parse lazy-loading attributes and CSS image URLs from normal search markup, without attempting protected image proxying.
- **UI:** Show cover loading failures and keep gallery reading attempt available even when metadata lookup fails. Manual catalog retry and more informative errors added.
- **Cache:** Cloud bridge version query bumped to 1403.
- **Tests:** Offline mocked JSON metadata / challenge responses, thumbnail extraction and page resolution in GitHub Actions. Real E-Hentai image loading and iPhone acceptance not verified.
- **Unchanged:** R and v1.3.2 Userscripts.

## v1.4.0-pilot.2 · 2026-10-19

**Second fix:** The pilot.1 Worker dynamically modified the decompression bootstrap before serving it. This dependency was fragile and hard to verify across Cloudflare asset cache/deploy versions. Moved the valid cloud bridge script injection directly into `public/index.html` (cloud-only build), and changed the Worker to serve that static loader unchanged with `Cache-Control: no-store` for the homepage. No changes to R or the stable Userscripts 1.3.2.

**Tests:** Added a regression that executes the actual bootstrap injection and checks for an executable `</script>` element; verifies the Worker returns assets without rewriting. GitHub Actions passed. Cloudflare live deployment and real iPhone acceptance are still not verified.


## v1.4.0-pilot.1 · 2026-10-19

**Bug:** Opening a category or performing a search in the Cloudflare-hosted PWA still navigated to the original E-Hentai page. The user's iPhone recording confirmed that the old Userscripts handled that original page instead.

**Cause:** The Worker injected a script element into the decompressed HTML string but emitted a literal `<\/script>` instead of a real closing `</script>`. Consequently, the additive cloud navigation bridge could fail to load. The original PWA's `search.onsubmit` and `button.tile` handlers remained active and opened the original website.

**Fix:** Construct the closing script tag at JavaScript runtime using split string fragments, preserving the outer bootstrap script's HTML grammar and emitting a valid inner `<script src='/__ehr_cloud.js'></script>`. No changes to Userscripts 1.3.2 or R.

**Regression:** Added an offline test that executes the bridge-injection snippet and asserts a proper script close tag and absence of escaped `<\/script>`; added a route test for `/__ehr_cloud.js`. Cloud CI passed. Cloudflare redeploy and iPhone navigation retest are not verified in this report.

**Open risks:** E-Hentai upstream access, catalog compatibility, direct images and PWA offline navigation remain unverified on real iPhone.
