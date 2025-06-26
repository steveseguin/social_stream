# Timeline Animation Editor

A professional-grade animation editor for creating smooth, complex animations with an intuitive timeline interface. Perfect for creating animated overlays, transitions, and motion graphics for streaming applications.

## Features

### Core Animation Capabilities
- **Multi-object support** with layer management
- **Keyframe-based animation** for all properties
- **Advanced easing functions** including custom cubic bezier curves
- **Onion skinning** for smooth animation creation
- **Real-time preview** at 60fps

### Enhanced Property Animation
- **Transform Properties**: Position (X/Y), Rotation, Scale (uniform and X/Y separate)
- **Visual Properties**: Fill color, stroke color, stroke width, opacity
- **Advanced Effects**: Blur, shadows (color, offset, blur), corner radius
- **Color Animation**: Smooth color transitions between keyframes
- **Path Animation**: Create and edit bezier paths for objects to follow

### Professional Tools
- **Undo/Redo System**: Full history with 50 states
- **Keyboard Shortcuts**: Industry-standard shortcuts for efficiency
- **Snapping & Guides**: Grid snapping and custom alignment guides
- **Zoom & Pan**: Navigate large compositions easily
- **Audio Integration**: Load audio files with waveform visualization

### Object Types
- Rectangle (with rounded corners)
- Circle
- Triangle
- Star
- Custom paths (with bezier curve support)
- Text (coming soon)

### Export Options
- **CSS Animations**: Generate @keyframes code
- **JavaScript**: Web Animations API code
- **JSON**: Save/load project files
- **SVG Animation**: Animated SVG export
- **GIF Export**: (Coming soon)

## Getting Started

1. **Open the Editor**: Load `timeline-editor-enhanced.html` in your browser
2. **Create Objects**: Use the Layers panel to add shapes
3. **Set Keyframes**: Move the playhead and adjust properties
4. **Preview**: Press spacebar to play your animation
5. **Export**: Use the Export button to get your animation code

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Play/Pause | `Space` |
| Add Keyframe | `K` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Y` |
| Delete | `Delete` |
| Select All | `Ctrl+A` |
| Copy | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Duplicate | `Ctrl+D` |
| Save | `Ctrl+S` |
| New | `Ctrl+N` |
| Load | `Ctrl+L` |
| Select Tool | `V` |
| Rotate Tool | `R` |
| Scale Tool | `S` |
| Pen Tool | `P` |
| Toggle Grid | `G` |
| Toggle Onion Skin | `O` |
| Zoom In | `+` |
| Zoom Out | `-` |
| Reset Zoom | `0` |
| Previous Frame | `←` |
| Next Frame | `→` |
| Previous Keyframe | `↑` |
| Next Keyframe | `↓` |
| Go to Start | `Home` |
| Go to End | `End` |

## Animation Workflow

### Basic Animation
1. Select an object
2. Move the timeline playhead to where you want a keyframe
3. Adjust the property (position, scale, rotation, etc.)
4. A keyframe is automatically created
5. Move to another time and adjust again
6. The editor interpolates between keyframes

### Using Easing
1. Select a keyframe in the timeline
2. Choose an easing type from the Animation panel
3. For custom easing, select "Cubic Bezier" and adjust the curve

### Working with Layers
1. Add objects to different layers for organization
2. Lock layers to prevent accidental edits
3. Toggle visibility for cleaner workspace
4. Reorder layers by dragging

### Path Animation
1. Select the Pen tool (P)
2. Click to create path points
3. Drag to create bezier curves
4. Close the path for filled shapes
5. Animate objects along paths

## Tips & Tricks

- **Onion Skinning**: Enable to see previous/next frames as ghosts
- **Audio Sync**: Load audio to sync animations to beats
- **Presets**: Use built-in presets as starting points
- **Multi-select**: Hold Shift to select multiple objects
- **Scrubbing**: Click and drag on the timeline to preview
- **Snap to Grid**: Enable for precise positioning
- **Performance**: Hide layers you're not working on

## Advanced Features

### Custom Bezier Curves
The bezier editor allows you to create custom easing curves:
- Drag control points to adjust acceleration
- Preview the curve in real-time
- Save custom curves for reuse

### Audio Integration
- Load audio files to visualize waveforms
- Sync keyframes to audio beats
- Export animations with audio timing

### Batch Operations
- Select multiple keyframes to move/delete together
- Copy animation from one object to another
- Apply presets to multiple objects

## Performance Optimization

- The editor uses requestAnimationFrame for smooth playback
- Canvas rendering is optimized with dirty rectangles
- Large projects benefit from hiding inactive layers
- Export only the properties you're animating

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support (some audio features may vary)
- Mobile: Touch support for basic editing

## File Formats

- **Project Files**: .json format preserving all animation data
- **Import**: Supports loading previously saved projects
- **Export**: Multiple formats for different use cases

## Integration with Social Stream

The generated animations can be used in Social Stream overlays:
1. Export as CSS or JavaScript
2. Add to your overlay HTML
3. Trigger animations on events (new follower, donation, etc.)
4. Combine with Social Stream's event system

## Troubleshooting

- **Performance Issues**: Reduce onion skin frames or hide layers
- **Export Problems**: Check browser console for errors
- **Audio Not Loading**: Ensure audio file is in a supported format
- **Animations Jumpy**: Check keyframe interpolation settings

## Future Features

- Text animation with per-character control
- Motion blur effects
- 3D transformations
- Video export
- Collaborative editing
- Animation templates marketplace

---

Created for Social Stream Ninja - Professional streaming tools for content creators