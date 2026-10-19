# EH LightReader Cloud · v1.4.0-pilot.2

This repository is the **active deployment repository** created during the Cloudflare one-click import. Its `main` branch is the source of truth for the `eh-lightreader-cloud` Worker. **Do not redeploy from the older seed repository** to update this Worker.

## Cloudflare build settings

- Connected GitHub repository: `hexiangyu481-commits/eh-lightreader-cloud`
- Production branch: `main`
- Root directory: `/`
- Build command: none
- Deploy command: `npm run deploy`
- Worker name: `eh-lightreader-cloud`

The Worker and the Cloud PWA use the same origin: `https://eh-lightreader-cloud.hexiangyu481.workers.dev`. The health endpoint is `/api/health` and should report `1.4.0-pilot.2` after the latest version reaches production.

> Updated 2026-10-20 to document the correct deployed repository and Cloudflare build root. This documentation commit also provides a fresh `main` push to trigger the configured automatic build. **A GitHub commit or completed GitHub Pages run is not proof of a Cloudflare Worker deployment.** Check Cloudflare deployment history and the live health endpoint.

## Boundaries

- This pilot is independent of `red-a8-mind` and does not modify R secrets or workers.
- Public discovery and gallery metadata are experimental; actual E-Hentai access from Workers egress is not verified.
- If E-Hentai blocks access or requires a login/challenge, stop. No bypass, cookie collection, proxy rotation, or retry after 403/429.
- User credentials and cookies must never be committed to GitHub.
- Direct manga images and native iPhone PWA navigation are not yet validated. Keep the stable Userscripts reader as a fallback.
- All functions remain in the new domain only if the `/__ehr_cloud.js` bridge is loaded; the PWA should not navigate to the original site when testing cloud search.

## API

`GET /api/health`, `GET /api/search?q=...`, `GET /api/gallery?gid=...&token=...`, `GET /api/catalog?gid=...&token=...&p=0`, `GET /api/page?url=...`.
