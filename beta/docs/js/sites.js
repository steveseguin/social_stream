document.addEventListener('DOMContentLoaded', function() {
    const sitesData = [
        {
            name: 'YouTube Live',
            icon: 'youtube.png',
            description: 'The world\'s largest video platform with live streaming capabilities.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Pop out the chat to trigger (studio or guest view)</li>
                    <li>Alternatively, add &socialstream to the YouTube link</li>
                </ul>
            `,
            notes: 'YouTube Live chat loads automatically when using the popout chat. For best results, use the "Popout Chat" option from YouTube\'s menu.'
        },
        {
            name: 'YouTube Static Comments',
            icon: 'youtube.png',
            description: 'Regular non-live YouTube video comments.',
            type: 'manual',
            instructions: `
                <ul>
                    <li>Click SS in the top right corner of Youtube</li>
                    <li>Select the message you wish to publish inside the YT comment section via the new buttons there</li>
                </ul>
            `
        },
        {
            name: 'Twitch',
            icon: 'twitch.png',
            description: 'Popular gaming and creative content live streaming platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Pop out the chat to trigger</li>
                    <li>URL format: https://*.twitch.tv/popout/*</li>
                </ul>
            `,
            notes: 'Twitch chat popout automatically connects when opened. Channel points redemptions are also supported.'
        },
        {
            name: 'Facebook Live',
            icon: 'facebook.png',
            description: 'Live streaming on Facebook\'s social media platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Works with guest view, publisher view, or the producer's pop-up chat on the web</li>
                    <li>No need to pop out the chat</li>
                </ul>
            `,
            notes: 'Facebook Live chat integration works on the main page. Also works with Workplace.com (using the same setup as Facebook).'
        },
        {
            name: 'Instagram Live',
            icon: 'instagram.png',
            description: 'Live streaming on Instagram\'s social media platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL format: instagram.com/*/live/</li>
                    <li>No need to pop out the chat</li>
                </ul>
            `,
            notes: 'CSS note for styling: [data.type = "instagramlive"]'
        },
        {
            name: 'Instagram Post Comments',
            icon: 'instagram.png',
            description: 'Non-live Instagram post comments.',
            type: 'toggle',
            instructions: `
                <ul>
                    <li>REQUIRES the TOGGLE in menu to enable it</li>
                    <li>Navigate to any Instagram post to capture comments</li>
                </ul>
            `,
            notes: 'CSS note for styling: [data.type = "instagram"]'
        },
        {
            name: 'X Live (Twitter)',
            icon: 'x.png',
            description: 'Live video streaming on X (formerly Twitter).',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Open the chat pop out: https://x.com/XXXXXXXXXX/chat</li>
                    <li>Make sure chat permissions are enabled</li>
                </ul>
            `
        },
        {
            name: 'X Static Posts',
            icon: 'x.png',
            description: 'Static posts on X (formerly Twitter).',
            type: 'manual',
            instructions: `
                <ul>
                    <li>Click "Enable Overlay" in the lower right of X to enable support</li>
                    <li>Manually click posts to select which ones to display</li>
                </ul>
            `
        },
        {
            name: 'Threads.net',
            icon: 'threads.png',
            description: 'Meta\'s text-based social platform.',
            type: 'manual',
            instructions: `
                <ul>
                    <li>Click the little funky star icon, right of the share icon, to select a thread to push to dock</li>
                </ul>
            `
        },
        {
            name: 'TikTok Live',
            icon: 'tiktok.png',
            description: 'Live streaming on the popular short-form video platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL format: tiktok.com/*/live</li>
                    <li>The chat must be left open/visible if using the extension version</li>
                </ul>
            `
        },
        {
            name: 'Discord',
            icon: 'discord.png',
            description: 'Popular communication platform for communities.',
            type: 'toggle',
            instructions: `
                <ul>
                    <li>REQUIRES the TOGGLE in menu to enable it</li>
                    <li>Works with the web version (discord.com)</li>
                </ul>
            `,
            notes: 'See this video for help with toggled integrations: <a href="https://www.youtube.com/watch?v=L3l0_8V1t0Q" target="_blank">https://www.youtube.com/watch?v=L3l0_8V1t0Q</a>'
        },
        {
            name: 'Zoom',
            icon: 'zoom.png',
            description: 'Video conferencing platform with chat functionality.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Works with web version (zoom.us)</li>
                    <li>No need to pop out chat</li>
                </ul>
            `
        },
        {
            name: 'Google Meet',
            icon: 'meet.png',
            description: 'Google\'s video conferencing platform.',
            type: 'toggle',
            instructions: `
                <ul>
                    <li>REQUIRES the TOGGLE in menu to enable it</li>
                    <li>You can specify your own name, rather than "You", via the host/bot section in the extension menu</li>
                </ul>
            `
        },
        {
            name: 'WhatsApp Web',
            icon: 'whatsapp.png',
            description: 'Web version of the popular messaging platform.',
            type: 'toggle',
            instructions: `
                <ul>
                    <li>REQUIRES the TOGGLE in menu to enable it</li>
                    <li>Use at https://web.whatsapp.com</li>
                </ul>
            `,
            notes: 'No avatar support available for WhatsApp integration.'
        },
        {
            name: 'Telegram',
            icon: 'telegram.png',
            description: 'Cloud-based messaging service.',
            type: 'toggle',
            instructions: `
                <ul>
                    <li>REQUIRES the TOGGLE in menu to enable it</li>
                    <li>Use web.telegram.org in stream mode</li>
                </ul>
            `,
            notes: 'See this video for help with toggled integrations: <a href="https://www.youtube.com/watch?v=L3l0_8V1t0Q" target="_blank">https://www.youtube.com/watch?v=L3l0_8V1t0Q</a>'
        },
        {
            name: 'Slack',
            icon: 'slack.png',
            description: 'Business communication platform.',
            type: 'toggle',
            instructions: `
                <ul>
                    <li>REQUIRES the TOGGLE in menu to enable it</li>
                    <li>Use at https://app.slack.com/</li>
                </ul>
            `,
            notes: 'See this video for help with toggled integrations: <a href="https://www.youtube.com/watch?v=L3l0_8V1t0Q" target="_blank">https://www.youtube.com/watch?v=L3l0_8V1t0Q</a>'
        },
        {
            name: 'LinkedIn Events',
            icon: 'linkedin.png',
            description: 'Professional network\'s live events platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Works with linkedin.com/videos/live/* or linkedin.com/videos/events/* or linkedin.com/events/*</li>
                    <li>No need to pop out the chat</li>
                </ul>
            `
        },
        {
            name: 'VDO.Ninja',
            icon: 'vdoninja.png',
            description: 'Free, peer-to-peer, broadcasting tool.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Use the pop-out chat feature</li>
                </ul>
            `
        },
        {
            name: 'Microsoft Teams',
            icon: 'teams.png',
            description: 'Microsoft\'s collaboration platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Works with teams.live.com and teams.microsoft.com</li>
                    <li>No need to pop out the chat</li>
                </ul>
            `
        },
        {
            name: 'Restream.io Chat',
            icon: 'restream.png',
            description: 'Multi-platform streaming service\'s chat.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://chat.restream.io/chat</li>
                </ul>
            `
        },
        {
            name: 'Owncast',
            icon: 'owncast.png',
            description: 'Self-hosted streaming platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Use the demo page: watch.owncast.online</li>
                    <li>For pop-out chat: https://watch.owncast.online/embed/chat/readwrite/</li>
                </ul>
            `
        },
        {
            name: 'Twitch IRC WebSocket',
            icon: 'twitch.png',
            description: 'WebSocket connection to Twitch chat.',
            type: 'websocket',
            instructions: `
                <ul>
                    <li>URL: https://socialstream.ninja/sources/websocket/twitch</li>
                </ul>
            `
        },
        {
            name: 'IRC WebSocket',
            icon: 'irc.png',
            description: 'WebSocket connection to IRC networks.',
            type: 'websocket',
            instructions: `
                <ul>
                    <li>URL: http://socialstream.ninja/sources/websocket/irc</li>
                    <li>Supports Libera Chat and custom IRC servers</li>
                </ul>
            `
        },
        {
            name: 'Kick.com',
            icon: 'kick.png',
            description: 'Emerging live streaming platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Use the pop out chat</li>
                    <li>URL formats: https://kick.com/*/chatroom or https://kick.com/popout/*/chat</li>
                </ul>
            `
        },
        {
            name: 'Rumble',
            icon: 'rumble.png',
            description: 'Video sharing and streaming platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Use the pop out chat</li>
                    <li>URL: https://rumble.com/chat/popup/*</li>
                </ul>
            `
        },
        {
            name: 'Dlive.tv',
            icon: 'dlive.png',
            description: 'Blockchain-based streaming platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Just use the regular viewer page; no pop out needed</li>
                    <li>URL: https://dlive.tv/c/*</li>
                </ul>
            `
        },
        {
            name: 'Odysee',
            icon: 'odysee.png',
            description: 'Blockchain-based media platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Use the pop out chat</li>
                    <li>URL: https://odysee.com/$/popout/*</li>
                </ul>
            `
        },
        {
            name: 'Amazon Live',
            icon: 'amazon.png',
            description: 'Amazon\'s live shopping platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://www.amazon.com/live</li>
                </ul>
            `
        },
        {
            name: 'Vimeo',
            icon: 'vimeo.png',
            description: 'High-quality video platform with live streaming.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Works with vimeo.com/events/xxx pages or https://vimeo.com/live-chat/xxxxxxxxx/interaction/</li>
                </ul>
            `
        },
        {
            name: 'Trovo.live',
            icon: 'trovo.png',
            description: 'Emerging game streaming platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Open the chat pop-up page</li>
                    <li>URL: https://trovo.live/chat/CHANNEL_NAME_HERE</li>
                </ul>
            `
        },
        {
            name: 'Picarto.tv',
            icon: 'picarto.png',
            description: 'Art streaming platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Use the pop-out chat</li>
                    <li>URL: https://picarto.tv/chatpopout/CHANNELNAMEHERE/public</li>
                </ul>
            `
        },
        {
            name: 'Crowdcast.io',
            icon: 'crowdcast.png',
            description: 'Interactive webinar platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://www.crowdcast.io/e/*</li>
                    <li>No pop out needed</li>
                </ul>
            `
        },
        {
            name: 'Mixcloud Live',
            icon: 'mixcloud.png',
            description: 'Audio streaming platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Use the pop out chat</li>
                    <li>URL: https://www.mixcloud.com/live/*/chat/</li>
                </ul>
            `
        },
        {
            name: 'Bilibili.tv',
            icon: 'bilibili.png',
            description: 'Chinese video sharing and streaming platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Use the regular view page with chat; no pop out needed</li>
                    <li>URL: https://bilibili.tv/*/live/*</li>
                </ul>
            `
        },
		{
            name: 'Whop',
            icon: 'whop.png',
            description: 'Pay to view crypto videos.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Use the regular view page with chat; no pop out needed</li>
                    <li>URL: https://whop.com/*</li>
                </ul>
            `
        },
        {
            name: 'Bilibili.com',
            icon: 'bilibili.png',
            description: 'Chinese video sharing website (main domain).',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Use the regular view page with chat; no pop out needed</li>
                    <li>URL: https://live.bilibili.com/*</li>
                </ul>
            `
        },
		{
			name: 'VK Play Live',
			icon: 'vkplay.png',
			description: 'Russian streaming platform (formerly vkplay.live).',
			type: 'popout',
            instructions: `
                <ul>
                    <li>Pop out the chat</li>
                    <li>URL: https://live.vkplay.ru/*/only-chat?*</li>
				</ul>
			`
		},
		{
			name: 'VK Live',
			icon: 'vk.png',
			description: 'Live streaming on VK.com.',
			type: 'standard',
			instructions: `
				<ul>
					<li>No pop out needed</li>
					<li>URL: https://vk.com/*</li>
				</ul>
			`
		},
		{
			name: 'Piczel.tv',
			icon: 'piczel.png',
			description: 'Art streaming platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Use the pop out chat</li>
                    <li>URL: https://piczel.tv/chat/*</li>
                </ul>
            `
        },
        {
            name: 'Locals.com',
            icon: 'locals.png',
            description: 'Subscription-based community platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>No pop out needed</li>
                    <li>URL: https://*.locals.com/post/* or https://*.locals.com/feed/*</li>
                </ul>
            `
        },
        {
            name: 'Nimo.TV',
            icon: 'nimo.png',
            description: 'Global gaming live streaming platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Use the pop out chat</li>
                    <li>URL: https://www.nimo.tv/popout/chat/xxxx</li>
                </ul>
            `
        },
        {
            name: 'Amazon Chime',
            icon: 'chime.png',
            description: 'Amazon\'s communication service.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://app.chime.aws/meetings/xxxxxxxxx</li>
                </ul>
            `
        },
        {
            name: 'AfreecaTV',
            icon: 'afreecatv.png',
            description: 'Korean video streaming service.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Pop out the chat</li>
                    <li>URL: https://play.afreecatv.com/*/*?vtype=chat</li>
                    <li>You can't close the main window it seems though</li>
                </ul>
            `
        },
        {
            name: 'NonOLive',
            icon: 'nonolive.png',
            description: 'Live streaming platform popular in Asia.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>No pop out needed</li>
                    <li>Only partial support added so far</li>
                </ul>
            `
        },
        {
            name: 'StageTEN.tv',
            icon: 'stageten.png',
            description: 'Interactive live streaming platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://*.stageten.tv/* or https://stageten.tv/*</li>
                </ul>
            `
        },
        {
            name: 'Arena.tv',
            icon: 'arena.png',
            description: 'Live streaming platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>No pop out chat support</li>
                    <li>Just pause the video while keeping the chat open</li>
                </ul>
            `
        },
        {
            name: 'BandLab',
            icon: 'bandlab.png',
            description: 'Music creation and sharing platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>No pop out available</li>
                    <li>Just pause the video while keeping the chat open</li>
                </ul>
            `
        },
        {
            name: 'FloatPlane',
            icon: 'floatplane.png',
            description: 'Subscription-based video platform.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Pop out chat</li>
                    <li>URL: https://*.floatplane.com/popout/livechat</li>
                    <li>Main window must remain open</li>
                </ul>
            `
        },
        {
            name: 'ChatGPT',
            icon: 'openai.png',
            description: 'OpenAI\'s conversational AI platform.',
            type: 'toggle',
            instructions: `
                <ul>
                    <li>REQUIRES the TOGGLE in menu to enable it</li>
                    <li>URL: https://chat.openai.com/chat</li>
                </ul>
            `
        },
        {
            name: 'Livestorm.io',
            icon: 'livestorm.png',
            description: 'Professional video communication platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Open the 'external sidebar', which might be a plugin, to capture chat</li>
                </ul>
            `
        },
        {
            name: 'Cozy.tv',
            icon: 'cozy.png',
            description: 'Alternative streaming platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>No pop out needed</li>
                    <li>Just open the view page</li>
                </ul>
            `
        },
        {
            name: 'Steam Broadcasts',
            icon: 'steam.png',
            description: 'Steam\'s built-in broadcasting feature.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://steamcommunity.com/broadcast/chatonly/XXXXXXXX</li>
                </ul>
            `
        },
        {
            name: 'Whatnot',
            icon: 'whatnot.png',
            description: 'Live shopping and auction platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>No pop out available</li>
                    <li>Just open the view page</li>
                </ul>
            `
        },
        {
            name: 'Sessions.us',
            icon: 'sessions.png',
            description: 'Video meeting platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Use the meeting video chat, not popped out</li>
                    <li>You can specify your own name, rather than "You", via the host/bot section in the extension menu</li>
                </ul>
            `
        },
        {
            name: 'Chzzk.naver.com',
            icon: 'chzzk.png',
            description: 'Korean streaming platform by Naver.',
            type: 'popout',
            instructions: `
                <ul>
                    <li>Pop out the chat</li>
                    <li>URL: https://chzzk.naver.com/live/*/chat</li>
                </ul>
            `
        },
        {
            name: 'IRC Quakenet',
            icon: 'irc.png',
            description: 'QuakeNet IRC web client.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://webchat.quakenet.org</li>
                </ul>
            `
        },
        {
            name: 'IRC KiwiIRC',
            icon: 'kiwiirc.png',
            description: 'KiwiIRC web client.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://kiwiirc.com/nextclient/*</li>
                </ul>
            `
        },
        {
            name: 'Webex',
            icon: 'webex.png',
            description: 'Cisco\'s video conferencing platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Use the live chat (not the pop out)</li>
                </ul>
            `
        },
        {
            name: 'Riverside.fm',
            icon: 'riverside.png',
            description: 'Professional recording platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>Just open the chat bar</li>
                    <li>Note: you can opt-out of capture via the extension menu</li>
                </ul>
            `
        },
		{
			name: 'Fansly',
			icon: 'fansly.png',
			description: 'Creator subscription platform.',
			type: 'popout',
			instructions: `
				<ul>
					<li>Pop out chat</li>
					<li>URL: https://fansly.com/chatroom/*</li>
				</ul>
			`
		},
		{
			name: 'Camsoda',
			icon: 'camsoda.png',
			description: 'Adult live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>No pop out needed</li>
					<li>URL: https://www.camsoda.com/*</li>
				</ul>
			`
		},
		{
			name: 'MyFreeCams',
			icon: 'myfreecams.png',
			description: 'Adult live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>No pop out needed</li>
					<li>URL: https://myfreecams.com/* or https://www.myfreecams.com/*</li>
				</ul>
			`
		},
		{
			name: 'TwitCasting',
			icon: 'twitcasting.png',
			description: 'Japanese live streaming platform.',
			type: 'standard',
            instructions: `
                <ul>
                    <li>No pop out needed</li>
                    <li>URL: https://*.twitcasting.tv/* or https://twitcasting.tv/*</li>
                </ul>
            `
        },
        {
            name: 'Bigo.tv',
            icon: 'bigo.png',
            description: 'Global live streaming platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>No pop out needed</li>
                    <li>URL: https://www.bigo.tv/*</li>
                </ul>
            `
        },
        {
            name: 'Substack',
            icon: 'substack.png',
            description: 'Newsletter and publishing platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://substack.com/*?liveStream=* or https://*.substack.com/live-stream/*</li>
                </ul>
            `
        },
        {
            name: 'Roll20',
            icon: 'roll20.png',
            description: 'Virtual tabletop for roleplaying games.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://*.roll20.net/* or https://roll20.net/*</li>
                </ul>
            `
        },
        {
            name: 'On24',
            icon: 'on24.png',
            description: 'Webinar and virtual event platform.',
            type: 'standard',
            instructions: `
                <ul>
                    <li>URL: https://*.on24.com/view/*</li>
                    <li>Q&A questions supported</li>
                </ul>
            `
        },
		{
			name: 'Chaturbate',
			icon: 'chaturbate.png',
			description: 'Adult live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://chaturbate.com/*/</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Cherry TV',
			icon: 'cherrytv.png',
			description: 'Live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://cherry.tv/*</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Claude.ai',
			icon: 'claude.png',
			description: 'Anthropic\'s conversational AI platform.',
			type: 'toggle',
			instructions: `
				<ul>
					<li>REQUIRES the TOGGLE in menu to enable it</li>
					<li>URL: https://claude.ai/*</li>
				</ul>
			`
		},
		{
			name: 'SoulBound.tv',
			icon: 'soulbound.png',
			description: 'Live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://soulbound.tv/*</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Truffle.vip',
			icon: 'truffle.png',
			description: 'Chat platform for creators.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://chat.truffle.vip/chat/*</li>
				</ul>
			`
		},
		{
			name: 'Favorited',
			icon: 'favorited.png',
			description: 'Streaming platform for creators.',
			type: 'popout',
			instructions: `
				<ul>
					<li>Use the studio popout chat</li>
					<li>URL: https://studio.favorited.com/popout/chat</li>
				</ul>
			`
		},
		{
			name: 'Simps',
			icon: 'simps.png',
			description: 'Streaming platform with app-based chat.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://simps.com/app/*</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Pilled.net',
			icon: 'pilled.png',
			description: 'Alternative social media platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://pilled.net/*</li>
					<li>Pop out the chat</li>
				</ul>
			`
		},
		{
			name: 'Portal',
			icon: 'portal.png',
			description: 'Streaming portal platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>No pop out needed</li>
					<li>URL: https://portal.abs.xyz/stream/*</li>
				</ul>
			`
		},
		{
			name: 'Pump.fun',
			icon: 'pumpfun.png',
			description: 'Live trading and chat for Pump.fun coins.',
			type: 'standard',
			instructions: `
				<ul>
					<li>No pop out needed</li>
					<li>URL: https://pump.fun/coin/*</li>
				</ul>
			`,
			notes: 'Keep the coin page open with the live chat visible.'
		},
		{
			name: 'Noice',
			icon: 'noice.png',
			description: 'Audio streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://noice.com/*</li>
					<li>Uses main video chat</li>
				</ul>
			`,
			notes: 'Also works with: https://studio.noice.com/popout/*'
		},
		{
			name: 'NicoVideo',
			icon: 'nicovideo.png',
			description: 'Japanese video streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://live.nicovideo.jp/watch/*</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Rutube',
			icon: 'rutube.png',
			description: 'Russian video streaming platform.',
			type: 'popout',
			instructions: `
				<ul>
					<li>URL: https://rutube.ru/live/chat/*/</li>
				</ul>
			`
		},
		{
			name: 'Moonbeam',
			icon: 'moonbeam.png',
			description: 'Streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://www.moonbeam.stream/*</li>
				</ul>
			`
		},
		{
			name: 'FC2',
			icon: 'fc2.png',
			description: 'Japanese content platform with streaming.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://live.fc2.com/*/</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Vertical Pixel Zone',
			icon: 'verticalpixelzone.png',
			description: 'Streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://verticalpixelzone.com/*</li>
				</ul>
			`
		},
		{
			name: 'Mixlr',
			icon: 'mixlr.png',
			description: 'Audio streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.mixlr.com/events/*</li>
					<li>Note: May be paywalled and limited support</li>
				</ul>
			`
		},
		{
			name: 'Jaco.live',
			icon: 'jaco.png',
			description: 'Live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://jaco.live/golive</li>
				</ul>
			`
		},
		{
			name: 'Gala Music',
			icon: 'gala.png',
			description: 'Music streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://music.gala.com/streaming/*</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Circle.so',
			icon: 'circle.png',
			description: 'Community platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.circle.so/*</li>
					<li>Also works with community.insidethe.show and similar Circle-powered domains</li>
				</ul>
			`
		},
		{
			name: 'Estrim',
			icon: 'estrim.png',
			description: 'Live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://estrim.com/publications/view/*</li>
				</ul>
			`
		},
		{
			name: 'Online Church',
			icon: 'onlinechurch.png',
			description: 'Church streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.online.church/</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Parti',
			icon: 'parti.png',
			description: 'Chat platform.',
			type: 'popout',
			instructions: `
				<ul>
					<li>URL: https://parti.com/popout-chat?id=*</li>
					<li>Pop out chat required</li>
				</ul>
			`
		},
		{
			name: 'Wave Video',
			icon: 'wavevideo.png',
			description: 'Video creation and streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://wave.video/*</li>
				</ul>
			`
		},
		{
			name: 'WebinarGeek',
			icon: 'webinargeek.png',
			description: 'Webinar platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.webinargeek.com/webinar/* or https://*.webinargeek.com/watch/*</li>
					<li>Chat only, no pop out needed</li>
				</ul>
			`
		},
		{
			name: 'uScreen',
			icon: 'uscreen.png',
			description: 'Video monetization platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://www.ilmfix.de/programs/*</li>
				</ul>
			`
		},
		{
			name: 'Zap.stream',
			icon: 'zapstream.png',
			description: 'Live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://zap.stream/*</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'MeetMe',
			icon: 'meetme.png',
			description: 'Social discovery app.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.meetme.com/* or https://meetme.com/*</li>
				</ul>
			`
		},
		{
			name: 'SoopLive',
			icon: 'sooplive.png',
			description: 'Streaming platform.',
			type: 'popout',
			instructions: `
				<ul>
					<li>URL: https://www.sooplive.com/chat/*</li>
					<li>Pop out the chat to use</li>
				</ul>
			`
		},
		{
			name: 'SoopLive Korea',
			icon: 'sooplive.png',
			description: 'Korean version of SoopLive streaming platform.',
			type: 'popout',
			instructions: `
				<ul>
					<li>URL: https://play.sooplive.co.kr/*?vtype=chat</li>
					<li>Pop out the chat to use</li>
				</ul>
			`
		},
		{
			name: 'Beamstream',
			icon: 'beamstream.png',
			description: 'Live streaming platform.',
			type: 'popout',
			instructions: `
				<ul>
					<li>URL: https://beamstream.gg/*/chat</li>
					<li>Open https://beamstream.gg/USERNAME/chat (*note the /chat added at the end)</li>
				</ul>
			`
		},
		{
			name: 'Castr',
			icon: 'castr.png',
			description: 'Live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://chat.castr.io/room/XXXXXXXX</li>
				</ul>
			`
		},
		{
			name: 'Chatroll',
			icon: 'chatroll.png',
			description: 'Embeddable chat service.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://chatroll.com/embed/chat/*</li>
				</ul>
			`
		},
		{
			name: 'Tellonym',
			icon: 'tellonym.png',
			description: 'Anonymous messaging platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://tellonym.me/*</li>
				</ul>
			`
		},
		{
			name: 'LivePush',
			icon: 'livepush.png',
			description: 'Multi-platform chat solution.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://multichat.livepush.io/*</li>
					<li>No input field support</li>
				</ul>
			`
		},
		{
			name: 'Mobcrush',
			icon: 'mobcrush.png',
			description: 'Mobile gaming live streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://studio.mobcrush.com/chatpopup.html</li>
				</ul>
			`
		},
		{
			name: 'MegaphoneTV',
			icon: 'megaphonetv.png',
			description: 'Interactive streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>In Studio, select UGC, then open Recent messages</li>
					<li>URL: https://apps.megaphonetv.com/socialharvest/live/*</li>
				</ul>
			`
		},
		{
			name: 'NextCloud',
			icon: 'nextcloud.png',
			description: 'Self-hosted productivity platform with chat.',
			type: 'standard',
			instructions: `
				<ul>
					<li>Requires domain to be added</li>
					<li>Example URL: https://cloud.malte-schroeder.de/call/*</li>
				</ul>
			`
		},
		{
			name: 'PeerTube',
			icon: 'peertube.png',
			description: 'Decentralized video platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*/plugins/livechat/*router/webchat/room/* or https://*/p/livechat/room?room=*</li>
				</ul>
			`
		},
		{
			name: 'Bitchute',
			icon: 'bitchute.png',
			description: 'Video hosting platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://www.bitchute.com/video/*</li>
					<li>No pop out chat</li>
				</ul>
			`
		},
		{
			name: 'Buzzit',
			icon: 'buzzit.png',
			description: 'Community platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://www.buzzit.ca/event/*/chat</li>
					<li>Community member submitted integration</li>
				</ul>
			`
		},
		{
			name: 'Joystick.tv',
			icon: 'joystick.png',
			description: 'Adult streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://joystick.tv/u/*/chat</li>
				</ul>
			`
		},
		{
			name: 'Rooter',
			icon: 'rooter.png',
			description: 'Game streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.rooter.gg/*</li>
					<li>No pop out available - just pause the video if needed</li>
				</ul>
			`
		},
		{
			name: 'Loco.gg',
			icon: 'loco.png',
			description: 'Game streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.loco.gg/* or https://loco.gg/streamers/*</li>
					<li>No pop out available - just pause the video if needed</li>
				</ul>
			`,
			notes: 'Also works with loco.com domains'
		},
		{
			name: 'ON24',
			icon: 'on24.png',
			description: 'Webinar and virtual event platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.on24.com/view/*</li>
					<li>Q&A questions supported</li>
				</ul>
			`
		},
		{
			name: 'Arena Social',
			icon: 'arenasocial.png',
			description: 'Social streaming platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://arena.social/live/*</li>
				</ul>
			`
		},
		{
			name: 'Versus.cam',
			icon: 'versuscam.png',
			description: 'Testing platform.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://versus.cam/?testchat</li>
					<li>Testing platform</li>
				</ul>
			`
		},
		{
			name: 'Vercel Demo',
			icon: 'vercel.png',
			description: 'Social Stream Ninja demo.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://maestro-launcher.vercel.app/</li>
					<li>Demo launcher</li>
				</ul>
			`
		},
		{
			name: 'CBOX',
			icon: 'cbox.png',
			description: 'Embeddable chat service.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.cbox.ws/box/*</li>
					<li>No pop out needed</li>
				</ul>
			`
		},
		{
			name: 'Wix Live',
			icon: 'wix.png',
			description: 'Live streaming on Wix websites.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://*.wix.com/*</li>
					<li>Also supports embedded Wix video widgets</li>
				</ul>
			`,
			notes: 'Also works with: https://manage.wix.com/dashboard/*/live-video/* and embedded widgets at https://editor.wixapps.net/render/prod/modals/wix-vod-widget/*'
		},
		{
			name: 'Xeenon',
			icon: 'xeenon.png',
			description: 'Live streaming on Xeenon dashboard.',
			type: 'standard',
			instructions: `
				<ul>
					<li>URL: https://xeenon.xyz/dashboard</li>
					<li>Pop out not supported</li>
				</ul>
			`
		}
    ];
    
    // Sort sites alphabetically
    sitesData.sort((a, b) => a.name.localeCompare(b.name));
    
    const sitesGrid = document.getElementById('sitesGrid');
    const siteSearch = document.getElementById('siteSearch');
    const siteModal = document.getElementById('siteModal');
    const modalClose = document.querySelector('.close-modal');
    
    // Populate sites grid
    function populateSites(sites) {
        sitesGrid.innerHTML = '';
        
        sites.forEach(site => {
            const siteItem = document.createElement('div');
            siteItem.className = 'site-item';
            siteItem.setAttribute('data-site', site.name);
            
            // Add tag based on type
            let tagText = '';
            let tagClass = '';
            
            switch(site.type) {
                case 'popout':
                    tagText = 'Popout';
                    tagClass = 'popout';
                    break;
                case 'websocket':
                    tagText = 'WebSocket';
                    tagClass = 'websocket';
                    break;
                case 'toggle':
                    tagText = 'Toggle Required';
                    tagClass = 'toggle';
                    break;
                case 'manual':
                    tagText = 'Manual Selection';
                    tagClass = 'manual';
                    break;
            }
            
            if(tagText) {
                const tag = document.createElement('span');
                tag.className = `site-item-tag ${tagClass}`;
                tag.textContent = tagText;
                siteItem.appendChild(tag);
            }
            
            // Site content
            siteItem.innerHTML += `
                <img src="../sources/images/${site.icon}" alt="${site.name}" onerror="this.src='../sources/images/generic.png';" class="site-icon">
                <h3>${site.name}</h3>
            `;
            
            // Event listener for opening modal
            siteItem.addEventListener('click', () => openSiteModal(site));
            
            sitesGrid.appendChild(siteItem);
        });
    }
    
    // Search functionality
    siteSearch.addEventListener('input', () => {
        const searchValue = siteSearch.value.toLowerCase();
        
        if(searchValue === '') {
            populateSites(sitesData);
            return;
        }
        
        const filteredSites = sitesData.filter(site => 
            site.name.toLowerCase().includes(searchValue) || 
            site.description.toLowerCase().includes(searchValue)
        );
        
        populateSites(filteredSites);
    });
    
    // Open site modal
    function openSiteModal(site) {
        // Set modal content
        document.getElementById('modalIcon').src = `../sources/images/${site.icon}`;
        document.getElementById('modalTitle').textContent = site.name;
        document.getElementById('modalDescription').textContent = site.description;
        document.getElementById('modalInstructions').innerHTML = site.instructions;
        
        // Set notes if they exist
        const modalNotes = document.getElementById('modalNotes');
        if(site.notes) {
            modalNotes.innerHTML = `<h4>Additional Notes:</h4><p>${site.notes}</p>`;
            modalNotes.classList.remove('hidden');
        } else {
            modalNotes.classList.add('hidden');
        }
        
        // Show modal
        siteModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    }
    
    // Close modal
    modalClose.addEventListener('click', () => {
        siteModal.classList.remove('show');
        document.body.style.overflow = '';
    });
    
    // Close modal on click outside
    window.addEventListener('click', (e) => {
        if(e.target === siteModal) {
            siteModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
    
    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if(e.key === 'Escape' && siteModal.classList.contains('show')) {
            siteModal.classList.remove('show');
            document.body.style.overflow = '';
        }
    });
    
    // Initial population of sites
    populateSites(sitesData);
});
