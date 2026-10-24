# Illustrated featured chat

In the popup, open **Featured chat overlay** and choose an **Illustrated** preset. Preview all eight in the [overlay gallery](../../../docs/overlay-gallery.html). Add the generated URL as an OBS browser source; start at 960 × 640 and resize to taste. The canvas is transparent; artwork appears and disappears with the featured message.

| Preset | Style parameter |
| --- | --- |
| Strawberry Cat | `art-cat` |
| Good Company (corgi) | `art-dog` |
| Pumpkin Haunt | `art-halloween` |
| Merry Little Reindeer | `art-christmas` |
| Midnight Mixtape | `art-music` |
| Moss & Mushrooms | `art-forest` |
| Moon Bunny | `art-space` |
| Crystal Guardian | `art-dragon` |

Direct example: `themes/featured-styles/featured-modern.html?session=YOUR_SESSION_ID&style=art-cat`. Existing `password`, `showtime` (milliseconds; `0` keeps the message visible), `autoshow` and TTS options belong to the same featured-modern page. Select messages in the dock as usual. Narrow sources put the character above the card. Reduced-motion settings disable the entrance transition.

Original artwork generated with the built-in imagegen tool; the exact prompt set is in [prompts.json](prompts.json). Packaged WebP assets preserve transparency and only the chosen mascot loads. No external artwork service, new dependency, or additional message transport is needed.

Validation: `node tests/featured-artwork-ssapp.e2e.cjs` exercises all presets in an isolated SSApp runtime using fictional iframe messages, plus narrow wrapping, plain text, donations, clearing and timeout. Gallery capture and maintenance use the existing [gallery workflow](../../../docs/data/overlay-gallery-maintenance.md).


## Matching chat and alerts

For quick setup, choose **Use matching set** on any illustrated card in the overlay gallery. Enter your session ID once to get chat, featured-message and alert links, with one **Animate characters** toggle for all three. Copy each link into its own OBS Browser Source. Session and password fields are not saved.

The same eight Illustrated presets are also in **Pre-styled chat overlays** and **Multi-alerts ? Variants / Presets**. Choose the same name on each surface, or mix alert categories. All reuse the packaged artwork above.

- Regular chat: `themes/compact-clean.html?session=YOUR_SESSION_ID&style=art-cat`. The illustrated column defaults to 480px maximum; `width=600` overrides this. Existing reverse order, limits, timed hiding, badges and avatar controls still apply.
- Alerts: `multi-alerts.html?session=YOUR_SESSION_ID&donostyle=art-cat`. Use `followstyle`, `substyle`, `bitsstyle`, `raidstyle`, `auctionstyle`, or `hypestyle` for other categories. Existing alert opt-ins, queue, timing, custom colors and filters still apply.
- Characters give an occasional gentle bob. Only the newest regular-chat character moves. Enable **Keep illustrated characters still** in each overlay's options, or append `&staticart`, to stop character motion. Reduced-motion preferences stop it automatically. Message entrance/exit animations keep their existing controls.

No additional artwork downloads or animation library are required. Run `node tests/artwork-collections-ssapp.e2e.cjs` for matching-surface and motion checks.
