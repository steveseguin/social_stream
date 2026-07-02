# State Nodes in Event Flow System

## How State Nodes Work

State nodes maintain persistent state between message events, acting as intelligent filters/controllers in your event flows.

## Available State Nodes

### 🚦 GATE Control
- **Purpose**: Acts as an on/off switch for message flow
- **States**: ALLOW (messages pass) or BLOCK (messages stop)
- **Control**: Use `setGateState` action to change state
- **Example**: Block duplicate triggers during OBS scene switches

### 📋 QUEUE (Message Queue)
- **Purpose**: Buffers messages and processes them sequentially
- **Config**: maxSize, overflowStrategy (DROP_OLDEST, DROP_NEWEST, DROP_RANDOM)
- **Note**: Currently requires manual implementation of queue processing

### 🎛️ SEMAPHORE
- **Purpose**: Limits concurrent operations
- **Config**: maxCount (how many can run simultaneously)
- **Use Case**: Limit simultaneous webhook calls or resource-intensive actions

### 🔒 LATCH Memory
- **Purpose**: Once triggered, stays "on" until manually reset
- **Config**: resetOnTrigger (boolean)
- **Use Case**: One-time triggers, first-viewer rewards

### ⏲️ THROTTLE (Rate Limiter)
- **Purpose**: Limits how often messages can pass through
- **Config**: intervalMs, maxPerInterval
- **Use Case**: Prevent spam, rate-limit commands

### 🎬 SEQUENCER
- **Purpose**: Ensures messages are processed in order
- **Config**: sequenceField (which field to track)
- **Use Case**: Process events in exact order

## How to Control State Nodes

State nodes are controlled through specific actions:

1. **setGateState** - Changes a GATE node between ALLOW/BLOCK
   - Config: `targetNodeId`, `state` (ALLOW or BLOCK)

2. **resetStateNode** - Resets any state node to initial state
   - Config: `targetNodeId`

## Example Workflow: OBS Scene Switch with Gate

```json
Trigger (!hello) → GATE → Change Scene → Close Gate → Delay → Switch Back → Open Gate
```

This prevents multiple !hello commands from triggering while the first is still processing.

## Important Notes

- COUNTER, USERPOOL, ACCUMULATOR nodes are defined but not yet implemented
- State nodes must be connected properly (fixed in latest update)
- State persists across messages until explicitly changed or reset
- Some state nodes (QUEUE) need additional actions for full functionality

## Connection Rules
State nodes can now:
- Receive connections FROM: Triggers, Actions, Logic nodes, other State nodes
- Send connections TO: Actions, Logic nodes, other State nodes