# Featured Message Overlay Styles

These are modern, stylized overlays for displaying featured messages from Social Stream Ninja. They use an iframe connection to VDO.Ninja to receive messages, just like the main featured.html overlay.

## Available Overlays

### 1. featured-modern.html
Clean, modern styles with smooth transitions:
- **Glass** - Glassmorphism with blur effects and transparency
- **Neon** - Vibrant gradient borders with glow effects  
- **Minimal** - Clean, simple design with subtle shadows
- **Gaming** - RGB animated borders with futuristic styling
- **Twitch** - Twitch-inspired dark theme

### 2. featured-animated.html
Dynamic, eye-catching animations:
- **Bounce** - Messages bounce in with pulsing glow effect
- **Slide** - 3D rotation and slide animation with floating avatar
- **Typewriter** - Terminal-style typewriter text effect
- **Comic** - Comic book pop-in with bold styling
- **Holo** - Holographic effect with scan lines

### 3. featured-3d.html
Advanced 3D transformations and effects:
- **Cube** - Messages displayed on a rotating 3D cube
- **Flip** - Card flip animation revealing the message
- **Float** - Floating layered panels with depth effect
- **Helix** - Spiral helix rotation effect
- **Iso** - Isometric 3D box presentation

### 4. featured-particles.html
Beautiful particle effects with messages:
- **Fireflies** - Glowing fireflies floating around
- **Snow** - Gentle snowfall effect
- **Matrix** - Matrix-style digital rain
- **Bubbles** - Rising bubble animation
- **Stars** - Twinkling starfield background

## Usage

### Basic URL Format
```
featured-modern.html?session=YOUR_SESSION_ID&style=glass
featured-animated.html?session=YOUR_SESSION_ID&style=bounce
```

### Parameters

#### Required
- `session` (or `room`) - Your Social Stream session ID

#### Style Options
- `style` - Visual style to use
  - Modern: `glass`, `neon`, `minimal`, `gaming`, `twitch`
  - Animated: `bounce`, `slide`, `typewriter`, `comic`, `holo`

#### Optional Parameters
- `password` - Session password if required
- `showtime` - How long to display each message in milliseconds (default: 30000)
- `server` - Custom WebSocket server URL (default: wss://io.socialstream.ninja)
- `exit` - Exit animation style for animated overlay: `bounce`, `slide`, `fade`

#### Text-to-Speech
- `tts` - Enable TTS with language code (e.g., `en-US`, `es-ES`)
- `voice` - Specific voice name
- `pitch` - Voice pitch (0.5-2.0)
- `rate` - Speech rate (0.5-2.0)

### Examples

#### Glass style with 10-second display time:
```
featured-modern.html?session=MYROOM&style=glass&showtime=10000
```

#### Bouncing animation with TTS:
```
featured-animated.html?session=MYROOM&style=bounce&tts=en-US
```

#### Gaming style with password:
```
featured-modern.html?session=MYROOM&style=gaming&password=secret123
```

#### Comic style with slide exit:
```
featured-animated.html?session=MYROOM&style=comic&exit=slide
```

#### 3D cube effect:
```
featured-3d.html?session=MYROOM&style=cube
```

#### Matrix rain with particles:
```
featured-particles.html?session=MYROOM&style=matrix&tts=en-US
```

## OBS Setup

1. Add a Browser Source
2. Set URL to one of the overlay files with your parameters
3. Set dimensions to 1920x1080 (or your canvas size)
4. Check "Shutdown source when not visible" and "Refresh browser when scene becomes active"

## Features

- **Auto-reconnect** - Automatically reconnects if connection is lost
- **Full message support** - Displays username, badges, message text, donations, memberships
- **Source icons** - Shows platform icons (Twitch, YouTube, etc.)
- **Content images** - Supports stickers and image attachments
- **Responsive** - Adapts to different screen sizes
- **Name colors** - Preserves user name colors from source platforms
- **Smooth animations** - Professional enter/exit animations

## Customization

You can customize the styles by modifying the CSS in each file. Key areas:
- Colors and gradients
- Animation timing and effects
- Font sizes and families
- Border radius and shadows
- Spacing and layout

## Tips

- Test different styles to find what matches your stream aesthetic
- Adjust `showtime` based on your chat speed
- Use TTS for accessibility or when you can't read chat
- The animated styles work best with shorter messages
- Glass and holographic styles look great over gameplay footage