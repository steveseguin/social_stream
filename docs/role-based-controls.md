# Role-Based Chat Controls

Social Stream can mark incoming messages with role flags such as `bot`, `host`, `mod`, `vip`, and `admin`. Some source captures set these automatically when the platform exposes the role. The popup can also mark users by name so the same role behavior works across sources and overlays.

## Quick Moobot Setup

To hide links from normal Twitch users but keep Moobot links visible:

1. In the popup, open `Global settings and tools` > `Message - Visibility` > `Assign roles/classes to certain users`.
2. Add `moobot:twitch` to `Identify by name who are bots`.
3. In the dock or featured link options, enable `Replace links in messages with just '[Link]'`.
4. Enable `Allow links from bots`.
5. Copy the updated overlay link and use that new URL in OBS/browser sources.

Old overlay URLs will not change by themselves.

## Global Role Lists

These settings classify messages before they are sent to overlays and integrations:

| Setting key | Role | What it does |
| --- | --- | --- |
| `botnamesext` | Bot | Marks matching names as `bot`. Example: `moobot:twitch,nightbot:twitch`. |
| `modnamesext` | Moderator | Marks matching names as `mod`. |
| `hostnamesext` | Host | Marks matching names as `host`. |
| `viplistusers` | VIP | Marks matching names as `vip`. |
| `adminnames` | Privileged/admin | Marks matching names as `admin`. |
| `matchRolesByDisplayName` | Matching behavior | Also checks display names, not just user IDs, when matching role lists. |

Use comma-separated entries. Add a source suffix when needed, such as `name:twitch`, `name:youtube`, or `name:kick`.

## Global Role Filters

These settings affect captured messages before overlays see them:

| Setting key | Effect |
| --- | --- |
| `hidebotsext` | Drops messages from users marked as bots. |
| `hidebotnamesext` | Keeps bot messages but clears the displayed bot name. |
| `hidehostsext` | Drops messages from users marked as hosts. |
| `hidemodsext` | Drops messages from users marked as mods. |

These are stronger than overlay options because filtered messages are not sent downstream.

## Overlay URL Role Options

These are per-overlay URL parameters, mainly for `dock.html` and generated dock links:

| URL param | Effect |
| --- | --- |
| `hidebots` | Hides messages from identified bots in that overlay. |
| `hidebotnames` | Hides names for identified bots in that overlay. |
| `hidehosts` | Hides messages from hosts in that overlay. |
| `hidehostnames` | Hides names for hosts in that overlay. |
| `showonlymods` | Shows only moderator messages. |
| `showonlyvips` | Shows only VIP messages. |
| `nobeepbot` | Prevents bot messages from triggering the overlay beep. |
| `nobeephost` | Prevents host messages from triggering the overlay beep. |
| `nobeepmod` | Prevents moderator messages from triggering the overlay beep. |
| `beeponlymod` | Enables the dock beep and limits it to moderator messages. |
| `showvipbadge` | Adds the local VIP badge to VIP messages. |
| `autofeaturevip` | Automatically features VIP messages. |
| `autofeaturepriv` | Automatically features privileged/admin messages. |

## Link Replacement Exceptions

When `striplinks` is enabled on dock or featured overlays, links are normally replaced with `[Link]`. These URL params keep links visible for trusted roles:

| URL param | Effect |
| --- | --- |
| `allowbotlinks` | Keeps links visible for bot messages. |
| `allowhostlinks` | Keeps links visible for host messages. |
| `allowmodlinks` | Keeps links visible for mod messages. |
| `allowviplinks` | Keeps links visible for VIP messages. |

Example:

```text
dock.html?session=YOUR_SESSION&striplinks&allowbotlinks
```

## Notes

- A role must be present on the message before a role option can apply.
- Twitch usually provides moderator and VIP badges, but third-party chat bots such as Moobot may need to be added manually to `botnamesext`.
- Global filters remove or reshape messages for every destination. Overlay URL params only change that specific overlay URL.
