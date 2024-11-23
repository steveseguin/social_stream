# Custom Themes Documentation

A guide to creating and using custom themes for your chat stream overlay.

## Quick Start

To use a pre-made theme like `pretty.html`, simply add your session ID to the URL:

```
https://socialstream.ninja/themes/pretty.html?session=YOUR_SESSION_ID
```

## Theme Development Approaches

There are three main ways to create custom themes:

### 1. IFRAME Overlay Method
- Uses IFRAMES and URL parameters to inject styles into the existing `dock.html` page
- Adds overlay images on top of the base layout
- Example: `pretty.html` theme
- Benefits: Separates custom code from base functionality

### 2. Built-in Style Options
- Use the app's menu settings
- Apply CSS directly in OBS stylesheet section
- Simplest approach for basic customization

### 3. Direct HTML Modification
- Modify `dock.html` directly
- Create a custom copy of the base template
- Use the [simple boiler-plate overlay](https://socialstream.ninja/sampleoverlay.html)
- Recommended for complex customization

## Development Guide

### Using IFRAMES and CSS Injection

Key features when working with the IFRAME method:

1. Use `&cssb64` parameter to pass custom stylesheets
2. Leverage transparent overlay images for complex framing
3. Reference `pretty.html` code for implementation examples

### Custom Overlay Development

When creating a custom overlay:

1. Start with the [Sample Theme - code](https://github.com/socialstream.ninja/social_stream/blob/main/sampleoverlay.html)
2. Maintain IFRAME messaging logic
3. Review the [message structure documentation](https://socialstream.ninja/landing#message-structure)

## Testing Your Theme

### Basic Testing
- Use the "Trigger a test message" button in the app menu
- Sufficient for most style testing needs

### Advanced Testing
1. Visit the [sample API sandbox page](https://socialstream.ninja/sampleapi.html)
2. Enable API support in the app menu
3. Create custom test messages with specific parameters:
   - Custom donation amounts
   - Different message types
   - Various user roles

## Available Themes

### Full Theme Packages
Complete themes with additional resources:

1. [Deuk's Theme](https://socialstream.ninja/themes/deuks_overlay)
2. [Windows3.1 Theme](https://socialstream.ninja/themes/Windows3.1)
3. [Neutron Theme](https://socialstream.ninja/themes/Neutron)

### Simple Themes
Basic drop-in replacements (add `?session=YOUR_SESSION_ID` to use):

1. [Sample Theme](https://socialstream.ninja/sampleoverlay.html)
2. [Pretty Theme](https://socialstream.ninja/pretty.html)

## Contributing

Contributions for new themes and styles are welcome! Please ensure your theme:
- Has clear documentation
- Maintains core functionality
- Follows existing message structure
- Is tested across different scenarios

For theme folders, consider including:
- README file
- Sample screenshots
- Setup guide
- Any required assets
