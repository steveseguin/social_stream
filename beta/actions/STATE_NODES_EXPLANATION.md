# State Nodes in Event Flow

State nodes keep information between events in one flow. They are useful when an automation needs to remember whether a gate is open, how many events have happened, whether a rate limit has been reached, or which users have participated.

## Available State Nodes

### Gate

- Holds an `ALLOW` or `BLOCK` value.
- Passes or stops an event on the normal execution path.
- Use `Set Gate State` to change it and `Reset State Node` to restore its configured default.

### Counter

- Holds a numeric value and can check it against a target.
- Use `Set Counter Value`, `Increment Counter`, `Check Counter`, or `Reset State Node`.
- `Check Counter` adds `counterValue`, `counterTarget`, and `counterRemaining` to the event for downstream templates.

### Rate Limiter

- Tracks recent event timestamps and limits how many events may pass during a configured interval.
- Use `Reset State Node` to clear only the selected limiter's recent-event history.

### User Memory

- Owns one named, isolated set of unique users.
- User Memory is a shared resource, not an execution step, so it has no normal input/output ports.
- `Remember User`, `Forget User`, `Clear All Users`, `Pick Random User`, and `User Is Remembered` select a User Memory node by ID.
- The generic `Reset State Node` action can also clear the selected User Memory.
- Users are keyed by platform plus user ID, with username fields used only as a fallback. Events without a usable user identity are ignored.
- Repeated events from one user update that entry's participation count without creating duplicate draw entries.

See the full [User Memory guide](user-memory-guide.html) for screenshots and participation, eligibility, and prize-draw examples.

## Execution Wires and State References

- Solid teal wires show event execution: which node runs next.
- Dashed purple links show a shared User Memory reference: which memory an operation reads or changes.
- A User Memory operation stores the target state node's ID internally. The target can be set from the node properties or by dragging its purple side connector to a User Memory node.
- Selecting a User Memory highlights the operations linked to it. Deleting the memory warns that those references will be removed.

Gate, Counter, and Rate Limiter nodes remain part of the normal execution path. Their control actions also select the target state node by ID, but those relationships currently do not have the dashed canvas link used by User Memory.

## User Memory Persistence and Reset Scope

A User Memory can last for the current app session or be saved across restarts. Each memory also has independent options to clear:

- Manually from its properties.
- Through `Clear All Users` or `Reset State Node` in a flow.
- After a configured period of inactivity.
- When a stream starts.
- When a stream stops.

"Clear All Users" means every user in the selected memory only. It does not clear other User Memory nodes or unrelated Event Flow state.

## Example: Unique Prize Draw

```text
!enter -> Remember User ....> [User Memory: Prize Draw Entrants]
!draw  -> Pick Random User ..> [User Memory: Prize Draw Entrants]
!reset -> Clear All Users ...> [User Memory: Prize Draw Entrants]
```

Use normal role/user checks before `Pick Random User` and `Clear All Users` so only a host or moderator can operate the draw. Enable the draw action's remove-winner option if the same person should not be selected twice.

## Setup Checklist

1. Add and name the state node first.
2. Add the triggers/actions that will read or change it.
3. Select the intended state node in every control operation.
4. Test with at least two users and reset the state between scenarios.
5. For User Memory, verify persistence and automatic-reset settings before going live.
