# EH LightReader native BB10 mirror

The canonical BB10 source belongs to HE Berry private repository, under `clients/bb10/eh-lightreader-native/`. This independent folder is a **read-only build mirror** to use a working GitHub Actions runner; it is not a Cloudflare Worker or a replacement for R. All server Worker routes, secrets, deployed JavaScript and web assets are left unchanged.

The builder uses the existing pinned HE Berry BB10 toolchain and produces a **separately identifiable** `com.heberry.ehlightreader` BAR. No existing BB10 BAR or NAS OTA allowlist is overwritten.

Build success is not hardware install success. Do not use the experimental Berry Status one-tap OTA path for arbitrary package IDs.
