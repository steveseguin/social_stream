# Standalone App Packaging, Updates, And State Persistence

Status: deep extraction pass on 2026-07-22 from `ssapp/package.json`, `ssapp/main.js`, `ssapp/customSign.js`, `ssapp/afterSign.js`, `ssapp/afterPack.js`, `ssapp/resources/portable-data-paths.js`, `ssapp/settings-backup.js`, `ssapp/transfer-backup*.js`. Source-backed; signing/notarization paths not executed.

## Purpose

Use this page for how the app is built and signed, how updates actually work (no auto-updater), and where settings/state live on disk. For behavior-level settings docs, use `../06-settings-sessions-and-storage.md` and `../10-troubleshooting/settings-loss-and-backups.md`.

## Packaging (electron-builder)

Config in `ssapp/package.json:66-242`:

| Target | Format | Notes |
| --- | --- | --- |
| Windows | NSIS installer + portable (x64) | Custom signtool step. |
| macOS | dmg + zip (x64 + arm64) | Hardened runtime + entitlements; notarized. |
| Linux | AppImage | |
| Windows Store | appx stub | Not actively distributed. |

- Publish provider: GitHub releases (`package.json:233-238`).
- Hooks: `afterPack` → `scripts/prunePackagedNativeBinaries.js`; `afterAllArtifactBuild` → `afterPack.js` (zips artifacts); NSIS include `installer.nsh`.
- Prebuild: `check-submodules.js` (stubs the private TikTok signer submodule if absent, `scripts/check-submodules.js:16-41`) + `update:fallback` rebuilds `resources/social_stream_fallback` (`package.json:48-56`).

## Signing

- Windows: custom signtool script `customSign.js` (`package.json:191-199`, cert `certs/socialstream.pfx`); skipped with a warning if cert/password absent (`customSign.js:88-94`) — unsigned builds are possible.
- macOS: notarization in `afterSign.js:8-52`, requires env vars / keychain profile.

## Updates: No Auto-Updater

There is no `electron-updater`/`autoUpdater` anywhere. The renderer polls GitHub releases and shows a "new version" banner (`index.html:13042-13066`); updating is a manual download.

Support implication: "the app updated itself" claims are wrong. Version drift between users is expected. Also remember the default asset pipeline pulls Social Stream code from the live site (see `social-stream-loading.md`), so SSN behavior can change without an app update — separate "app version" from "SSN code version" when triaging.

## On-Disk State

| Store | Location | Contents | Code |
| --- | --- | --- | --- |
| `savedSync.json` | userData folder | `cachedState`: streamID, password, settings, wsServer flag, etc. | Atomic writer `saveCachedStateAtomic` `main.js:14899-14911` (`.tmp`/`.bak` rotation), guarded writer `persistCachedStateSafely` `main.js:14514`, multi-source recovery loader `loadCachedStateWithBackupSource` `main.js:14777`, paths `getSavedSyncPaths` `main.js:14175-14181` |
| electron-store | userData | `cachedStateBackup` mirror (`main.js:14542`), `startupFlags`, `controlApi.*` (incl. token), `localSourcePath`, `windowState_*` (`main.js:3954-3962`), dialog-approved paths | `main.js:226-227` |
| Renderer localStorage | per-partition | `socialStreamState`: sources/groups maps (`state.js`) | `state.js` |
| SSN asset HTTP cache | userData cache | Downloaded Social Stream pages/scripts | `main.js:3436-3437` |
| Whisper models | `userData/models/whisper` | STT model files | `main.js:15213` |
| TikTok debug logs | userData | Per-connection logs, gated by `--enable-tiktok-logs` | `main.js:3246`, `:3900` |
| Transfer backups | `ssapp-transfer-backup.ssappbk` | Full settings transfer | `main.js:669`, `transfer-backup*.js` |
| Settings snapshots | userData | Point-in-time settings backups | `settings-backup.js` |

## Portable Mode

`resources/portable-data-paths.js:58-170` (applied `main.js:73`, `main.js:14166-14172`) redirects userData to `<exe dir>/data`, making the whole app state travel with the executable folder. Support implication: when a user reports lost settings, first establish whether they run the installer or portable build — the state files are in different places.

## Precedence When Stores Conflict

`loadCachedStateWithBackupSource` (`main.js:14777`) recovers `cachedState` from multiple sources; electron-store holds a `cachedStateBackup` mirror (`main.js:14542`). Exact recovery/scoring order is not yet documented line-by-line — see Follow-Up.

## Do Not Overclaim

- No silent/auto update exists; do not tell users to "wait for the app to update."
- Unsigned Windows builds are a normal outcome when the cert is missing, not a build failure.
- Old profiles may still contain an unused `controlApi.token` value from API versions before 1.1.5; current SSApp does not read it.

## Follow-Up Extraction Needs

- Line-level recovery precedence order in `loadCachedStateWithBackupSource`.
- Per-OS artifact naming matrix for support ("which file do I download").
- What happens to userData on uninstall per platform.
