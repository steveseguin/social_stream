# VPS deployment — 2026-09-06

The SSN monetization service is deployed on the existing SSN API VPS, separately from NinjaBacker. Its files live in `/opt/ssn-monetization`; systemd runs it as a restricted dynamic user on `127.0.0.1:3079`. Apache proxies only the three `/v1/` prefixes defined in `ssn-api.conf`. Existing PHP routes remain under `/var/www/html`.

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
