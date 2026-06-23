# Kick Channel Points / Rewards to Event Flow Actions

Short answer: do this in the Event Flow Editor, and keep the Flow Actions overlay open for the sound or media output.

## What Steve should tell the user

Kick calls these channel rewards/redemptions. In Social Stream Ninja they come through as a reward event, so the Event Flow trigger to use is Channel Point Redemption.

This is not configured in the Points System page unless you want SSN's own loyalty points commands. Kick reward redemptions should be handled in Event Flow.

## Exact Setup

1. Create the reward in Kick first.
   - Use the Kick dashboard to create the channel reward.
   - Copy the exact reward title, for example `Sound Alert` or `Play Video`.

2. Open the Kick bridge source.
   - Open `https://socialstream.ninja/sources/websocket/kick.html?channel=YOUR_KICK_CHANNEL`.
   - Click `Sign in with Kick`.
   - Enter or confirm the channel slug, then click `Connect channel`.
   - Keep this page open while streaming.

   The normal popup `Open chat` button for Kick opens `https://kick.com/YOUR_CHANNEL/chatroom`. That can catch visible "redeemed" chat/system messages, but the Kick bridge page is the reliable path for structured reward events.

3. Open the Flow Actions overlay.
   - In the SSN popup, scroll to `Flow Actions`.
   - Click the `Flow Actions` link or copy it.
   - Put that URL in OBS as a Browser Source, or keep it open in a browser.
   - The URL looks like `https://socialstream.ninja/actions.html?session=YOUR_SESSION`.

   Audio clips, media overlays, text overlays, and OBS actions need this page open.

4. Open the Event Flow Editor.
   - In the SSN popup, scroll to `Flow Actions`.
   - Click `Event Flow Editor`.
   - Or open `https://socialstream.ninja/actions/`.

5. Build the flow.
   - Add trigger: `User & Source` -> `Channel Point Redemption`.
   - Set `Reward Name` to the Kick reward title, or leave it blank to match any reward.
   - Optional: add `User & Source` -> `From Source`, set it to `Kick`, then combine both triggers with an `AND` node.
   - Add action: `Overlays & Media` -> `Play Audio Clip`, then paste the audio URL.
   - Add action: `Overlays & Media` -> `Display Media Overlay`, then paste the image/GIF/video URL.
   - Connect the trigger, or the `AND` node, to the action nodes.
   - Save the flow and make sure it is active.

6. Use the importable example if preferred.
   - Import `actions/examples/kick-channel-points-action-flow.json`.
   - Replace `REPLACE_WITH_KICK_REWARD_NAME`.
   - Replace the sample audio and media URLs.
   - Save the imported flow.

## Useful Template Text

Use these in `Show Text`, `Speak Text`, or message actions:

- `{username}`: redeemer display name.
- `{message}`: Kick reward title plus user input when Kick provides it.
- `{source}`: platform name.
- `{meta}`: structured reward data as JSON.

Kick bridge reward payloads use:

```json
{
  "type": "kick",
  "event": "reward",
  "chatname": "ViewerName",
  "chatmessage": "Sound Alert - optional user input",
  "meta": {
    "rewardTitle": "Sound Alert",
    "rewardId": "123",
    "redemptionId": "456",
    "cost": 1000,
    "status": "fulfilled",
    "userInput": "optional user input",
    "redeemer": "ViewerName"
  }
}
```

## Quick Test

In the Event Flow Editor test panel:

1. Set `Source Platform` to `Kick`.
2. Set `Username` to anything.
3. Set `Message` to `redeemed Sound Alert`.
4. Run the test.

If the flow has a reward name filter, the test message must include that reward name.

## Common Failures

- Nothing appears: the Flow Actions overlay is not open, or it is using a different session.
- Kick redemptions do not trigger: the Kick bridge page is not signed in, not connected, or was closed.
- Only chat works: the normal Kick chatroom is open, but the bridge source is not.
- The wrong reward triggers: set `Reward Name` in the Channel Point Redemption trigger.
- Local media does not play: use a reachable URL or the upload button in the Event Flow action properties.
