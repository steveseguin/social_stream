# SSN Resource Manifest For AI Documentation

Checked on 2026-06-23.

This file lists the source material that should be considered for SSN AI documentation extraction. It is a manifest, not the finished docs.

## Exclusions

Do not use these for extraction unless Steve explicitly changes scope:

- `C:\Users\steve\Code\ssapp\resources\social_stream_fallback`
- `C:\Users\steve\Code\stevesbot\resources\secrets`
- `node_modules`, `.git`, build output, temp folders, logs, and backup databases
- Non-SSN support material unless it directly affects SSN setup or integration

## Extraction Priority

- `P0`: source of truth or high-impact user support
- `P1`: important feature docs or current behavior support
- `P2`: useful context, tests, examples, or lower-volume features
- `P3`: assets, historical files, generated support material, or optional context

## Social Stream Repo

Root: `C:\Users\steve\Code\social_stream`

Observed candidate resource counts:

- `sources`: 381 files
- root files: 119 files
- `thirdparty`: 114 files
- `icons`: 86 files
- `themes`: 68 files
- `docs`: 51 files
- `scripts`: 39 files
- `tests`: 35 files
- `actions`: 28 files
- `lite`: 18 files
- `games`: 17 files
- `translations`: 16 files
- `shared`: 12 files
- `providers`: 5 files

### P0 Core Runtime

- `manifest.json`
- `service_worker.js`
- `background.html`
- `background.js`
- `popup.html`
- `popup.js`
- `dock.html`
- `featured.html`
- `api.md`
- `parameters.md`
- `docs/event-reference.html`
- `docs/customoverlays.md`
- `README.md`
- `about.md`

### P0/P1 Shared Config And Provider Cores

- `shared/config/settingsDefinitions.js`
- `shared/config/urlParameters.js`
- `shared/utils/html.js`
- `shared/utils/scriptLoader.js`
- `shared/utils/twitchEmotes.js`
- `shared/ai/browserModelCatalog.js`
- `shared/ai/kokoroAssetCatalog.js`
- `shared/ai/localBrowserLLM.js`
- `shared/aiPrompt/overlayStore.js`
- `providers/kick/core.js`
- `providers/twitch/chatClient.js`
- `providers/youtube/contextResolver.js`
- `providers/youtube/liveChat.js`
- `providers/youtube/proto/stream_list.proto`

### P0/P1 Existing Docs

- `docs/ai-cohost-guide.html`
- `docs/appImage.md`
- `docs/commands.html`
- `docs/custom-fonts.html`
- `docs/customoverlays.md`
- `docs/data/services.json`
- `docs/download.html`
- `docs/event-reference.html`
- `docs/features.html`
- `docs/first-time-chatters.html`
- `docs/guides.html`
- `docs/hype-train-top-bar.html`
- `docs/index.html`
- `docs/kick-channel-points-event-flow.md`
- `docs/local-tts.html`
- `docs/services.html`
- `docs/settings.html`
- `docs/ssapp.html`
- `docs/support.html`
- `docs/supported-sites.html`
- `docs/templates.html`
- `docs/tiktok-guide.html`
- `docs/tts.html`
- `docs/youtube-project-setup.html`
- `docs/youtube-websocket-streaming-plan.md`
- `docs/zoom.md`
- `ai.md`
- `seo.md`
- `TOS.md`
- `privacy.html`

### P0/P1 Event Flow

- `actions/EventFlowEditor.js`
- `actions/EventFlowSystem.js`
- `actions/interface.js`
- `actions/loader.js`
- `actions/index.html`
- `actions/event-flow-guide.html`
- `actions/state-nodes-guide.html`
- `actions/STATE_NODES_EXPLANATION.md`
- `actions/examples/kick-channel-points-action-flow.json`
- `actions/styles.css`
- `tests/eventflow-compare-property.test.js`
- `tests/eventflow-customjs.test.js`
- `tests/eventflow-play-media-duration.test.js`
- `tests/eventflow-template-vars.test.js`

### P0/P1 Active Platform Source Code

These are active source extraction targets. Start with the high-volume platforms, but eventually every active file should get at least a quick pass.

