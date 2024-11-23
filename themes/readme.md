# Custom Themes

For anyone who wants to create a custom theme/style/template for their chat stream, you can share them via adding them to this repository (in this folder) as a Pull Request.

#### Basic example of how to use

To use the pretty.html example, you can load it up in OBS via:

 https://socialstream.ninja/themes/pretty.html?session=SESSIONIDHERE
 
Just update the URL with your session ID.

![image](https://user-images.githubusercontent.com/2575698/193437666-0f00ef2d-2932-41c4-95b4-9e132f06da83.png)

### Types of themed overlays

This `pretty.html` style uses IFRAMES and URL parameters to inject styles into the existing dock.html page, while adding an overlay image on top of it all. Essentialy, you're not modifying the code directly for dock.html, but rather agumenting it with insertions and layers.

Another way to do the same approach of agumenting the dock's style is with the built in style options that exist in the menu of the app or by inserting CSS directly into the OBS style sheet section.  This approach is outside the scope of this document though.

The third approach to making a custom style is by just directly modifying the dock.html code, creating your own copy, or ideally, using the [simple boiler-plate overlay](https://socialstream.ninja/sampleoverlay.html) and styling that to your needs.  With the rise of ChatGPT et al, it's easier than ever to modify the sample overlay code to create your own overlays.

#### making custom styles using IFRAMES and CSS injectino

If making your own custom style, you can refer to the pretty.html's code for example usage.

You'll notice it uses IFRAMES, which makes it easy to keep your own template code separated from dock.html code. This helps reduce complexity and improves organization.

You'll also notice in the that you can use `&cssb64` to pass custom stylesheets to the dock page, so you can still stylize it without needing an OBS style to be applied.

Finally, you might also notice that you can use transparent images as an overlay for the chat, allowing for pretty complex framing effects for the chat. This allows you to make advanced designs in photoshop, without really needing to know much advanced CSS.

#### making custom overlay pages based on the sample overlay boilerplate

I'll move forward assuming any custom overlay is based on the sample overlay boilterplate code, as a hard-coded modification.

The sample code is here: [Sample Theme - code](https://github.com/steveseguin/social_stream/blob/main/sampleoverlay.html)

If using ChatGPT or Claude to help you modify this code, you can try copy/pasting the entire page of code in as part of your prompt. Be sure that the IFRAME messaging logic isn't modified.

For more detail about how the message structure looks for incoming messages, see: [https://socialstream.ninja/landing#message-structure](https://socialstream.ninja/landing#message-structure)

## Testing Themes

For most users, using the "Trigger a test message" button at the top of the app's menu is sufficient for testing styles out without going live.  However, if you want to create a custom message, with perhaps a custom donation amount, you can visit the [sample API sandbox page here.](https://socialstream.ninja/sampleapi.html).  The option to create sample messages is near the bottom. You will need to enable the API support via the app's menu if you intend to use the sandbox API page however.

## Themes

### Themes with folders

These themes have folders with normally a readme; sample photos maybe and possibly a guide

[Deuk's Theme](https://socialstream.ninja/themes/deuks_overlay)

[Windows3.1 Theme](https://socialstream.ninja/themes/Windows3.1)

[Neutron Theme](https://socialstream.ninja/themes/Neutron)

### Themes without support material

These overlays are just drop-in replacements for the existing dock.html page. No additional documention is provided beyond what is shown here.

To use, add `?session=XXXXXXX` to the end of the URLs, where XXXXXXX is your session ID.

[Sample Theme](https://socialstream.ninja/sampleoverlay.html)

[Pretty Theme](https://socialstream.ninja/pretty.html)
