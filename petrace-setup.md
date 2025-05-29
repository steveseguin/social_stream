# Pet Racing Game Setup Guide

## Quick Start

Add the Pet Racing game to your stream by using this URL:
```
https://socialstream.ninja/petrace.html?session=YOUR_SESSION_ID
```

## URL Parameters

- `session` or `s` - Your Social Stream session ID (required)
- `password` - Session password if needed
- `demo` - Add demo racers for testing
- `server` - WebSocket server URL for direct connection
- `server2` - Secondary server for additional message sources

## Integration with Points System

The game integrates with Social Stream's loyalty points system:
- Players spend points to join races
- Winners receive point rewards from the betting pool
- Pet upgrades cost points and are persistent

## Game Commands

Players can use these commands in chat:

### Racing Commands
- `!race [amount] [pet]` - Join a race by betting points
  - Example: `!race 50 dog`
  - Minimum bet: 10 points
  - Pets: dog, cat, rabbit, turtle, hamster

### Pet Management
- `!upgrade [pet] [stat]` - Upgrade a pet's stats
  - Example: `!upgrade rabbit speed`
  - Stats: speed, stamina, luck
  - Cost: (current level + 1) × 50 points

- `!mypets` - View all your pet upgrades

## Game Mechanics

### Pet Stats
Each pet has three stats that affect racing:
- **Speed**: How fast the pet moves
- **Stamina**: How long they can maintain speed
- **Luck**: Chance for speed boosts and avoiding obstacles

### Base Pet Stats
- **Dog** 🐕: Speed 1.2, Stamina 0.8, Luck 0.5
- **Cat** 🐈: Speed 1.0, Stamina 0.9, Luck 0.7
- **Rabbit** 🐰: Speed 1.5, Stamina 0.6, Luck 0.4
- **Turtle** 🐢: Speed 0.5, Stamina 1.5, Luck 0.8
- **Hamster** 🐹: Speed 0.9, Stamina 0.7, Luck 1.0

### Prize Distribution
- 1st Place: 70% of the betting pool
- 2nd Place: 20% of the betting pool
- 3rd Place: 10% of the betting pool

### Race Rules
- Races start automatically 30 seconds after the first bet
- Minimum 2 racers required (otherwise bets are refunded)
- Each player can only enter one pet per race
- Random events during races:
  - Lucky speed boosts (based on luck stat)
  - Occasional stumbles (slows pet briefly)
  - Stamina affects speed when low

## Customization

The game appearance can be modified by editing the CSS in petrace.html:
- Track colors and design
- Pet sizes and effects
- UI overlay styling
- Animation speeds

## Troubleshooting

### Game not receiving messages
- Verify your session ID is correct
- Check that the Social Stream extension is running
- Ensure viewers are using the correct command format

### Points not working
- The game requires the points system files (points.js, pointsactions.js)
- Make sure these are loaded in your main overlay page
- Check browser console for errors

### Visual issues
- The game is designed for 16:9 aspect ratios
- Adjust CSS for different stream layouts
- Pet emojis may display differently on various systems