- `sources/amazon.js`
- `sources/arenasocial.js`
- `sources/autoreload.js`
- `sources/bandlab.js`
- `sources/beamstream.js`
- `sources/bigo.js`
- `sources/bilibili.js`
- `sources/bilibilicom.js`
- `sources/bitchute.js`
- `sources/blaze.js`
- `sources/boltplus.js`
- `sources/bongacams.js`
- `sources/buzzit.js`
- `sources/cam4.js`
- `sources/camsoda.js`
- `sources/capturevideo.js`
- `sources/castr.js`
- `sources/cbox.js`
- `sources/chatroll.js`
- `sources/chaturbate.js`
- `sources/cherrytv.js`
- `sources/chime.js`
- `sources/chzzk.js`
- `sources/cime.js`
- `sources/circle.js`
- `sources/cloudhub.js`
- `sources/cozy.js`
- `sources/crowdcast.js`
- `sources/discord.js`
- `sources/dlive.js`
- `sources/ebay.js`
- `sources/estrim.js`
- `sources/facebook.js`
- `sources/fansly.js`
- `sources/favorited.js`
- `sources/fc2.js`
- `sources/floatplane.js`
- `sources/gala.js`
- `sources/generic.js`
- `sources/goodgame.js`
- `sources/grabvideo.js`
- `sources/instafeed.js`
- `sources/instagram.js`
- `sources/instagramlive.js`
- `sources/jaco.js`
- `sources/joystick.js`
- `sources/kick.js`
- `sources/kick_new.js`
- `sources/kiwiirc.js`
- `sources/kwai.js`
- `sources/lfg.js`
- `sources/linkedin.js`
- `sources/livepush.js`
- `sources/livestorm.js`
- `sources/livestream.js`
- `sources/locals.js`
- `sources/loco.js`
- `sources/meetme.js`
- `sources/meets.js`
- `sources/megaphonetv.js`
- `sources/minnit.js`
- `sources/mixcloud.js`
- `sources/mixlr.js`
- `sources/myfreecams.js`
- `sources/nextcloud.js`
- `sources/nicovideo.js`
- `sources/nimo.js`
- `sources/nonolive.js`
- `sources/odysee.js`
- `sources/on24.js`
- `sources/onlinechurch.js`
- `sources/openai.js`
- `sources/openstreamingplatform.js`
- `sources/owncast.js`
- `sources/parti.js`
- `sources/patreon.js`
- `sources/peertube.js`
- `sources/picarto.js`
- `sources/piczel.js`
- `sources/pilled.js`
- `sources/portal.js`
- `sources/pumpfun.js`
- `sources/quakenet.js`
- `sources/quickchannel.js`
- `sources/README.md`
- `sources/restream.js`
- `sources/retake.js`
- `sources/riverside.js`
- `sources/rokfin.js`
- `sources/roll20.js`
- `sources/rooter.js`
- `sources/rumble.js`
- `sources/rutube.js`
- `sources/sessions.js`
- `sources/shareplay.js`
- `sources/simps.js`
- `sources/slack.js`
- `sources/slido.js`
- `sources/sooplive.js`
- `sources/soulbound.js`
- `sources/steam.js`
- `sources/streamelements.js`
- `sources/streamlabs.js`
- `sources/streamplace.js`
- `sources/stripchat.js`
- `sources/substack.js`
- `sources/teams.js`
- `sources/telegram.js`
- `sources/telegramk.js`
- `sources/tellonym.js`
- `sources/tikfinity.js`
- `sources/tiktok.js`
- `sources/tradingview.js`
- `sources/trovo.js`
- `sources/truffle.js`
- `sources/twitcasting.js`
- `sources/twitch.js`
- `sources/uscreen.js`
- `sources/vdoninja.js`
- `sources/velora.js`
- `sources/vercel.js`
- `sources/verticalpixelzone.js`
- `sources/vimeo.js`
- `sources/vklive.js`
- `sources/vkplay.js`
- `sources/vkvideo.js`
- `sources/vpzone.js`
- `sources/wavevideo.js`
- `sources/webex.js`
- `sources/webinargeek.js`
- `sources/whatnot.js`
- `sources/whatsapp.js`
- `sources/whop.js`
- `sources/wix.js`
- `sources/wix2.js`
- `sources/workplace.js`
- `sources/x.js`
- `sources/xeenon.js`
- `sources/younow.js`
- `sources/youtube.js`
- `sources/youtube_comments.js`
- `sources/youtube_static.js`
- `sources/zapstream.js`
- `sources/zoom.js`

