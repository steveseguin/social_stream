# Final chat HTML check: local profile

The initial extra HTML check was benchmarked in an offline harness before implementation. After approval, **Dock and Featured now include a final HTML-only display check in the working tree**, using `shared/utils/chatHtml.js`. Plain `textonly=true` bodies bypass it. This does not mean the changes have been pushed or deployed. The command-forwarding and Lite Twitch fallback fixes are separate changes.

## Implemented behavior

- Dock checks a local display copy once before trimming/row construction; opening stored user history checks each HTML body at that display boundary. Stored/transmitted bodies are not overwritten by these checks.
- Featured checks after its existing delay and stale-render cancellation. Both normal and stacking layouts use that checked copy. Literal bodies use `textContent`; generated image/video attachments bypass the chat-body check.
- The display policy reuses the packaged sanitizer and CSS parser with presentation rules for reply colors, ordinary formatting, stacked emotes, image dimensions, links, and inline SVG. The relay's existing sanitizer policy is unchanged. Unlike the initial candidate, `<i style="color:red">reply</i>` retains its color.
- There is no URL-version bypass. If the display helper cannot load, HTML falls back to literal text.
- All 67 final-display checks pass, including five legacy injection configurations that executed a harmless marker before the change. The 117 text-contract checks, 68 security-boundary checks, 23 secondary-processing checks, original sanitizer corpus, reply-color suite, and overlay text-only regressions also pass.

The initial profile below is retained for comparison. The benchmark now exercises the production call sites, disabling only the final body check in its offline baseline. See [the implemented-policy measurements](chat-sanitizer-profile-2026-09-26-final.json).

The implemented-policy follow-up ran three pairs per surface, 2,000 messages per run, with the normal HTML mix (24,000 messages total). All 12 runs passed. Median Dock filter time was **0.02495 ms/message**, equivalent to **12.5 ms/second or about 1.25% of one core at 500 messages/second**. This remains an elapsed-time projection, not an isolated process-CPU measurement. Featured made one body-filter call per HTML run.

Follow-up Dock throughput medians were 365/s without and 356/s with the check; ranges were 361-370/s and 314-361/s. Normalized Chromium CPU medians were 23.77% and 24.51%. The slowest guarded run varied substantially, so do not interpret the filter-time projection as a guarantee about total page CPU or rendering throughput. Featured still handled about 500 incoming messages/second, with roughly 0.6% normalized Chromium CPU in either variant. Warm standalone filtering of a legacy styled HTML fixture took about 15.8 microseconds/message.

Run the current implementation profile with `node tests/chat-sanitizer-benchmark.cjs --duration=4 --rounds=3 --workload=html_mix --output=docs/chat-sanitizer-profile-2026-09-26-final.json`.

## Initial candidate results

Test machine: Windows, Intel Core i5-1235U, 12 logical CPUs, 31.71 GiB RAM. Browser: Playwright Chromium 153.0.8010.12. All 36 full-profile runs completed without page errors and displayed their final message: 108,000 measured messages across both surfaces, excluding warmups.

The extra filter is relatively cheap. Existing Dock rendering is the larger limit in this configuration. These are local browser measurements, not an OBS streaming/encoding benchmark.

### Extra check at 500 messages/second, per overlay

| Chat body | Median filter time per message in busy Dock | Projected filter time per second at 500/s | Equivalent share of one CPU core |
| --- | ---: | ---: | ---: |
| Literal, `textonly=true` | No filter calls | No HTML-filter work | None for HTML filtering |
| Normal HTML mix | 0.024 ms | 12 ms | About 1.2% |
| HTML with 20 emotes | 0.102 ms | 51 ms | About 5.1% |

The HTML estimates use the median total filter time divided by 3,000 messages, then multiply by 500. They are synchronous elapsed-time budgets, including timer/scheduling overhead, **not an isolated measurement of added process CPU**. Across 12 logical CPUs those budgets correspond to roughly 0.10 and 0.43 percentage points of normalized machine CPU. Multiple overlays repeat the work. Other processors, message sizes, and OBS activity will change the cost.

### Complete page workload

Medians of three runs per variant; CPU includes Chromium's processes and existing rendering, not just the candidate check. Normalized CPU divides total process CPU time by elapsed time and 12 logical CPUs. It is not a whole-system utilization measurement and does not weight the processor's different core types.

| Surface / workload | Messages/s without / with check | Normalized Chromium CPU without / with check |
| --- | ---: | ---: |
| Dock, literal text | 500 / 500 | 23.6% / 23.2% |
| Dock, normal HTML mix | 349 / 346 | 24.3% / 24.4% |
| Dock, 20 emotes | 286 / 292 | 25.1% / 25.1% |
| Featured, all three workloads | About 500 / 500 incoming | About 0.6-0.7% / 0.6-0.7% |

