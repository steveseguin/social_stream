For anyone who wants to create a custom theme/style/template for their chat stream, you can share them via adding them to this repository (in this folder) as a Pull Request.

To use the pretty.html example, you can load it up in OBS via:

 https://socialstream.ninja/themes/pretty.html?session=SESSIONIDHERE
 
Just update the URL with your session ID.


If making your own custom style, you can refer to the pretty.html's code for example usage.

You'll notice it uses IFRAMES, which makes it easy to keep your own template code separated from dock.html code. This helps reduce complexity and improves organization.

You'll also notice in the that you can use `&cssb64` to pass custom stylesheets to the dock page, so you can still stylize it without needing an OBS style to be applied.

