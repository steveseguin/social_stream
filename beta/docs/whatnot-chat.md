# Whatnot chat and auctions without video

In SSApp 0.4.32 or newer, choose **Whatnot**, paste a live show link or its full show
ID, and activate the source. The default WebSocket mode captures public chat and
auction updates without loading the video or requiring sign-in. Use the updated
Social Stream source files and settings. Add a separate source for each show.

Use the show's `/live/UUID` link; a seller profile is not a show. Regional links
such as `/en-GB/live/UUID` work with the updated source page. On older app builds,
paste the UUID alone. The regular website capture mode remains available.

Chat follows your existing capture, message history, and export settings. Only new
chat is captured on first connection; the initial recent-message snapshot is skipped.
Distinct messages with identical text remain separate.

Enable **Capture Stream Events** for auction starts, bids, auction ends, sale and
payment notifications supplied by Whatnot, giveaway starts and winners, and
giveaway-count/pinned-item updates.
Auction events include available product IDs, titles, bidder/buyer details, bid
counts, prices, currencies, and end times. An auction ending or an item being sold
does not confirm payment. See the [Whatnot event reference](event-reference.html#whatnot)
for fields and Event Flow configuration. Website mode also captures catalog and
auction display snapshots from rendered sections.

The source reconnects automatically. It recovers unseen chat from Whatnot's limited
recent-message snapshot and keeps up to 2,000 message IDs per show in session storage
to suppress repeats across reconnects and reloads. Closing the source ends that
reload history. Long outages can exceed the recent-chat snapshot; auction events
have no recovery snapshot. Keep the source connected when recording a show.

This mode receives public events only. It does not send chat, place bids, sign in,
or automatically follow a seller's next show. Use SSApp for the lightweight mode;
the ordinary browser extension uses the Whatnot website capture mode.

For direct setup, `sources/websocket/whatnot.html` accepts `?channel=SHOW_UUID`,
`?videoId=SHOW_UUID`, or `?url=WHATNOT_LIVE_URL`.