### P0/P1 WebSocket Source Pages

- `sources/websocket/bilibili.html`
- `sources/websocket/bilibili.js`
- `sources/websocket/facebook.html`
- `sources/websocket/facebook.js`
- `sources/websocket/irc.html`
- `sources/websocket/irc.js`
- `sources/websocket/joystick.html`
- `sources/websocket/joystick.js`
- `sources/websocket/kick.css`
- `sources/websocket/kick.html`
- `sources/websocket/kick.js`
- `sources/websocket/nostr.html`
- `sources/websocket/nostr.js`
- `sources/websocket/rumble.html`
- `sources/websocket/rumble.js`
- `sources/websocket/socialstreamchat.html`
- `sources/websocket/socialstreamchat.js`
- `sources/websocket/stageten.html`
- `sources/websocket/stageten.js`
- `sources/websocket/streamlabs.html`
- `sources/websocket/streamlabs.js`
- `sources/websocket/twitch.html`
- `sources/websocket/twitch.js`
- `sources/websocket/velora.css`
- `sources/websocket/velora.html`
- `sources/websocket/velora.js`
- `sources/websocket/vpzone.html`
- `sources/websocket/vpzone.js`
- `sources/websocket/websocket-responsive.css`
- `sources/websocket/youtube.css`
- `sources/websocket/youtube.html`
- `sources/websocket/youtube.js`
- `sources/websocket/custom_emotes.json`
- `sources/websocket/emotes.json`

### P1 AI, TTS, And Advanced Pages

- `ai.js`
- `ai.md`
- `aioverlay.html`
- `aiprompt.html`
- `cohost.html`
- `cohost-local-qwen-worker.js`
- `cohost-overlay.html`
- `message-ai-export.html`
- `message-ai-export.js`
- `chatbot.html`
- `bot.html`
- `tts.html`
- `tts.js`
- `local-browser-model-worker.js`
- `local-tts-bridge/package.json`
- `local-tts-bridge/README.md`
- `local-tts-bridge/server.cjs`

### P1/P2 Overlay, Tool, And Integration Pages

- `actions.html`
- `automix.html`
- `battle.html`
- `chat-overlay.html`
- `chathistory.html`
- `chathistory.js`
- `confetti.html`
- `content.html`
- `createtestmessage.html`
- `credits.html`
- `dashboard.js`
- `emotes.html`
- `events.html`
- `fonts.html`
- `games.html`
- `gif.html`
- `giveaway.html`
- `giveaway-obs-entries.html`
- `hype.html`
- `input.html`
- `leaderboard.html`
- `map.html`
- `meta.html`
- `midimonitor.html`
- `minecraft.html`
- `multi-alerts.html`
- `multi-alerts.js`
- `obs-websocket-test.html`
- `points.js`
- `pointsactions.js`
- `poll.html`
- `reactions.html`
- `recover.html`
- `replaymessages.html`
- `replaymessages.js`
- `sampleapi.html`
- `samplefeatured.html`
- `sampleoverlay.html`
- `scoreboard.html`
- `shop_the_stream.html`
- `simple_api_client.html`
- `spotify.html`
- `spotify.js`
- `spotify-auth-helper.js`
- `spotify-callback.js`
- `spotify-overlay.html`
- `streamelements-importer.html`
- `streamelements-importer.js`
- `streamelements-importer-prompt.md`
- `streamerbot.html`
- `teams.js`
- `ticker.html`
- `timer.html`
- `timer-plan.md`
- `tipjar.html`
- `urleditor.html`
- `vdo.html`
- `waitlist.html`
- `wordcloud.html`

### P1/P2 Tests And Scripts

- `scripts/generate-url-parameters.js`
- `scripts/validate-configs.sh`
- `scripts/local-tts-bridge.cjs`
- `scripts/playwright-*.cjs`
- `scripts/aiprompt-*.cjs`
- `tests/*.test.js`
- `tests/*.html`
- `tests/fixtures/*.json`

### P2/P3 Assets And Historical Context

