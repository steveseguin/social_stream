# VPS deployment — 2026-09-06

## Commerce audit fixes deployed September 8, 2026

Installed the audited `fb6c75da` receiver JavaScript into both `/opt/ssn-monetization` and `/opt/ssn-ebay-sandbox`, and the matching shared monetization core under `/opt/shared/monetization`. Dependencies matched the existing lockfile and were retained. All 27 staged server tests passed on the VPS before installation. Existing environment files, service configuration, database paths and encryption keys were preserved; production eBay and Shopify remain disabled pending account validation.

Code/configuration and online SQLite backups are under the root-only `/root/ssn-backups/commerce-audit-fb6c75da`; the NinjaBacker encryption key is backed up with its database. Both database integrity checks passed. Both services restarted successfully, their deployed files match the tested stage, the NinjaBacker retention index exists, and Apache configuration remains valid. Shopify's retention index will initialize when its receiver is enabled. No Apache, Cloudflare or account configuration was changed.

Public HTTPS health, Throne and NinjaBacker status passed. Production eBay remained setup-pending (503), and the sandbox required authentication (401). An isolated public catalog passed create/read/show/hide/malformed-price checks and deletion/404; all temporary catalog rows were removed. Published beta core/overlay/shop assets match local SHA-256 hashes. The public shop page and six versioned dependencies returned 200. Python's local TLS trust path failed on the website, so website checks used Windows curl with normal certificate verification instead.

Connected-device follow-up: three synthetic sale/tip/gift receipts were submitted through isolated SSApp Event Flow to POS-58 with successful native callbacks and drained Windows queues; Steve confirmed paper output, but reported clipping outside the printable area; successful submission is not a layout-validation pass. Stream Deck's installed plugin matched the tested bundle and passed commerce controls over both transports; hardware interfaces were present, but physical key presses/displays were not asserted. See the local audit report in `docs/commerce-release.md` and the separate Stream Deck validation notes.

Live eBay sandbox app authentication and three listing reads passed. Shipping now saves, but the authoritative order details report payment failure despite an earlier confirmation screen. Seller Fulfillment still needs renewed consent because the test token expired. Automatic approval review rejected the fresh consent helper with only “blocked by policy”; it was not retried through another route. No paid end-to-end pass is claimed.

The SSN monetization service is deployed on the existing SSN API VPS, separately from NinjaBacker. Its files live in `/opt/ssn-monetization`; systemd runs it as a restricted dynamic user on `127.0.0.1:3079`. Apache proxies the `/v1/` route families defined in `ssn-api.conf`. Existing PHP routes remain under `/var/www/html`.

Throne's public status endpoint, SSE connection and unsigned-webhook rejection were checked over HTTPS. eBay deliberately returns `503 EBAY_NOT_CONFIGURED` until application credentials and access are configured. Put these in root-owned `/etc/ssn-monetization.env` with mode 600, then restart the service. Do not put credentials in this repository.

## Security maintenance completed

- Backed up Apache/PHP configuration and affected PHP files to `/root/ssn-backups/20260906/pre-change.tgz` (root-only).
- Disabled the retired Debian backports source that prevented package refreshes; installed available package updates, including Node and Google guest tools. Package audit reports no unfinished installations or pending upgrades.
- Removed unsafe write permissions from webroot/configuration and 27 PHP/htaccess files, preserving Apache's token-file and image-upload access. Original file modes are recorded in the same backup directory.
- Restricted global cache flushing to loopback callers; bounded image uploads; tightened Discord image URL validation, disabled redirects, and bounded remote downloads. Disabled displayed PHP errors and directory listings for the API virtual host.
- Kept memcached and the new Node listener on loopback. Did not change SSH, firewall, VPN, other applications, or NinjaBacker's live server.

## Validation

