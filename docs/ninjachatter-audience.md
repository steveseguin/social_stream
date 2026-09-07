# NinjaChatter audience connection preview

The beta extension includes a private room connector and a fixed Cheer overlay preset. NinjaChatter must explicitly enable preview access; existing production rooms and the older chat relay continue to work without it.

In the popup, open **Audience Room · NinjaChatter**, choose **Connect a room**, and copy the temporary code into the owned room's NinjaChatter dashboard. Review the request, approve it, then choose which public sources to publish in SSN. Share the public NinjaChatter room link with viewers. Keep your SSN session/password links private.

Cheer is optional on both sides. Enable it in the room dashboard and SSN, then open your existing SSN Actions overlay. Viewers receive a correlated status when the fixed three-second text effect is sent to the overlay transport. This does not prove OBS displayed it. There is no arbitrary command, URL, file action, points award, or custom Event Flow graph execution in this preview.

Audience replies go to the SSN display feed and bypass platform replies, bots, AI actions, webhooks, Event Flow triggers, and points. Only explicitly selected ordinary public source messages travel to NinjaChatter. Private, suppressed, bot and event rows are excluded. The paired room's legacy capture is suppressed to avoid duplicate display. Legacy outbound relay settings remain saved and resume when you disconnect the new connector.

Pause persists across background restart. Saving source options preserves Pause. Closing the popup leaves the extension background in charge. Lost or expired actions are not replayed automatically; an uncertain effect may be lost. Disconnect locally to remove this installation's pairing, or revoke in the room dashboard to invalidate a compromised credential.

The credential lives in extension-local `ncAudiencePrivate`, separately from exported settings; the popup receives only safe status and the public room ID. Audience pages never receive this credential. Only the packaged popup can operate pairing. Electron and other unqualified runtimes retain the existing relay and show a clear preview limitation.

See [the event reference](event-reference.html#ninjachatter-audience-pilot) for display metadata. Before general availability, real overlay rendering, prolonged browser suspension, sustained load and fleet recovery still need qualification. Local protocol, browser, actual extension and Redis rollback tests live in the NinjaChatter repository as `scripts/community_*_tests.js`.