Track these by directory unless a page depends on a specific file:

- `themes/**`
- `games/**`
- `icons/**`
- `media/**`
- `audio/**`
- `translations/**`
- `thirdparty/**`
- `sources/images/**`
- `sources/graveyard/**`
- `sources/static/**`
- `sources/inject/**`

## Standalone App Repo

Root: `C:\Users\steve\Code\ssapp`

Observed candidate resource counts after excluding fallback/build/temp/log output:

- root files: 45
- `tests`: 25
- `resources`: 11
- `assets`: 11
- `scripts`: 8
- `Kokoro-82M-ONNX`: 4
- `aur`: 4
- `cloudflare`: 3
- `tiktok`: 2
- `tiktok-signing`: 1

### P0 Core App Runtime

- `main.js`
- `preload.js`
- `preload-mock.js`
- `preload-kasada.js`
- `state.js`
- `index.html`
- `main.css`
- `renderer.js`
- `package.json`
- `AGENTS.md`
- `README.md`
- `RELEASE.md`

### P0/P1 App Platform Handlers

- `resources/electron-facebook-handler.js`
- `resources/electron-kick-handler.js`
- `resources/electron-media-upload-handler.js`
- `resources/electron-spotify-handler.js`
- `resources/electron-twitch-handler.js`
- `resources/electron-velora-handler.js`
- `resources/electron-vpzone-handler.js`
- `resources/electron-youtube-handler.js`
- `resources/kick-ws-client.js`
- `resources/youtube/proto/stream_list.proto`
- `resources/README.md`

### P0/P1 TikTok App Behavior

- `tiktok/connection-manager.js`
- `tiktok/gift-mapping.json`
- `tiktok-signing/electron-signer.js`
- `tiktok-auth.js`
- `tiktok-badges.js`
- `tests/tiktok/authenticated-bootstrap-regression.js`
- `tests/tiktok/auth-ws-e2e.js`
- `tests/tiktok/auto-fuzz-regression.js`
- `tests/tiktok/auto-mode-regression.js`
- `tests/tiktok/chat-emote-regression.js`
- `tests/tiktok/dedupe-replay-regression.js`
- `tests/tiktok/event-capture-regression.js`
- `tests/tiktok/gift-count-regression.js`
- `tests/tiktok/run.js`
- `tests/tiktok/single-active-connection-regression.js`
- `tests/tiktok/social-signal-regression.js`
- `tests/tiktok/validate-403-bugs.js`

### P1 App Regression And Diagnostic Tests

- `tests/electron/frame-fallback-diagnostics.js`
- `tests/electron/ipc-scaffold-regression.js`
- `tests/electron/settings-loss-diagnostics.js`
- `tests/electron/settings-rootcause-diagnostics.js`
- `tests/electron/settings-transfer-e2e.js`
- `tests/electron/socialstream-path-security-regression.js`
- `tests/electron/source-url-parsing-regression.js`
- `tests/electron/stability-recovery-diagnostics.js`
- `tests/electron/tts-diagnostics.js`
- `tests/electron/window-state-diagnostics.js`
- `tests/google-oauth-test.js`

### P2 Build, Release, And Packaging Context

- `afterPack.js`
- `afterSign.js`
- `customSign.js`
- `CODE_SIGNING.md`
- `CONTRIBUTING.md`
- `scripts/check-submodules.js`
- `scripts/fallbacks/electron-signer.stub.js`
- `scripts/install-custom-electron.js`
- `scripts/installer-user-path.ps1`
- `scripts/patch-deps.js`
- `scripts/submit-virustotal.js`
- `scripts/updateSocialStreamFallback.js`
- `scripts/verify-custom-electron.js`
- `aur/DEPLOYMENT.md`
- `aur/PKGBUILD`
- `aur/README.md`
- `cloudflare/README.md`
- `cloudflare/schema.sql`
- `cloudflare/wrangler.toml`

### P2/P3 App Assets And Models

Track by directory unless a feature page needs exact asset behavior:

- `assets/icons/**`
- `Kokoro-82M-ONNX/**`
- `libs.js`
- `thumbnail.js`
- `youtube.js`
- `tts-worker.js`
- `websocket-monitor.js`
- backup/transfer scripts

## Stevesbot Support Data