- Five server tests passed on the VPS; production npm audit reported zero known vulnerabilities.
- Fourteen SSN monetization tests passed locally; Throne and eBay fixture tests passed through SSApp's Electron runtime.
- Existing Twitch avatar/viewer responses matched their pre-change baselines. A valid YouTube video-to-channel lookup succeeded through the public API. Missing-input responses retained their previous status and contents.
- Isolated PHP checks passed for syntax, allowed cached images, rejected lookalike domains/HTTP/custom ports, oversized uploads and remote cache-flush rejection. The public cache-flush request returned 403.
- Apache configuration validation passed; Apache and the SSN service are active. Public health returned 200, SSE immediately delivered its connection event, unsigned Throne input returned 401, and unconfigured eBay returned the expected 503.

## Remaining work / limits

- Authorized reboot completed on September 6 after the full local backup was verified. The running kernel is now `5.10.0-46-cloud-amd64`. SSH, Apache, memcached and the SSN service started successfully; no failed systemd units were reported. Origin and public YouTube/Twitch/monetization checks passed, including public SSE. eBay still returns its expected setup-pending 503.
- Debian 11 reached end of support on August 31, 2026. Available package updates do not make it a supported OS. Plan and test an OS/PHP migration separately against the active PHP integrations: https://www.debian.org/News/2026/20260831
- A real signed Throne delivery and a real eBay seller OAuth/paid-order flow remain untested. eBay application credentials and permissions are required before enabling it.
- Existing public edge filtering rejected Python's default user agent with error 1010; browser-agent HTTPS requests and SSE passed. No edge configuration was changed. Verify that actual provider webhook requests pass before calling the integration live-validated.
- This was a targeted review of the API paths and server configuration, not a complete audit of every legacy application in the webroot.
- Server deployment does not publish the local SSN client changes; those still require the normal beta release flow.


## NinjaBacker receiver deployment (September 6 follow-up)

The optional receiver is enabled on `/v1/ninjabacker/*`. The service unit enables it; existing PHP/Throne/eBay paths were checked after deployment. Seven server tests passed on the VPS. Actual SSApp tests covered both modes, signed delivery, private setup, offline/server-restart recovery, test-tip isolation, deduplication and acknowledgments. Popup/mobile screenshots were reviewed. Public HTTPS tests with an isolated synthetic receiver passed; its test rows were removed. The actual NinjaBacker sender transport also reached the receiver without any NinjaBacker changes.

Database/key state was backed up locally outside Git after deployment and checksums matched. Future backups must retain the encryption key together with SQLite state; the original full-server backup predates this receiver. Frontend changes require the normal beta publication flow. No real-money payment test was performed.


## Public shop deployment (September 7)

The public-shop API is enabled on the existing monetization service. Apache proxies exactly `/v1/shop` and its child paths; the eBay sandbox, Throne, NinjaBacker and existing PHP configuration were preserved. The repository's Apache template now reflects the active sandbox route too.

The service's package and lockfile matched the staged release, so dependencies were retained. Deployed the new server entry point, public-shop module, optional Shopify module (still disabled), and shared monetization core. The deployed eBay provider was intentionally retained. All 12 tests for this staged combination passed on the VPS.

Before installation, code and configuration were backed up under `/root/ssn-backups/ssn-public-shop-12a8bd542bb9`. The SQLite online backup passed `integrity_check`; its matching encryption key and path metadata are included in that root-only directory. The existing environment file and live database/key were preserved. Apache configuration validation passed, and Apache and the service are active.

Public HTTPS verification passed using a newly generated temporary publisher: POST/read, stable viewer product links, automatic selected/hidden updates, DELETE, JSON 404 afterward, and clearing an already-open viewer page. The temporary catalog was removed. No real merchant account, creator catalog, payment, or chat message was involved. Health, Throne and NinjaBacker return 200; unconfigured production eBay returns 503 and the configured sandbox requires authentication (401), as expected.

The beta Pages workflow publishes the standalone viewer at `/shop.html` with content-versioned dependencies. The public page and all bundled assets return 200. Carry this deployment step forward when releasing the stable branch too, so a later stable-only deployment retains the public viewer.

Local connection notes are indexed in the operator's SSH README; use the SSN API entry, not the separate Chunkcast GCP server.
