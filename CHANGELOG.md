# EH LightReader Cloud — CHANGELOG

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