Root: `C:\Users\steve\Code\stevesbot`

This repo is support evidence, not product source of truth.

Observed candidate resource counts after excluding secrets, logs, backups, and replays:

- `data`: 3,291 files
- `resources`: 81 files
- `skills`: 30 files

### P0 Curated SSN Support Docs

- `resources/instructions/social-stream-support.md`
- `resources/learnings/social-stream-ninja-top-issues.md`
- `resources/learnings/support-qa/social-stream-configuration.md`
- `resources/learnings/support-qa/social-stream-qa.md`
- `resources/learnings/support-qa/social-stream-qa-expanded.md`
- `resources/learnings/product-notes/social-stream-architecture.md`
- `resources/learnings/playbooks/playbook-obs-overlay-issues.md`
- `resources/learnings/playbooks/playbook-tiktok-connection.md`
- `resources/learnings/playbooks/rapid-response-decision-tree.md`
- `resources/learnings/playbooks/triage-macros.md`

### P1 Related Product Support Docs

Use only where they directly affect SSN support:

- `resources/learnings/product-notes/electron-capture-notes.md`
- `resources/learnings/product-notes/caption-ninja-notes.md`
- `resources/learnings/cross-product-integration-guide.md`
- `resources/learnings/unresolved-analysis.md`
- `resources/ops/manual-kb-curation-log.md`
- `resources/ops/manual-kb-ops-review.md`
- `resources/ops/playbook.md`

### P0/P1 SQLite Datasets

Prefer these over raw support logs for extraction.

- `resources/knowledge.sqlite`
- `data/sqlite/knowledge.sqlite`
- `data/sqlite/stevesbot.sqlite`
- `data/sqlite/archive.sqlite`

Observed useful tables/counts:

- `knowledge.sqlite`: `mined_threads` = 2,264 rows
- `stevesbot.sqlite`: `support_records` = 499 rows
- `stevesbot.sqlite`: `qa_entries` = 358 rows
- `stevesbot.sqlite`: `transcripts` = 13,272 rows
- `archive.sqlite`: `archived_messages` = 47,600 rows

Observed mined-thread categories:

- `troubleshooting`: 1,116
- `how-to`: 341
- `bug-report`: 260
- `configuration`: 230
- `feature-request`: 172
- `general-discussion`: 70
- `compatibility`: 44
- `performance`: 29
- `other`: 2

### P1/P2 JSONL And Export Datasets

Track these by dataset pattern rather than listing every raw thread file in the main checklist:

- `data/mined-threads/threads-*.jsonl`
- `data/mined-threads/archive/threads-*.jsonl`
- `data/mined-threads/progress-*.json`
- `data/transcripts/**/*.jsonl`
- `data/exports/qa/qa-export-*.json`
- `data/finetune/draft-training.jsonl`
- `data/finetune/review-training.jsonl`
- `data/finetune/triage-training.jsonl`

### P2/P3 Attachments

Use only when a support answer depends on an attached screenshot or image:

- `data/attachments/**`

Do not copy personal support images into generated docs. Summarize anonymously.

## Suggested Query Units For Support Extraction

Use dataset-level passes instead of raw file-by-file passes for support data.

Suggested units:

- `mined_threads where products_json/searchable_text mentions Social Stream or SSN`
- `mined_threads by category`
- `mined_threads by platform keyword: TikTok, YouTube, Kick, Twitch, Rumble, Facebook, Instagram, OBS`
- `support_records where product_id or searchable_text indicates social-stream`
- `qa_entries filtered for social stream terms`
- `archived_messages FTS only for exact symptom confirmation`

## Refresh Commands

Use these commands to refresh this manifest later.

```powershell
cd C:\Users\steve\Code\social_stream
rg --files -g '!node_modules/**' -g '!.git/**' -g '!docs/agents/**' | Sort-Object

cd C:\Users\steve\Code\ssapp
rg --files -g '!node_modules/**' -g '!.git/**' -g '!resources/social_stream_fallback/**' -g '!dist/**' -g '!tmp/**' | Sort-Object

cd C:\Users\steve\Code\stevesbot
rg --files -g '!resources/secrets/**' -g '!logs/**' -g '!data/backups/**' -g '!data/replays/**' | Sort-Object
```
