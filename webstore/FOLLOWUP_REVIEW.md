# Follow-up patches

Current candidate: **3.50.18**. The latest selective backports and verification are recorded below.

# Follow-up patches applied in 3.50.17

Compared Web Store commit `b681e410` with beta `cf23f2b3` and the applicable current beta working-tree edits. The three reviewed fixes are now applied to the candidate and pushed to GitHub `chrome-web-store` as version 3.50.17, commit `aca003af`. The original proposal is [`review/followup-proposed.patch`](review/followup-proposed.patch). Findings below describe the pre-patch comparison; they are resolved in 3.50.17.

## Applied narrow follow-up

1. **Restore legacy server settings correctly.** `popup.js:3822` only finds `data-setting` checkboxes when loading plain boolean settings. The server checkboxes use `data-both`. In a real isolated extension profile, stored `server: true`, `server2: true`, and `server3: true` produced three unchecked switches and no server flags in the generated Dock URL. Beta's one-line selector fix from `ad0bcb60` restores all three checked states and URL flags. This can reproduce the same missing-URL-flags symptom after an upgrade; it does not prove the original reporter had this stored representation.
2. **Complete the settings-save acknowledgement fix.** The shipped `background.js` acknowledges `saveSetting` before the storage callback. Beta waits for persistence and returns `saved`/`error`. Its synchronous runtime-listener wrapper also explicitly keeps the response channel open for asynchronous work. The proposed patch takes these small plumbing changes without beta's new services. Actual extension requests return `saved: true` after saving, and the wrapper's delayed-response contract passes a local compatibility check. No historical Chrome binary was tested.
3. **Add the newer bot-body rendering guard.** The shipped `bot.html` lacks the final shared HTML check for rich chat bodies; the fix is present in the current local beta working tree. The patch checks the display copy while retaining literal plain text and the generated-attachment path. Six benign browser display checks passed for plain/rich/default modes, normal and stacked output, sanitizer invocation and absence of page exceptions. Security assessment here is by code comparison; no exploit was executed against the old page.

The proposed patch touches only `popup.js`, `background.js`, and `bot.html`. It does not add permissions, dependencies, providers, remote code, or re-enable removed functionality.

## Main Dock issue

The existing 3.50.16 fix works with the recommended **server2 + server3** switches while `server` remains off. Re-tested actual extension startup, persisted settings, regenerated URLs, the fake-message button, WhatsApp-shaped payload delivery through a local relay to the actual Dock, switch-off/reopen, co-host authorization and popup search. Those checks also pass with the proposed follow-up.

This adds the two-switch case to the earlier three-switch test. Version 3.50.17 resolves the additional legacy boolean settings gap. Fresh switch activation and legacy restoration both pass.

## Source coverage

All **216 packaged source/provider JS, HTML, CSS and JSON files** already match the current beta working tree. The selected new sources, including Castyr, Discord Streamkit, Stream.space, Worldswave, W.tv and Prime, are already present. No additional non-adult capture source was identified as a useful omission in this comparison.

Unpackaged beta source paths are the previously excluded adult integrations, RPLAY, Velora and its dependencies, an archived Xeenon script, a Twitch preview fixture, and optional emote data. Their absence is not a reason to expand this update.

## Deferred

Beta also has broader server-routing, SDK lifecycle, popup redesign, commerce and AI changes. They are not needed for the confirmed default-Dock fix and were not included in this proposal. The default hosted Dock and bot pages still require their corresponding website changes to be deployed separately from the extension.

Review checks:

```powershell
node webstore/review/followup-relay-review.cjs legacy-settings
node webstore/review/followup-relay-review.cjs two-switches
node webstore/review/followup-bot-compat.test.cjs
```

The regular checks now use the updated 3.50.17 candidate, an isolated Chrome profile and a local relay. They do not depend on the temporary proposed-patch copy. The optional `--proposed` switch remains available for that historical copy. The branch also includes `tests/webstore-settings-compat.test.cjs` to guard legacy flag loading, successful/failed storage acknowledgements, and the synchronous runtime reply-channel contract.

Final 3.50.17 verification: legacy true/false settings, two-switch and three-switch relay delivery, save acknowledgements, six bot-display cases, all 26 Web Store custom-JavaScript restriction assertions, syntax/package audit, and the repository popup-search checks passed. All 810 selected branch package files match the updated candidate SHA-256 inventory.


### 2026-09-27 Selective 3.50.18 Backports

- Escaped bot attachment URLs at all four image/video insertion points.
- Rendered names as literal text in 12 featured themes, including the effect
  labels in Cyberpunk and Retro. Corrected entity handling for plain chat text
  in Bubbles, Cards, Neon Cyberpunk, Particles and Xacception.
- Fixed Event Flow import/duplicate node IDs and remapped connection/state
  references through the editor and template import paths; corrected daily
  scheduling, legacy schedule strings, null timer payload handling, boolean
  event names, raid/cheer minimums, throttle state initialization and fractional
  windows, zero send/relay timeouts, and MIDI note velocity/channel options.
- Fixed numeric active-page selection in saved AI overlays.
- Updated both packaged Twitch TMI variants to respect disabled auto-reconnect.
- Ported Flow Actions HTML audio playback and the keyboard-accessible retry
  button for blocked playback.
- Version and inventory updated to 3.50.18, using selected fixes present in beta
  a5dbd18a. The manifest diff is only its version string; all content-script
  entries, matching rules and injection order are byte-for-byte preserved.

Validation on the package:

- 16 applicable targeted Event Flow/saved-overlay regression cases passed.
  Two assertions were adapted in memory to the existing Web Store behavior:
  the donation-event trigger requires a named paid event, and custom JavaScript
  remains disabled. Beta-only Pin Message UI and the unshipped hourly OBS
  template were excluded. These were test applicability differences, not
  reasons to add those features. The shipped chat-relay template was separately
  imported twice, validating independent IDs and connected wires.
- 22 benign browser attachment cases passed: image/video, media-only/body,
  plain/rich bodies, ordinary and quoted/entity URL characters, stacked output,
  speech/file output and relay/iframe equivalence.
- 45 browser checks passed for the five plain-text themes, including rich
  formatting comparisons. All 12 modified featured themes passed literal-name
  and rich-body display checks; Cyberpunk/Retro effect labels were also checked.
- Flow Actions audio unit checks and a browser keyboard retry passed. Both TMI
  variants passed reconnect-enabled and reconnect-disabled checks.
- All 26 existing Web Store custom-JavaScript restriction assertions passed.
  Package audit parsed 266 scripts and 133 inline scripts with no syntax,
  remote-executable or new dependency findings. The two pre-existing disabled
  Kokoro import references remain the only reported missing dependencies.
- All 810 listed package files match the refreshed candidate SHA-256 inventory.

Verification used local fixtures and mocked services. Live provider sessions,
public relay behavior, Chrome Web Store approval and hosted website deployment
were not tested. Receiver changes reach hosted URLs only after site deployment.
