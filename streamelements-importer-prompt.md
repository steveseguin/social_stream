# Prompt: Convert A StreamElements Or Streamlabs Chat Overlay To Social Stream Ninja

You are converting a third-party streaming chat overlay into a Social Stream Ninja (SSN) overlay.

First inspect the provided overlay files. Common inputs are HTML, CSS, JS, `fields.json` or `fields.txt`, `data.json` or `data.txt`, local assets, and a screenshot. Also inspect these SSN references before coding:

- `sampleoverlay.html` for the hidden VDO.Ninja iframe bridge, optional WebSocket mode, URL params, message limits, and delete/clear/timeout/block handling.
- `dock.html` for complete SSN message handling examples.
- `docs/customoverlays.md` for custom overlay conventions.
- `docs/event-reference.html` for canonical payload fields. Do not invent new top-level event fields.

Goal: create one standalone `.html` overlay that works in OBS/browser sources with SSN, not inside StreamElements or Streamlabs.

Conversion rules:

1. Remove the platform runtime.
   - Replace `window.addEventListener("onWidgetLoad")`, `window.addEventListener("onEventReceived")`, StreamElements APIs, Streamlabs APIs, jQuery queues, and widget-button test handlers.
   - Do not require StreamElements, Streamlabs, jQuery, or module scripts.

2. Resolve template placeholders.
   - Replace `{{fieldName}}` in CSS/HTML/JS with values from data JSON first.
   - If data JSON is missing a value, use the default from fields JSON.
   - Inline local packaged images, fonts, audio, and video when practical.

3. Use SSN message input.
   - Read messages from `event.data.dataReceived.overlayNinja` through a hidden VDO.Ninja iframe bridge.
   - Also support `&server` / `&server2` WebSocket mode when practical, matching `sampleoverlay.html`.
   - Require `?session=YOUR_SESSION_ID` for live use.

4. Map payload fields.
   - Name: `data.chatname`
   - Message HTML: `data.chatmessage`
   - Avatar: `data.chatimg`
   - Platform: `data.type`
   - Badges: `data.chatbadges` as strings or objects with `src`, `url`, `html`, or `text`
   - Donation/support text: `data.hasDonation` or `data.donation`
   - Membership/subscriber text: `data.membership` and `data.subtitle`
   - Media attachment: `data.contentimg`
   - IDs for deletion: `data.mid`, `data.id`, `data.messageId`, `data.message_id`, or `data.meta.messageId`

5. Preserve SSN controls.
   - Implement `deleteMessage`, `delete.id`, `delete.chatname`, `clearAll`, `action: "clear"`, `timeoutUser`, and `blockUser`.
   - Store `data-mid`, `data-chatname`, and `data-source-type` on each message row.

6. Keep browser compatibility.
   - Use classic scripts, not `<script type="module">`.
   - Avoid top-level `import` / `export`.
   - Keep code Chrome 80 friendly.

7. Keep the visual design, but make it standalone.
   - Use the original CSS structure and assets where possible.
   - Keep the page background transparent for OBS unless a `?testbg` or demo-only parameter is used.
   - Add `?demo` test messages so the overlay can be visually checked without SSN traffic.
   - Support common URL params like `&limit=`, `&hideafter=`, `&badges`, `&scale=`, and `&bottom` when useful.

8. Test before finishing.
   - Open the new HTML with `?demo&testbg`.
   - Confirm messages render, stack correctly, limit removal works, text does not overflow, delete works, and clear works.
   - Test viewer, VIP/mod/subscriber, donation, badge, and content-image cases.

Deliverables:

- A standalone SSN overlay HTML file in the requested folder.
- Any notes about unsupported StreamElements or Streamlabs behavior.
- A brief test summary, including anything that could not be tested locally.
