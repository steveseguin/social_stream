# Discord Source

Status: framework only. Detailed extraction not started.

## Purpose

Document Discord source behavior and how it differs from Discord support-data sources in `stevesbot`.

## Source Anchors

- `social_stream/sources/discord.js`
- `social_stream/docs/event-reference.html`
- `stevesbot/data/sqlite/archive.sqlite`

## Starter Notes

Discord appears both as an SSN source and as the historical support data origin. Keep those separate: Discord source docs should describe SSN capture behavior, while support KB docs should describe mined support history.

## Planned Sections

- Discord as platform source
- Message fields
- Attachments/media
- Common source failures
- Difference from support archive data
