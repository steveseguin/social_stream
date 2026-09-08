# NinjaChatter audience connection preview

The beta extension includes a private room connector and a fixed Cheer overlay preset. NinjaChatter must explicitly enable preview access; existing production rooms and the older chat relay continue to work without it.

## Connect, share, and test

1. Open **Audience Room · NinjaChatter** in the SSN popup. It is a dedicated section available in beginner mode as well as full mode.
2. Choose **Open room settings**. Create or open your room in NinjaChatter and enable its audience connection (preview access is required).
3. Choose **Connect a room** in SSN, then **Copy pairing code**. In the room dashboard, paste the code, review the request, and approve it. Keep SSN running; the popup can close after approval.
4. Enter source names such as `youtube, twitch` and choose **Save connection options**. Only those ordinary public chat sources are published. Leave this field empty if you only want to receive audience chat.
5. Choose **Copy public link** and share that URL with viewers. It contains only the NinjaChatter room ID. Keep SSN session/password links and connector credentials private.
6. Have a viewer send a message in the public room and check your SSN dock. Check that a message from a selected captured source appears once in the public room. Audience replies return for display; this preview does not send them into Twitch/YouTube chat or trigger commands.

### Optional Cheer

Enable Cheer in the room dashboard and under **Optional: audience Cheer** in SSN, then save the connection options. Use **Open Actions overlay** to open the existing overlay URL SSN has already generated; its session/password and other options are preserved. This is a private production-tool link, not an audience link.

Choose **Test Cheer** to send the fixed three-second text effect to the Actions overlay. This host-only test does not post to room chat or consume a viewer cooldown, and can be used before pairing. It does not enable audience Cheer by itself. A successful status means SSN accepted the send; check the open overlay or OBS preview to confirm it appeared. Viewers can then try the room’s Cheer button and see their own correlated receipt.

There is no arbitrary command, URL, file action, points award, or custom Event Flow graph execution in this preview.

Audience replies go to the SSN display feed and bypass platform replies, bots, AI actions, webhooks, Event Flow triggers, and points. Only explicitly selected ordinary public source messages travel to NinjaChatter. Private, suppressed, bot and event rows are excluded. The paired room's legacy capture is suppressed to avoid duplicate display. Legacy outbound relay settings remain saved and resume when you disconnect the new connector.

Pause persists across background restart. Saving source options preserves Pause. Closing the popup leaves the extension background in charge. Lost or expired actions are not replayed automatically; an uncertain effect may be lost. Disconnect locally to remove this installation's pairing, or revoke in the room dashboard to invalidate a compromised credential.

The credential lives in extension-local `ncAudiencePrivate`, separately from exported settings; the popup receives only safe status and the public room ID. Audience pages never receive this credential. Only the packaged popup can operate pairing. Electron and other unqualified runtimes retain the existing relay and show a clear preview limitation.

See [the event reference](event-reference.html#ninjachatter-audience-pilot) for display metadata. The real Actions page now has a loopback WebSocket rendering test, including single display and timed removal. Actual OBS scene visibility, prolonged browser suspension, sustained load and fleet recovery still need qualification before general availability. Local protocol, browser, actual extension and Redis rollback tests live in the NinjaChatter repository as `scripts/community_*_tests.js`.

### Delivery warnings

A failed chat upload leaves its delivery uncertain and is not automatically retried. Later messages continue while the connector is connected. The popup displays the latest delivery, protocol, or Cheer warning alongside the connection status; a readiness heartbeat does not erase it. Warnings are local to the running connector and clear on disconnect or background restart. Pause, authorization checks, source filtering, and concurrency limits still apply.
