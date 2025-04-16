# Setting Up Streamer.bot with SocialStreamNinja

This guide will help you set up Streamer.bot to receive and process chat messages from SocialStreamNinja, allowing you to integrate your multi-platform chat streams with Streamer.bot's powerful automation features.

## Prerequisites

- [Streamer.bot](https://streamer.bot/) installed on your computer
- SocialStreamNinja extension configured and running
- Basic understanding of Streamer.bot's interface

## Step 1: Install and Set Up Streamer.bot

1. Download Streamer.bot from the [official website](https://streamer.bot/download)
2. Install and run Streamer.bot on your computer
3. Complete the initial setup wizard if this is your first time running Streamer.bot

## Step 2: Configure Streamer.bot's HTTP Server

1. In Streamer.bot, navigate to **Servers/Clients** in the left menu panel
2. Select **HTTP Server** tab
3. Make sure the HTTP Server is enabled
4. Note the IP address and port (default is 127.0.0.1:7474)
   - Leave these as default unless you have specific network requirements
   - If you change them, you'll need to update the endpoint in SocialStreamNinja

## Step 3: Create a Default Action for SocialStreamNinja

1. In Streamer.bot, click on **Actions** in the left menu panel
2. Click the **Add** button to create a new action
3. Name it "socialstream" (this is the default action name SocialStreamNinja will look for)
4. Add a sub-action by right-clicking on the action and selecting **Add Sub-Action**
5. Choose **Code (C#)** from the menu
6. In the code editor, paste the following code:

```csharp
using System;
using Newtonsoft.Json.Linq;

public class CPHInline
{
    public bool Execute()
    {
        // Extract data from the incoming request
        string platform = args["platform"]?.ToString() ?? "unknown";
        string username = args["data"]["username"]?.ToString() ?? "Unknown User";
        string message = args["data"]["message"]?.ToString() ?? "";
        string userId = args["data"]["userId"]?.ToString() ?? "";
        
        // Log the message to Streamer.bot console
        CPH.LogInfo($"[SocialStream] [{platform}] {username}: {message}");
        
        // Optional: You can broadcast the message to your overlays
        CPH.WebsocketBroadcastJson(new {
            event_type = "SocialStreamChat",
            platform = platform,
            data = new {
                username = username,
                userId = userId,
                message = message,
                timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")
            }
        });
        
        // Optional: Trigger different actions based on platform
        if (platform.Equals("youtube", StringComparison.OrdinalIgnoreCase))
        {
            // Handle YouTube messages specifically
            CPH.SetArgument("platform_type", "youtube");
            CPH.ExecuteAction("Process YouTube Message");
        }
        else if (platform.Equals("twitch", StringComparison.OrdinalIgnoreCase))
        {
            // Handle Twitch messages specifically
            CPH.SetArgument("platform_type", "twitch");
            CPH.ExecuteAction("Process Twitch Message");
        }
        
        return true;
    }
}
```

7. Click **Compile** to ensure there are no errors
8. Click **OK** to save the sub-action
9. Make note of the Action ID (a long GUID) shown in the action list

## Step 4: Configure SocialStreamNinja

1. Open SocialStreamNinja's settings
2. Find the Streamer.bot integration section
3. Enable "Send all messages to Streamer.bot"
4. The default endpoint (`http://127.0.0.1:7474/DoAction`) should work if you didn't change Streamer.bot's HTTP server settings
5. If you want to use the action ID you noted earlier, enter it in the "Streamer.bot Action ID" field; otherwise, leave it blank and SocialStreamNinja will use the default "socialstream" action

## Step 5: Test the Integration

1. Ensure both Streamer.bot and SocialStreamNinja are running
2. Check that SocialStreamNinja is receiving chat messages
3. Monitor the Streamer.bot console for incoming messages
4. If messages appear in the Streamer.bot console, the integration is working

## Advanced Configuration

### Creating Platform-Specific Actions

You can create specific actions for different platforms by:

1. Creating new actions in Streamer.bot (e.g., "Process YouTube Message")
2. Adding custom logic for each platform
3. Referencing these actions in the main SocialStream action as shown in the code example

### Using WebSocket for Overlays

If you want to display SocialStreamNinja chats in your stream overlays through Streamer.bot:

1. In Streamer.bot, go to **Servers/Clients** → **WebSocket Server**
2. Make sure the WebSocket Server is enabled
3. In your browser source or overlay, connect to Streamer.bot's WebSocket server
4. Listen for the "SocialStreamChat" event type from the code example above

### Troubleshooting

- If messages aren't appearing in Streamer.bot:
  - Check that both applications are running
  - Verify the HTTP server is enabled in Streamer.bot
  - Ensure the endpoint in SocialStreamNinja matches Streamer.bot's HTTP server
  - Check for any firewalls blocking the connection
  - Look for error messages in both applications' logs

- If the action isn't triggering:
  - Make sure the action name is "socialstream" if you're using the default
  - Verify the action ID in SocialStreamNinja if you're using a custom action

## Conclusion

You now have SocialStreamNinja integrated with Streamer.bot! This setup allows you to leverage Streamer.bot's powerful automation features with chat messages from multiple platforms, collected by SocialStreamNinja.

From here, you can create complex workflows, trigger alerts, modify your stream elements, and much more based on chat activity from any platform that SocialStreamNinja supports.