# Custom Overlays

Status: framework only. Detailed extraction not started.

## Purpose

Document how custom overlays consume SSN messages and how users can style or build their own pages safely.

## Source Anchors

- `social_stream/docs/customoverlays.md`
- `social_stream/docs/event-reference.html`
- `social_stream/sampleoverlay.html`
- `social_stream/samplefeatured.html`
- `social_stream/themes/**`

## Starter Notes

Custom overlays commonly use either WebSocket/API connection methods or the hidden VDO.Ninja iframe bridge. Existing repo instructions prefer preserving payload structure and using URL-driven CSS/settings when possible.

## Planned Sections

- Message listener patterns
- VDO.Ninja bridge
- WebSocket API
- CSS customization
- Payload compatibility
- Examples
- Common mistakes
