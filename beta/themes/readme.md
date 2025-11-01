# Custom Themes

For anyone who wants to create a custom theme/style/template for their chat stream, you can share them via adding them to this repository (in this folder) as a Pull Request.

<img src="https://github.com/user-attachments/assets/68b7075f-8205-41e6-9c2d-34863cd3dffe" style="width:250px;"><img src="https://user-images.githubusercontent.com/2575698/193437666-0f00ef2d-2932-41c4-95b4-9e132f06da83.png" style="width:250px;">

## Quick Start

To use a pre-made theme, you have two hosting options:

### 1. Official Hosted Themes
Use themes hosted on the official domain:
```
https://socialstream.ninja/themes/pretty.html?session=YOUR_SESSION_ID
```

### 2. Local Hosting
Run themes from your local file system:
```
file:///C:/path/to/your/theme.html?session=YOUR_SESSION_ID
```

> **Important**:
 - Always append the session parameter correctly, regardless of hosting method.
 - If Local Hosting, you may need to use &server mode if using this with OBS +v31

## Available Themes

### Themed Packages (with documentation)
These themes include readme files, sample photos, and guides:

- [Deuk's Theme](https://socialstream.ninja/themes/deuks_overlay)
- [Windows3.1 Theme](https://socialstream.ninja/themes/Windows3.1)
- [Neutron Theme](https://socialstream.ninja/themes/Neutron)

### Simple Drop-in Themes
Add `?session=XXXXXXX` to these URLs, replacing XXXXXXX with your session ID:

- [Sample Theme](https://socialstream.ninja/sampleoverlay.html)
- [Pretty Theme](https://socialstream.ninja/themes/pretty.html)
- [t3nk3y's Theme](https://socialstream.ninja/themes/t3nk3y/)

### YouTube-CSS compatible Theme Template:
You can use a CSS designed for YouTube with our YouTube-structured overlay page:

- [YouTube-CSS friendly Overlay here](https://socialstream.ninja/septapus)
- [Create a custom style for it with Septapus](https://chatv2.septapus.com/)

## Theme Development Approaches
Make your own custom theme. It's super easy when using an LLM AI service like Claude.ai 🤖

### Recommended: Modifying the Sample Overlay
- Start with [sampleoverlay.html](https://socialstream.ninja/sampleoverlay.html)
- Benefits:
  - Compact, focused codebase
  - Compatible with AI language models for assistance
  - Contains instructional comments
  - Single-purpose functionality
  - Easier to maintain and debug
  - Clear documentation of available options

### Types of Themed Overlays

1. **IFRAME Overlay Method**
   - Uses IFRAMES and URL parameters to inject styles into the existing dock.html page
   - Example: The `pretty.html` style adds overlay images on top
   - Good for maintaining separation from core code

2. **Built-in Style Options**
   - Use the app's menu settings or OBS stylesheet section
   - Outside the scope of this document

3. **Sample Overlay Modification**
   - Modify the [simple boiler-plate overlay](https://socialstream.ninja/sampleoverlay.html)
   - Best for custom themes with AI assistance
   - For message structure details, see: [Message Structure Documentation](https://socialstream.ninja/landing#message-structure)

4. **YouTube-structured CSS-only mods**
   - You can use a CSS designed for YouTube with our YouTube-structured overlay page
   - The [YouTube-CSS friendly Overlay is here](https://socialstream.ninja/septapus), which contains more information.

> **Warning**: Direct modification of `dock.html` is not recommended due to its complexity and size.

### Theme-less Code-Only Examples

If you want as little code needed, to help you Vibe Code something for Social Stream Ninjafrom scratch, please see the [Bare Template](https://github.com/steveseguin/social_stream/blob/main/baretempate.html). I don't have anything more basic than this, but it should be enough to copy/paste into a half-decent LLM service and get something that works with Social Stream Ninja.

If you're still not having luck with your vibe coding efforts, let me know, however I do not offer help with debugging of code that I did not write.

## Testing Themes

### Basic Testing
- Use the "Trigger a test message" button in the app menu

### Advanced Testing
- Visit the [sample API sandbox page](https://socialstream.ninja/sampleapi.html)
- Enable API support via app menu
- Create custom test messages near the bottom of the page

## OBS Compatibility Notes
### OBS v31 and Iframe Limitations
Starting with OBS v31, there are important considerations for custom themes:

- Cross-origin iframes will not load as browser sources in OBS v31 on PC and Linux (this was already the case for Mac)
- Custom themes using webRTC via VDO.Ninja iframes (hosted on vdo.socialstream.ninja) may be affected

### Solutions and Workarounds
1. **Official Theme Hosting**
   - Submit your custom themes via PR to be hosted on socialstream.ninja
   - Themes hosted on the official domain will work properly with OBS v31
   - Approved PRs to main branch are automatically deployed and available via the website

2. **WebSocket API Alternative**
   - For cases where iframes aren't suitable, use the WebSocket API
   - Enable with the `&server` parameter or such, as the code requires to trigger. You may need to enable it in the extension/menu as well.
   - When using the Standalone app with local server option, use `&localserver&server` to utilize the local WebSocket server
   - May require additional setup if the websocket listening code is not already configured in sample code to be used; see dock.html for reference in that case.

## Contributing

When submitting themes:
1. Include clear documentation
2. Provide setup instructions
3. Add sample screenshots if possible
4. Test thoroughly
5. Maintain core functionality
6. Follow existing message structure

Benefits of contributing to the official repository:
- Automatic hosting on socialstream.ninja domain
- Included in official theme collection
- SSL/HTTPS support
- Consistent availability
- Included in any granted access permissions
- The P2P IFRAMES mode will work in OBS v31

Alternatively, you can self-host using local files, just ensure proper session parameter usage.

For support or questions, check the [official documentation](https://socialstream.ninja/landing).

Contributions for more themes and styles are welcome!
