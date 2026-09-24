# Whatnot chat without video

In SSApp 0.4.32 or newer, choose **Whatnot**, paste a live show link or its full show
ID, and activate the source. The default WebSocket mode connects to public chat
without loading the Whatnot website or video. Add a separate source for each show.
This also requires the updated Social Stream source files and settings.

The page is `sources/websocket/whatnot.html`. It accepts `?channel=SHOW_UUID`,
`?videoId=SHOW_UUID`, or `?url=WHATNOT_LIVE_URL`. Use the show's `/live/UUID` link;
a seller profile is not a show. The existing website capture mode remains available.

Messages use the existing Whatnot parser and normal `type: "whatnot"` payloads,
including message IDs and show topics. SSApp's existing capture settings, local
message database, and Message Browser export apply. Only new chat is captured on
first connection; the initial recent-message snapshot is skipped.

The client checks heartbeat replies and reconnects with a delay capped at about
30 seconds. On reconnect, it recovers unseen messages from Whatnot's limited recent
snapshot (20 messages in testing). This cannot recover a long outage or provide a
complete chat archive. The source keeps up to 2,000 message IDs in session storage
to suppress repeats across reconnects and page reloads; it does not store chat text
there. Closing the source ends that reload history.

Whatnot currently checks the connection's Origin. The existing SSApp `wss.origin`
setting is applied only to the Whatnot chat source. An ordinary hosted browser page
or Chrome-extension tab does not have that SSApp connection setting; use the desktop
app for this mode. The regular Whatnot website content script remains available in
the extension. This uses Whatnot's website chat protocol, which can change.

## Deferred work

- [ ] Auction, sale, and commerce events in chat-only mode.
- [ ] Sign-in, authenticated access, and sending messages.
- [ ] Seller-name lookup and following the seller's next show automatically.
- [ ] A separate browser-extension transport for chat-only mode.

The chat-only client subscribes only to `chat:SHOW_UUID` and forwards `new_msg`
chat rows through the existing parser. It does not subscribe to the auction socket
or run the website's commerce/auction DOM polling.

## Validation

Tested September 24, 2026 in the real Windows SSApp 0.4.32 source windows using an
isolated profile and local beta source files. Public chats from summitmetals and
edcplug were captured with the source windows hidden. Both pages contained zero
video, audio, or iframe elements. The regular Whatnot page was not needed.

The run covered the Add Whatnot form (including invalid seller-profile input),
initial-history suppression, forced socket closure, page reload, a 29-second
network interruption with recovery of an unseen message, heartbeat timeout and
reconnection, source stop/start, and compact layout at 460 pixels. The existing
Message Browser Download button exported a snapshot of 100 messages: all had text
and distinct Whatnot message IDs, with messages from both shows.

This was a functional integration run, not a long-duration soak or a macOS/Linux
runtime test. JSON comparison checks also confirmed that all other platform
settings and existing manifest entries/permissions were unchanged.