Baseline and guarded Dock throughput ranges overlap. The apparent improvement in the heavy case is run variation, not evidence that filtering makes rendering faster. Dock's main thread was about 98-99% busy for HTML workloads, even without the candidate check. It could not sustain 500 rendered HTML messages/second here. Median per-run p95 delivery backlog reached about 2.5 seconds for the normal HTML mix and 4 seconds for 20-emote messages; p95 frame intervals were about 33 and 50 ms respectively.

Featured already waits 500 ms and cancels superseded renders. Placing the check at the final body-render boundary produced **one filter call per 3,000-message HTML run**, after the feed stopped, and zero for plain messages. Thus the incoming rate is not a rate of visible Featured updates. It makes little sense to sanitize every superseded message there.

### Memory and compatibility

End-of-run JavaScript heap snapshots varied with garbage collection. A separate 1,000-message, 20-emote Dock run retained 200 rows and 5,583 DOM nodes in each variant. After forced garbage collection, heap totals were **3.28 MiB without** and **3.43 MiB with** the check. The 0.14 MiB difference is small, but this single short pair neither isolates the filter's retained memory nor establishes long-term leak behavior. These are JavaScript heaps, not total browser/OBS memory. Garbage collection happened outside the timed CPU sample. See [the memory measurements](chat-sanitizer-profile-2026-09-26-memory.json).

The benchmark's already-sanitized fixtures were unchanged by a second filter pass. That does not prove compatibility for all supported markup: the inline-style example below demonstrates a real formatting change. Review that policy before deployment.

## Initial candidate method

The initial harness ran with `--duration=6 --rounds=3` and Playwright available. Historical raw measurements are in [the JSON results](chat-sanitizer-profile-2026-09-26.json). The current harness uses the implemented display policy instead of injecting the initial candidate.

- Actual packaged `filterXSS`, actual Dock/Featured handlers and rendering code, 1280×720 headless Chromium. No network chat, OBS encoding, recording, or live sessions.
- Offer 500 messages/second, 3,000 messages per run, three baseline/guard pairs per surface and workload. Alternate baseline/guard order. An overloaded Dock drains the same 3,000 messages more slowly; achieved throughput and scheduling delay record that backlog.
- Dock retains 200 rows. Messages have one avatar and either literal text, a mix of 70% HTML-mode text / 30% replies with two emotes and a link, or 20 emotes per message. Images are cached, static data-URI pixels, not realistic animated-media decoding.
- The candidate filters only `chatmessage` when it is HTML mode. Inputs have already passed the real sanitizer once, modeling the additional check. Plain messages make zero sanitizer calls. Existing badge checks stay enabled.
- Dock's candidate runs once per received row before its rendering handler. Featured's test-only insertion runs at its actual body-render boundary, after its existing 500 ms delay and stale-render cancellation. Under continuous 500/second input, Featured supersedes intermediate messages; handler throughput is **not** 500 visible featured messages/second. The benchmark waits for the final message to appear.
- Measure synchronous sanitizer time, Chromium process CPU, main-thread busy time, layout/style work, scheduling delay, frame intervals, long tasks, and JavaScript heap. CPU includes browser/renderer/GPU-process CPU time, not GPU hardware utilization. JavaScript heap is not total browser/OBS RAM. Each run must render its final message and complete without page errors.
- The microbenchmark times warm sanitizer calls separately, including rich HTML, SVG, and long text. It reports batch means, not a latency distribution of individual calls. Use the live-page measurements for the busy-Dock estimate.

## URL version and safety

`popup.js:getPopupVersionParam()` puts `chrome.runtime.getManifest().version` into the generated page URL. That records the link-generating extension version. A saved OBS URL can outlive that sender, and the same session can receive other senders. Dock already uses `v` for transport compatibility; that does not make it evidence that each body passed an HTML sanitizer.

Do not use URL version alone to bypass the final check. A skip would need a reliably identified, controlled sender path whose outgoing HTML is checked, rather than a version/clean flag supplied in arbitrary message data. Given the measured cost, that extra complexity needs justification. `textonly=true` is independently cheap: retain literal text and do not invoke the HTML sanitizer.

## Compatibility finding from the initial candidate

The relay sanitizer used in the initial candidate changes `<i style="color:red">reply</i>` into `<i>reply</i>`. It is not an injection-only no-op for every valid legacy style. The implemented display policy addresses the tested formatting cases without broadening that relay policy. The check covers chat HTML rather than the entire generated row, and leaves plain payload text unchanged. Tests cover the supported forms above; they do not establish compatibility with arbitrary custom executable HTML or every possible CSS property.

Command forwarding now converts only HTML-mode commands through an inert template once; plain tag/entity-looking characters survive. Its existing command-prefix/punctuation behavior stays intact. Lite Twitch's missing-body fallback now returns a literal string in plain mode and encoded text in HTML mode. Both defects were reproduced with failing regression tests before their fixes.
