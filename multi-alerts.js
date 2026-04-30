const ALERT_CATEGORIES = Object.freeze({
  FOLLOW: 'follow',
  SUBSCRIPTION: 'subscription',
  DONATION: 'donation',
  BITS: 'bits',
  RAID: 'raid'
});

const DEFAULT_ALERT_STYLE = 'twitch';

const CATEGORY_LABELS = Object.freeze({
  [ALERT_CATEGORIES.FOLLOW]: 'New Follower',
  [ALERT_CATEGORIES.SUBSCRIPTION]: 'New Subscriber',
  [ALERT_CATEGORIES.DONATION]: 'New Donation',
  [ALERT_CATEGORIES.BITS]: 'New Cheer',
  [ALERT_CATEGORIES.RAID]: 'Incoming Raid'
});

const CATEGORY_ACCENTS = Object.freeze({
  [ALERT_CATEGORIES.FOLLOW]: '#ff68b3',
  [ALERT_CATEGORIES.SUBSCRIPTION]: '#8b5cf6',
  [ALERT_CATEGORIES.DONATION]: '#14f195',
  [ALERT_CATEGORIES.BITS]: '#38bdf8',
  [ALERT_CATEGORIES.RAID]: '#f59e0b'
});

const COUNT_EVENTS = new Set([
  'viewer_update',
  'viewer_updates',
  'follower_update',
  'subscriber_update',
  'stream_status',
  'ad_break',
  'ad_break_begin',
  'ad_break_end'
]);

const FOLLOW_EVENTS = new Set(['new_follower', 'follow', 'followed']);
const SUBSCRIPTION_EVENTS = new Set([
  'new_subscriber',
  'new-subscriber',
  'subscription_gift',
  'resub',
  'sponsorship',
  'giftpurchase',
  'giftredemption',
  'membermilestone',
  // Deprecated — kept for backward compat with older extension versions
  'subscription',        // → new_subscriber
  'subgift',             // → subscription_gift
  'membership',          // → sponsorship
  'new_member',          // → sponsorship
  'new_membership',      // → sponsorship
  'newmember',           // → sponsorship
  'upgraded_membership', // → resub
  'membership_upgrade',  // → resub
  'membership_milestone',// → membermilestone
  'member_milestone',    // → membermilestone
  'gift_membership',     // → giftpurchase
  'membership_gift',     // → giftpurchase
  'community_gift',      // → giftpurchase
  'new-subscriber'       // StreamElements (hyphenated variant)
]);
const DONATION_EVENTS = new Set([
  'donation',
  'gift',              // TikTok gifts, Kick DOM gifts
  'supersticker',
  'thankyou',
  'jeweldonation',
  'tip',
  'support'
]);
const BITS_EVENTS = new Set(['cheer', 'bits']);
const RAID_EVENTS = new Set(['raid', 'host', 'hosting', 'redirect']);

const EVENT_ALIASES = Object.freeze({
  'channel_subscription_gifts': 'subscription_gift',
  'channel_subscription_gift': 'subscription_gift',
  'channel_subscription_new': 'new_subscriber',
  'channel_subscription_start': 'new_subscriber',
  'channel_subscription': 'new_subscriber',
  'channel_followed': 'new_follower',
  'follower_added': 'new_follower',
  'subscription_gifts': 'subscription_gift',
  'subscription_renewal': 'resub',
  'member_milestone': 'membermilestone',
  'membership_milestone': 'membermilestone',
  'super_chat': 'donation',
  'superchat': 'donation',
  'super_sticker': 'supersticker',
  'channel_cheer': 'cheer',
  'channel_raid': 'raid',
  'new-subscriber': 'new_subscriber',
  'new_membership': 'sponsorship',
  'new_member': 'sponsorship',
  'membership': 'sponsorship',
  'gift_membership': 'giftpurchase',
  'membership_gift': 'giftpurchase',
  'community_gift': 'giftpurchase',
  'gifted_membership': 'giftredemption',
  'gifted_memberships': 'giftpurchase',
  'upgraded_membership': 'resub',
  'membership_upgrade': 'resub'
});

const KNOWN_SOURCES = new Set([
  'amazon',
  'facebook',
  'instagram',
  'kick',
  'kofi',
  'rumble',
  'streamlabs',
  'tiktok',
  'twitch',
  'whatnot',
  'x',
  'youtube',
  'youtubeshorts'
]);

const SOURCE_LABELS = Object.freeze({
  amazon: 'Amazon Live',
  facebook: 'Facebook',
  instagram: 'Instagram',
  kick: 'Kick',
  kofi: 'Ko-fi',
  rumble: 'Rumble',
  streamlabs: 'Streamlabs',
  tiktok: 'TikTok',
  twitch: 'Twitch',
  whatnot: 'Whatnot',
  x: 'X',
  youtube: 'YouTube',
  youtubeshorts: 'YouTube Shorts'
});

const SOURCE_ALIASES = Object.freeze({
  'ko-fi': 'kofi',
  twitter: 'x',
  'youtube-shorts': 'youtubeshorts',
  'youtube_shorts': 'youtubeshorts'
});

const urlParams = new URLSearchParams(window.location.search);

const CATEGORY_STYLE_PARAMS = {
  [ALERT_CATEGORIES.FOLLOW]: 'followstyle',
  [ALERT_CATEGORIES.SUBSCRIPTION]: 'substyle',
  [ALERT_CATEGORIES.DONATION]: 'donostyle',
  [ALERT_CATEGORIES.BITS]: 'bitsstyle',
  [ALERT_CATEGORIES.RAID]: 'raidstyle'
};

const CATEGORY_DISABLE_PARAMS = {
  [ALERT_CATEGORIES.FOLLOW]: 'disablefollows',
  [ALERT_CATEGORIES.SUBSCRIPTION]: 'disablesubs',
  [ALERT_CATEGORIES.DONATION]: 'disabledonos',
  [ALERT_CATEGORIES.BITS]: 'disablebits',
  [ALERT_CATEGORIES.RAID]: 'disableraids'
};

const CATEGORY_SOUND_PARAMS = {
  [ALERT_CATEGORIES.FOLLOW]: 'followsound',
  [ALERT_CATEGORIES.SUBSCRIPTION]: 'subsound',
  [ALERT_CATEGORIES.DONATION]: 'donosound',
  [ALERT_CATEGORIES.BITS]: 'bitssound',
  [ALERT_CATEGORIES.RAID]: 'raidsound'
};

const SOURCE_ICON_MAP = {
  amazon: './sources/images/amazon.png',
  facebook: './sources/images/facebook.png',
  instagram: './sources/images/instagram.png',
  kick: './sources/images/kick.png',
  kofi: './sources/images/kofi.png',
  rumble: './sources/images/rumble.png',
  streamlabs: './sources/images/streamlabs.png',
  tiktok: './sources/images/tiktok.png',
  twitch: './sources/images/twitch.png',
  x: './sources/images/x.png',
  youtube: './sources/images/youtube.png',
  youtubeshorts: './sources/images/youtube.png'
};

const settings = readSettings();
const recentPayloads = [];

const state = {
  iframe: null,
  socket: null,
  queue: [],
  currentAlert: null,
  showTimer: null,
  cleanupTimer: null,
  cooldownTimer: null,
  reconnectTimer: null,
  blockedUntil: 0,
  audioContext: null,
  activeOscillator: null,
  activeGain: null,
  lastAudioTime: 0,
  audioKeepAlive: null
};

const elements = {
  stage: document.getElementById('alert-stage'),
  status: document.getElementById('alert-status'),
  audio: document.getElementById('custom-alert-audio')
};

applyPagePresentation();
attachWindowListeners();
if (settings.previewOnly) {
  updateStatus('Preview ready');
}

if (!settings.previewOnly && settings.roomID) {
  setupBridgeIframe();
  if (settings.useSocket) {
    setupSocket();
  }
}

if (window.obsstudio) {
  startAudioKeepAlive();
} else {
  primeAudioPipeline();
}

function log(...args) {
  if (settings.debug) {
    console.log('[multi-alerts]', ...args);
  }
}

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeEventKey(value) {
  const normalized = normalizeKey(value).replace(/[.\s]+/g, '_');
  if (!normalized || normalized === 'false') {
    return '';
  }
  return EVENT_ALIASES[normalized] || normalized;
}

function normalizeSourceKey(value) {
  const normalized = normalizeKey(value);
  if (!normalized) {
    return '';
  }
  return SOURCE_ALIASES[normalized] || normalized;
}

function parseSourceListParam(name) {
  const rawValue = normalizeText(urlParams.get(name));
  if (!rawValue) {
    return new Set();
  }
  return new Set(
    rawValue
      .split(',')
      .map((entry) => normalizeSourceKey(entry))
      .filter(Boolean)
  );
}

function normalizeSourceMatchValue(value) {
  return normalizeText(value).replace(/\s+/g, ' ');
}

function normalizeSourceMatchKey(value) {
  const normalized = normalizeSourceMatchValue(value);
  return normalized ? normalized.toLowerCase() : '';
}

function parseSourceMatchListParam(name, aliases = []) {
  const values = [name].concat(aliases);
  const matches = new Set();

  values.forEach((paramName) => {
    const rawValue = normalizeText(urlParams.get(paramName));
    if (!rawValue) {
      return;
    }
    rawValue
      .split(',')
      .forEach((entry) => {
        const exact = normalizeSourceMatchValue(entry);
        const loose = normalizeSourceMatchKey(entry);
        if (!exact) {
          return;
        }
        matches.add(exact);
        if (loose && loose !== exact) {
          matches.add(loose);
        }
      });
  });

  return matches;
}

function humanizeKey(value) {
  const normalized = normalizeKey(value).replace(/[_-]+/g, ' ');
  if (!normalized) {
    return 'Social Stream';
  }
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
}

function createAvatarDataUri(label, bgColor, textColor = '#ffffff') {
  const seed = normalizeText(label) || 'SS';
  const initials = seed
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'SS';
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">',
    `<rect width="128" height="128" rx="64" fill="${bgColor}"/>`,
    `<text x="64" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="46" font-weight="700" fill="${textColor}">${initials}</text>`,
    '</svg>'
  ].join('');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createMediaPreviewDataUri(label, bgColor) {
  const safeLabel = normalizeText(label).slice(0, 18) || 'Alert';
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180">',
    '<defs>',
    `<linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">`,
    `<stop offset="0%" stop-color="${bgColor}" stop-opacity="0.95"/>`,
    '<stop offset="100%" stop-color="#04070d" stop-opacity="1"/>',
    '</linearGradient>',
    '</defs>',
    '<rect width="320" height="180" rx="22" fill="url(#bg)"/>',
    '<circle cx="56" cy="48" r="18" fill="rgba(255,255,255,0.18)"/>',
    '<circle cx="108" cy="124" r="26" fill="rgba(255,255,255,0.12)"/>',
    '<path d="M242 42l34 18v30l-34 18-34-18V60z" fill="rgba(255,255,255,0.16)"/>',
    '<rect x="28" y="122" width="126" height="14" rx="7" fill="rgba(255,255,255,0.18)"/>',
    '<rect x="28" y="144" width="176" height="10" rx="5" fill="rgba(255,255,255,0.12)"/>',
    `<text x="214" y="138" text-anchor="middle" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff">${safeLabel}</text>`,
    '</svg>'
  ].join('');
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function pickSourceKey(payload = {}) {
  const directPlatform = normalizeSourceKey(payload.platform);
  if (directPlatform) return directPlatform;

  const payloadType = normalizeSourceKey(payload.type);
  if (KNOWN_SOURCES.has(payloadType)) {
    return payloadType;
  }

  const metaCandidates = [
    payload.meta?.sourcePlatform,
    payload.meta?.platform,
    payload.meta?.source,
    payload.meta?.provider
  ];

  for (const candidate of metaCandidates) {
    const normalized = normalizeSourceKey(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return payloadType || '';
}

function pickEventKey(payload = {}) {
  const directEvent = normalizeEventKey(payload.event);
  if (directEvent) return directEvent;

  const payloadType = normalizeEventKey(payload.type);
  if (payloadType && !KNOWN_SOURCES.has(payloadType)) {
    return payloadType;
  }

  const metaCandidates = [
    payload.eventType,
    payload.rawType,
    payload.alertType,
    payload.meta?.event,
    payload.meta?.eventType,
    payload.meta?.originalEventType,
    payload.meta?.rawType,
    payload.meta?.alertType,
    payload.meta?.eventName
  ];

  for (const candidate of metaCandidates) {
    const normalized = normalizeEventKey(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function pickDonationLabel(payload = {}) {
  return normalizeText(
    payload.hasDonation ||
      payload.donation ||
      payload.meta?.hasDonation ||
      payload.meta?.donation
  );
}

function buildRecentPayloadSignature(payload = {}) {
  return [
    pickEventKey(payload),
    pickSourceKey(payload),
    normalizeText(payload.chatname),
    normalizeText(payload.chatmessage),
    pickDonationLabel(payload),
    normalizeText(payload.membership),
    normalizeText(payload.contentimg),
    normalizeText(payload.id || payload.meta?.eventId || payload.meta?.id)
  ].join('|');
}

function isDuplicateAlertPayload(payload = {}) {
  const now = Date.now();
  const signature = buildRecentPayloadSignature(payload);
  let index;

  for (index = recentPayloads.length - 1; index >= 0; index -= 1) {
    if (recentPayloads[index].expiresAt <= now) {
      recentPayloads.splice(index, 1);
    }
  }

  for (index = 0; index < recentPayloads.length; index += 1) {
    if (recentPayloads[index].signature === signature) {
      return true;
    }
  }

  recentPayloads.push({
    signature,
    expiresAt: now + 2500
  });

  return false;
}

function pickActorName(payload = {}) {
  const candidates = [
    payload.chatname,
    payload.meta?.supporter,
    payload.meta?.fromLogin,
    payload.meta?.from,
    payload.meta?.username,
    payload.meta?.displayName,
    payload.sourceName
  ];
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }
  return 'Someone';
}

function pickSubtitle(payload = {}) {
  return normalizeText(
    payload.subtitle ||
      payload.membership ||
      payload.title ||
      payload.meta?.plan ||
      payload.meta?.level
  );
}

function pickViewerCount(payload = {}) {
  const candidates = [
    payload.meta?.viewers,
    payload.meta?.viewerCount,
    payload.meta?.raiders
  ];
  for (const candidate of candidates) {
    const numberValue = Number(candidate);
    if (Number.isFinite(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }
  return null;
}

function pickMediaUrl(payload = {}) {
  const candidates = [
    payload.contentimg,
    payload.contentImage,
    payload.meta?.contentimg,
    payload.meta?.mediaUrl,
    payload.meta?.image,
    payload.meta?.gif,
    payload.meta?.giphy,
    payload.meta?.stickerUrl
  ];

  for (const candidate of candidates) {
    const normalized = normalizeText(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
}

function detectMediaType(url) {
  const normalized = normalizeKey(url);
  if (!normalized) {
    return '';
  }
  if (/(\.mp4|\.webm|\.ogg|\.mov|\.m4v)(\?|#|$)/.test(normalized)) {
    return 'video';
  }
  return 'image';
}

function isSourceAllowed(sourceKey) {
  const normalized = normalizeSourceKey(sourceKey);
  if (settings.includeSources.size) {
    if (!(normalized && settings.includeSources.has(normalized))) {
      return false;
    }
  }
  if (normalized && settings.excludeSources.size && settings.excludeSources.has(normalized)) {
    return false;
  }
  return true;
}

function collectSourceMatchKeys(payload = {}) {
  const meta = payload.meta && typeof payload.meta === 'object' ? payload.meta : null;
  return {
    exact: [
      payload.sourceId,
      payload.source_id,
      payload.channelId,
      payload.channel_id,
      payload.videoId,
      payload.videoid,
      meta?.sourceId,
      meta?.source_id,
      meta?.channelId,
      meta?.channel_id,
      meta?.videoId,
      meta?.videoid
    ]
      .map((value) => normalizeSourceMatchValue(value))
      .filter(Boolean),
    loose: [
      payload.sourceName,
      payload.channel,
      meta?.sourceName,
      meta?.channel
    ]
      .map((value) => normalizeSourceMatchKey(value))
      .filter(Boolean)
  };
}

function isSourceMatchAllowed(payload = {}) {
  const sourceMatchKeys = collectSourceMatchKeys(payload);
  if (settings.includeSourceMatches.size) {
    if (
      !sourceMatchKeys.exact.some((key) => settings.includeSourceMatches.has(key)) &&
      !sourceMatchKeys.loose.some((key) => settings.includeSourceMatches.has(key))
    ) {
      return false;
    }
  }
  if (
    settings.excludeSourceMatches.size &&
    (
      sourceMatchKeys.exact.some((key) => settings.excludeSourceMatches.has(key)) ||
      sourceMatchKeys.loose.some((key) => settings.excludeSourceMatches.has(key))
    )
  ) {
    return false;
  }
  return true;
}

function isGenericEventKey(eventKey) {
  return eventKey === 'true' || eventKey === 'event' || eventKey === 'notification' || eventKey === 'system';
}

function inferCategoryFromText(payload = {}) {
  const text = normalizeKey([
    payload.chatmessage,
    payload.title,
    payload.subtitle,
    payload.membership,
    payload.meta?.eventType,
    payload.meta?.rawType,
    payload.meta?.alertType,
    payload.meta?.eventName
  ].join(' ')).replace(/<[^>]*>/g, ' ');

  if (!text) {
    return null;
  }
  if (/\b(raid|raiding|raided|host|hosting|hosted|redirect)\b/.test(text)) {
    return ALERT_CATEGORIES.RAID;
  }
  if (/\b(cheer|cheered|cheering|bits?)\b/.test(text)) {
    return ALERT_CATEGORIES.BITS;
  }
  if (/\b(donation|donated|tip|tipped|support|super_chat|super chat|supersticker|super sticker)\b/.test(text)) {
    return ALERT_CATEGORIES.DONATION;
  }
  if (/\b(sub|subs|subscriber|subscribed|subscription|resub|member|membership|sponsor|sponsorship)\b/.test(text)) {
    return ALERT_CATEGORIES.SUBSCRIPTION;
  }
  if (/\bfollow(?:ed|ing)?\b/.test(text)) {
    return ALERT_CATEGORIES.FOLLOW;
  }
  return null;
}

function inferCategory(payload = {}) {
  const eventKey = pickEventKey(payload);
  if (COUNT_EVENTS.has(eventKey)) {
    return null;
  }

  const donationLabel = normalizeKey(pickDonationLabel(payload));
  const genericEvent = isGenericEventKey(eventKey);

  if (RAID_EVENTS.has(eventKey)) {
    return ALERT_CATEGORIES.RAID;
  }
  if (BITS_EVENTS.has(eventKey)) {
    return ALERT_CATEGORIES.BITS;
  }
  if (DONATION_EVENTS.has(eventKey)) {
    if (/(^|\s)(bit|bits|cheer|cheers)\b/.test(donationLabel)) {
      return ALERT_CATEGORIES.BITS;
    }
    return ALERT_CATEGORIES.DONATION;
  }
  if (SUBSCRIPTION_EVENTS.has(eventKey)) {
    return ALERT_CATEGORIES.SUBSCRIPTION;
  }
  if (FOLLOW_EVENTS.has(eventKey)) {
    return ALERT_CATEGORIES.FOLLOW;
  }
  if (donationLabel) {
    return /(^|\s)(bit|bits|cheer|cheers)\b/.test(donationLabel)
      ? ALERT_CATEGORIES.BITS
      : ALERT_CATEGORIES.DONATION;
  }
  if (genericEvent) {
    const inferredCategory = inferCategoryFromText(payload);
    if (inferredCategory) {
      return inferredCategory;
    }
  }
  if (!eventKey && normalizeText(payload.membership) && !normalizeText(payload.chatmessage)) {
    return ALERT_CATEGORIES.SUBSCRIPTION;
  }
  return null;
}

function buildHeadline(category, eventKey, actor, amount, viewerCount) {
  switch (category) {
    case ALERT_CATEGORIES.FOLLOW:
      return { lead: actor, tail: 'just followed' };
    case ALERT_CATEGORIES.SUBSCRIPTION:
      if (eventKey === 'subscription_gift' || eventKey === 'giftpurchase') {
        return { lead: actor, tail: amount ? `gifted ${amount}` : 'gifted memberships' };
      }
      if (eventKey === 'giftredemption') {
        return { lead: actor, tail: 'received a gifted membership' };
      }
      if (eventKey === 'resub') {
        return { lead: actor, tail: 'renewed their support' };
      }
      if (eventKey === 'membermilestone') {
        return { lead: actor, tail: 'hit a membership milestone' };
      }
      return { lead: actor, tail: 'just subscribed' };
    case ALERT_CATEGORIES.DONATION:
      if (eventKey === 'gift') {
        return { lead: actor, tail: amount ? `sent ${amount}` : 'sent a gift' };
      }
      return { lead: actor, tail: amount ? `sent ${amount}` : 'sent support' };
    case ALERT_CATEGORIES.BITS:
      return { lead: actor, tail: amount ? `cheered ${amount}` : 'cheered' };
    case ALERT_CATEGORIES.RAID:
      return {
        lead: actor,
        tail: viewerCount ? `is raiding with ${viewerCount} viewers` : 'is raiding'
      };
    default:
      return { lead: actor, tail: 'triggered an alert' };
  }
}

function buildTitle(category, eventKey) {
  if (category === ALERT_CATEGORIES.DONATION && eventKey === 'gift') {
    return 'New Gift';
  }
  return CATEGORY_LABELS[category] || 'New Alert';
}

function buildBodyText(category, payload, viewerCount) {
  const eventKey = pickEventKey(payload);
  const rawMessage = normalizeText(payload.chatmessage);
  const subtitle = pickSubtitle(payload);

  if (category === ALERT_CATEGORIES.RAID && viewerCount) {
    return rawMessage || `Welcome the raid from ${pickActorName(payload)}.`;
  }
  if (category === ALERT_CATEGORIES.DONATION) {
    if (eventKey === 'gift') {
      return rawMessage || 'A gift just landed.';
    }
    return rawMessage || 'Thank you for the support!';
  }
  if (category === ALERT_CATEGORIES.BITS) {
    return rawMessage || 'The hype meter just moved.';
  }
  if (category === ALERT_CATEGORIES.SUBSCRIPTION) {
    if (rawMessage) {
      return rawMessage;
    }
    if (subtitle) {
      return subtitle;
    }
    if (eventKey === 'giftpurchase' || eventKey === 'subscription_gift') {
      return 'Gift support is rolling in.';
    }
    return 'A new supporter joined the stream.';
  }
  if (category === ALERT_CATEGORIES.FOLLOW) {
    return subtitle || rawMessage || 'Thanks for joining the community.';
  }
  return rawMessage || subtitle;
}

function buildAlertViewModel(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const category = inferCategory(payload);
  if (!category) {
    return null;
  }

  const eventKey = pickEventKey(payload);
  const sourceKey = pickSourceKey(payload);
  if (!isSourceAllowed(sourceKey)) {
    return null;
  }
  if (!isSourceMatchAllowed(payload)) {
    return null;
  }
  const sourceLabel = SOURCE_LABELS[sourceKey] || humanizeKey(sourceKey);
  const actor = pickActorName(payload);
  const amount = pickDonationLabel(payload);
  const subtitle = pickSubtitle(payload);
  const viewerCount = pickViewerCount(payload);
  const mediaUrl = pickMediaUrl(payload);
  const cashValue = pickCashValue(payload, amount, sourceKey);
  if (isValueAlertCategory(category) && settings.minDonationValue > 0 && cashValue < settings.minDonationValue) {
    log('value alert skipped below minimum', { amount, cashValue, minimum: settings.minDonationValue, payload });
    return null;
  }
  const headline = buildHeadline(category, eventKey, actor, amount, viewerCount);
  const bodyText = buildBodyText(category, payload, viewerCount);

  return {
    category,
    eventKey,
    sourceKey,
    sourceLabel,
    title: buildTitle(category, eventKey),
    accent: CATEGORY_ACCENTS[category] || '#9146ff',
    actor,
    amount,
    cashValue,
    subtitle,
    bodyText,
    headlineLead: headline.lead,
    headlineTail: headline.tail,
    avatar: normalizeText(payload.chatimg),
    mediaUrl,
    mediaType: detectMediaType(mediaUrl),
    viewerCount,
    payload
  };
}

const MOCK_USERS = [
  { name: 'Jess', img: './media/user1.jpg' },
  { name: 'Markus', img: './media/user2.jpg' },
  { name: 'Priya', img: './media/user3.jpg' },
  { name: 'CaptainSquawk', img: './media/user5.jpg' },
  { name: 'Ava', img: './media/user4.png' }
];

function pickMockUser(category) {
  const index = ({
    [ALERT_CATEGORIES.FOLLOW]: 0,
    [ALERT_CATEGORIES.SUBSCRIPTION]: 1,
    [ALERT_CATEGORIES.DONATION]: 2,
    [ALERT_CATEGORIES.BITS]: 4,
    [ALERT_CATEGORIES.RAID]: 3
  })[category] ?? 0;
  return MOCK_USERS[index];
}

function createMockAlertPayload(category, overrides = {}) {
  const mock = pickMockUser(category);
  const baseName = overrides.chatname || mock.name;
  const baseImg = overrides.chatimg || mock.img;
  const accent = CATEGORY_ACCENTS[category] || '#9146ff';
  const common = {
    type: 'twitch',
    platform: 'twitch',
    chatname: baseName,
    chatimg: baseImg,
    timestamp: Date.now(),
    meta: {}
  };

  let payload;
  switch (category) {
    case ALERT_CATEGORIES.FOLLOW:
      payload = {
        ...common,
        event: 'new_follower',
        chatmessage: `${baseName} has started following`
      };
      break;
    case ALERT_CATEGORIES.SUBSCRIPTION:
      payload = {
        ...common,
        event: 'new_subscriber',
        membership: 'Tier 1',
        subtitle: 'Tier 1 subscription',
        chatmessage: 'Welcome to the squad!'
      };
      break;
    case ALERT_CATEGORIES.DONATION:
      payload = {
        ...common,
        event: 'donation',
        hasDonation: '$10.00',
        donoValue: 10,
        chatmessage: 'Keep up the great work!',
        contentimg: createMediaPreviewDataUri('HYPE', accent)
      };
      break;
    case ALERT_CATEGORIES.BITS:
      payload = {
        ...common,
        event: 'cheer',
        hasDonation: '500 bits',
        chatmessage: 'Cheer train incoming!',
        contentimg: createMediaPreviewDataUri('500', accent),
        meta: { bits: 500 }
      };
      break;
    case ALERT_CATEGORIES.RAID:
      payload = {
        ...common,
        event: 'raid',
        chatmessage: 'Raiding with 42 viewers!',
        contentimg: createMediaPreviewDataUri('RAID', accent),
        meta: { viewers: 42, fromLogin: baseName.toLowerCase() }
      };
      break;
    default:
      return null;
  }

  return {
    ...payload,
    ...overrides,
    meta: {
      ...(payload.meta || {}),
      ...(overrides.meta || {})
    }
  };
}

function parseNumberParam(name, fallbackValue) {
  if (!urlParams.has(name)) return fallbackValue;
  const value = Number(urlParams.get(name));
  return Number.isFinite(value) ? value : fallbackValue;
}

function parseCashValue(value, sourceKey = '') {
  const rawValue = normalizeText(value);
  if (!rawValue) {
    return 0;
  }
  if (typeof convertToUSD === 'function') {
    return Math.max(0, convertToUSD(rawValue, normalizeSourceKey(sourceKey)));
  }
  const fallbackValue = Number(rawValue.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(fallbackValue) ? Math.max(0, fallbackValue) : 0;
}

function getMinimumDonationValue() {
  return parseCashValue(urlParams.get('mindonation') || urlParams.get('mincash'));
}

function pickCashValue(payload = {}, amountLabel = '', sourceKey = '') {
  const labelValue = parseCashValue(amountLabel, sourceKey);
  if (labelValue > 0) {
    return labelValue;
  }

  const numericCandidates = [
    payload.donoValue,
    payload.donationValue,
    payload.meta?.donoValue,
    payload.meta?.donationValue,
    payload.meta?.amount
  ];

  for (const candidate of numericCandidates) {
    const numberValue = Number(candidate);
    if (Number.isFinite(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }

  return 0;
}

function isValueAlertCategory(category) {
  return category === ALERT_CATEGORIES.DONATION || category === ALERT_CATEGORIES.BITS;
}

function normalizeColor(value) {
  const trimmed = normalizeText(value).replace(/^#/, '');
  if (!trimmed) return '';
  if (/^[0-9a-fA-F]{3,8}$/.test(trimmed)) {
    return `#${trimmed}`;
  }
  return normalizeText(value);
}

function readSettings() {
  const styles = {};
  Object.entries(CATEGORY_STYLE_PARAMS).forEach(([category, paramName]) => {
    styles[category] = normalizeText(urlParams.get(paramName)).toLowerCase() || DEFAULT_ALERT_STYLE;
  });

  const disabledCategories = {};
  Object.entries(CATEGORY_DISABLE_PARAMS).forEach(([category, paramName]) => {
    disabledCategories[category] = urlParams.has(paramName);
  });

  const hasServer = urlParams.has('server');
  const hasServer2 = urlParams.has('server2');
  const hasServer3 = urlParams.has('server3');
  const hasLocalServer = urlParams.has('localserver');
  const remoteServerUrl =
    normalizeText(urlParams.get('server')) ||
    normalizeText(urlParams.get('server2')) ||
    normalizeText(urlParams.get('server3'));
  let serverURL = hasLocalServer ? 'ws://127.0.0.1:3000' : 'wss://io.socialstream.ninja';

  if (hasServer) {
    serverURL = remoteServerUrl || (hasLocalServer ? 'ws://127.0.0.1:3000' : 'wss://io.socialstream.ninja/api');
  } else if (hasServer2 || hasServer3) {
    serverURL = remoteServerUrl || (hasLocalServer ? 'ws://127.0.0.1:3000' : 'wss://io.socialstream.ninja/extension');
  }

  const queueEnabled = urlParams.has('queue')
    ? true
    : urlParams.has('noqueue')
      ? false
      : false;

  return {
    roomID: normalizeText(urlParams.get('session')),
    password: normalizeText(urlParams.get('password')) || 'false',
    showTime: Math.max(1800, parseNumberParam('showtime', 8000)),
    cooldown: Math.max(0, parseNumberParam('cooldown', 900)),
    queueEnabled,
    maxQueue: Math.max(1, Math.min(100, parseNumberParam('maxqueue', 20))),
    minShowTime: Math.max(1500, parseNumberParam('minshowtime', 3000)),
    minDonationValue: getMinimumDonationValue(),
    beep: urlParams.has('beep'),
    beepVolume: Math.max(0, Math.min(1, parseNumberParam('beepvolume', 35) / 100)),
    customBeep: normalizeText(urlParams.get('custombeep')),
    categorySounds: Object.fromEntries(
      Object.entries(CATEGORY_SOUND_PARAMS).map(([cat, param]) => [cat, normalizeText(urlParams.get(param))])
    ),
    compact: urlParams.has('compact'),
    hideAvatar: urlParams.has('hideavatar'),
    hideMedia: urlParams.has('hidemedia'),
    hideSource: urlParams.has('hidesource'),
    hideAmount: urlParams.has('hideamount'),
    hideSubtitle: urlParams.has('hidesubtitle'),
    includeSources: parseSourceListParam('sources'),
    excludeSources: parseSourceListParam('hidesources'),
    includeSourceMatches: parseSourceMatchListParam('sourceids', ['channels']),
    excludeSourceMatches: parseSourceMatchListParam('hidesourceids', ['hidechannels']),
    align:
      normalizeText(urlParams.get('align')).toLowerCase() === 'center'
        ? 'center'
        : urlParams.has('alignright')
          ? 'right'
          : 'left',
    scale: Math.max(0.45, Math.min(3, parseNumberParam('scale', 1))),
    mediaScale: Math.max(0.6, Math.min(2.2, parseNumberParam('mediascale', 1))),
    headlineScale: Math.max(0.75, Math.min(1.8, parseNumberParam('headlinescale', 1))),
    detailScale: Math.max(0.8, Math.min(1.8, parseNumberParam('detailscale', 1))),
    pageBg: normalizeColor(urlParams.get('pagebg')),
    chroma: normalizeColor(urlParams.get('chroma')),
    previewOnly: urlParams.has('preview'),
    showStatus: urlParams.has('showstatus') || urlParams.has('debug') || urlParams.has('preview'),
    debug: urlParams.has('debug'),
    useSocket: hasServer || hasServer2 || hasServer3 || hasLocalServer,
    serverURL,
    styles,
    disabledCategories
  };
}

function applyPagePresentation() {
  document.documentElement.style.setProperty('--overlay-scale', String(settings.scale));
  document.documentElement.style.setProperty('--media-scale', String(settings.mediaScale));
  document.documentElement.style.setProperty('--headline-scale', String(settings.headlineScale));
  document.documentElement.style.setProperty('--detail-scale', String(settings.detailScale));
  document.body.dataset.align = settings.align;
  document.body.classList.toggle('show-status', settings.showStatus);

  if (settings.compact) {
    document.body.classList.add('compact-mode');
  }
  if (urlParams.has('embedded')) {
    document.body.classList.add('embedded-mode');
  }

  if (settings.chroma) {
    document.body.style.background = settings.chroma;
  } else if (settings.pageBg) {
    document.body.style.background = settings.pageBg;
  } else {
    document.body.style.background = 'transparent';
  }
}

function attachWindowListeners() {
  window.addEventListener('message', (event) => {
    if (state.iframe && event.source === state.iframe.contentWindow) {
      const payload = event.data?.dataReceived?.overlayNinja;
      if (payload !== undefined) {
        handleIncomingPayload(payload);
      }
      return;
    }

    if (!event.data || !Object.prototype.hasOwnProperty.call(event.data, 'multiAlertsPreview')) {
      return;
    }

    handlePreviewMessage(event.data.multiAlertsPreview);
  });
}

function setupBridgeIframe() {
  state.iframe = document.createElement('iframe');
  state.iframe.src =
    `https://vdo.socialstream.ninja/?ln&salt=vdo.ninja&password=${encodeURIComponent(settings.password)}` +
    `&push&label=alerts&vd=0&ad=0&novideo&noaudio&autostart&cleanoutput&room=${encodeURIComponent(settings.roomID)}`;
  state.iframe.style.cssText = 'width:0;height:0;position:fixed;left:-100px;top:-100px;border:0;';
  document.body.appendChild(state.iframe);
}

function scheduleSocketReconnect(delay = 1200) {
  if (state.reconnectTimer) {
    return;
  }
  state.reconnectTimer = window.setTimeout(() => {
    state.reconnectTimer = null;
    setupSocket();
  }, delay);
}

function setupSocket() {
  teardownSocket();
  state.socket = new WebSocket(settings.serverURL);

  state.socket.onopen = () => {
    log('socket connected');
    state.socket.send(JSON.stringify({ join: settings.roomID, out: 3, in: 4 }));
  };

  state.socket.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed?.overlayNinja !== undefined) {
        handleIncomingPayload(parsed.overlayNinja);
      } else {
        handleIncomingPayload(parsed);
      }
    } catch (error) {
      console.error('Failed to parse multi-alert socket payload:', error);
    }
  };

  state.socket.onerror = (error) => {
    console.error('Multi-alert socket error:', error);
    scheduleSocketReconnect();
    teardownSocket({ keepReconnectTimer: true });
  };

  state.socket.onclose = () => {
    teardownSocket();
    scheduleSocketReconnect();
  };
}

function teardownSocket({ keepReconnectTimer = false } = {}) {
  if (!keepReconnectTimer && state.reconnectTimer) {
    window.clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
  if (state.socket) {
    state.socket.onopen = null;
    state.socket.onerror = null;
    state.socket.onclose = null;
    state.socket.onmessage = null;
    try {
      state.socket.close();
    } catch (error) {
      log('socket close failed', error);
    }
    state.socket = null;
  }
}

function handlePreviewMessage(previewMessage) {
  if (previewMessage === false) {
    clearAlert({ clearQueue: true, preserveCooldown: true });
    updateStatus('Preview cleared');
    return;
  }

  const isEnvelope =
    previewMessage &&
    typeof previewMessage === 'object' &&
    previewMessage.__multiAlertsPreviewEnvelope === true;

  const previewOptions = isEnvelope
    ? { silent: Boolean(previewMessage.silent) }
    : { silent: false };

  const previewDescriptor = isEnvelope ? previewMessage.payload : previewMessage;

  const payload =
    typeof previewDescriptor === 'string'
      ? createMockAlertPayload(previewDescriptor)
      : previewDescriptor?.category && !previewDescriptor?.event
        ? createMockAlertPayload(previewDescriptor.category, previewDescriptor.overrides || {})
        : previewDescriptor;

  if (!payload) {
    return;
  }

  const previewSourceKey = pickSourceKey(payload);
  const model = buildAlertViewModel(payload);
  if (!model) {
    if (!isSourceAllowed(previewSourceKey)) {
      clearAlert({ clearQueue: true, preserveCooldown: true });
      updateStatus(`${SOURCE_LABELS[previewSourceKey] || humanizeKey(previewSourceKey || 'source')} is filtered out`);
    } else if (!isSourceMatchAllowed(payload)) {
      clearAlert({ clearQueue: true, preserveCooldown: true });
      updateStatus('This source/channel is filtered out');
    }
    return;
  }

  if (settings.disabledCategories[model.category]) {
    clearAlert({ clearQueue: true, preserveCooldown: true });
    updateStatus(`${CATEGORY_LABELS[model.category] || 'This alert type'} is disabled`);
    return;
  }

  clearAlert({ clearQueue: true, preserveCooldown: true });
  displayAlert(model, previewOptions);
  updateStatus(`Previewing ${CATEGORY_LABELS[model.category] || 'alert'}`);
}

function handleIncomingPayload(payload) {
  if (payload && typeof payload === 'object' && payload.action === 'clearAlerts') {
    clearAlert({ clearQueue: true });
    updateStatus('Alerts cleared');
    return;
  }
  flattenPayloads(payload).forEach((entry) => {
    if (isDuplicateAlertPayload(entry)) {
      log('duplicate alert payload skipped', entry);
      return;
    }
    const model = buildAlertViewModel(entry);
    if (!model) {
      return;
    }
    if (settings.disabledCategories[model.category]) {
      log('category disabled', model.category, entry);
      return;
    }
    queueAlert(model);
  });
}

function flattenPayloads(payload) {
  if (payload === undefined || payload === null) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload.flatMap((entry) => flattenPayloads(entry));
  }
  if (payload.dataReceived && Object.prototype.hasOwnProperty.call(payload.dataReceived, 'overlayNinja')) {
    return flattenPayloads(payload.dataReceived.overlayNinja);
  }
  if (payload.overlayNinja !== undefined) {
    return flattenPayloads(payload.overlayNinja);
  }
  if (payload.sendData && Object.prototype.hasOwnProperty.call(payload.sendData, 'overlayNinja')) {
    return flattenPayloads(payload.sendData.overlayNinja);
  }
  if (Array.isArray(payload.messages)) {
    return payload.messages.flatMap((entry) => flattenPayloads(entry));
  }
  if (payload.message && typeof payload.message === 'object' && !payload.chatmessage) {
    return flattenPayloads(payload.message);
  }
  if (payload.content && typeof payload.content === 'object' && !payload.chatmessage) {
    return flattenPayloads(payload.content);
  }
  return [payload];
}

function queueAlert(model) {
  const now = Date.now();
  if (state.currentAlert || now < state.blockedUntil) {
    if (settings.queueEnabled) {
      state.queue.push(model);
      while (state.queue.length > settings.maxQueue) {
        state.queue.shift();
      }
      updateStatus(`Queued ${state.queue.length} alert${state.queue.length === 1 ? '' : 's'}`);
    }
    return;
  }

  displayAlert(model);
}

function displayAlert(model, options = {}) {
  const card = renderAlert(model);
  state.currentAlert = model;
  elements.stage.innerHTML = '';
  elements.stage.appendChild(card);
  elements.stage.classList.add('has-alert');
  if (!options.silent) {
    playAlertSound(model).then(() => {
      if (typeof TTS !== 'undefined' && TTS.speech && model.payload) {
        TTS.speechMeta(model.payload);
      }
    });
  } else if (typeof TTS !== 'undefined' && TTS.speech && model.payload) {
    TTS.speechMeta(model.payload);
  }
  updateStatus(model.title);

  const queueLen = state.queue.length;
  let effectiveShowTime = settings.showTime;
  if (queueLen > 3) {
    const ratio = Math.max(0, 1 - (queueLen - 3) / 10);
    effectiveShowTime = Math.round(settings.minShowTime + ratio * (settings.showTime - settings.minShowTime));
  }
  card.style.setProperty('--progress-duration', `${effectiveShowTime}ms`);

  const hideLead = Math.min(550, Math.max(280, Math.round(effectiveShowTime * 0.16)));

  state.showTimer = window.setTimeout(() => {
    card.classList.add('is-hiding');
  }, Math.max(0, effectiveShowTime - hideLead));

  state.cleanupTimer = window.setTimeout(() => {
    finalizeAlert(card);
  }, effectiveShowTime);
}

function finalizeAlert(card) {
  if (card?.isConnected) {
    card.remove();
  }
  state.currentAlert = null;
  elements.stage.classList.remove('has-alert');

  const effectiveCooldown = state.queue.length > 3 ? Math.min(settings.cooldown, 200) : settings.cooldown;
  if (effectiveCooldown > 0) {
    state.blockedUntil = Date.now() + effectiveCooldown;
    state.cooldownTimer = window.setTimeout(processQueue, effectiveCooldown);
  } else {
    state.blockedUntil = 0;
    processQueue();
  }
}

function processQueue() {
  if (state.currentAlert) {
    return;
  }
  if (!state.queue.length) {
    updateStatus(settings.previewOnly ? 'Preview ready' : 'Waiting for alerts');
    return;
  }
  const nextAlert = state.queue.shift();
  displayAlert(nextAlert);
}

function clearAlert({ clearQueue = false, preserveCooldown = false } = {}) {
  if (state.showTimer) {
    window.clearTimeout(state.showTimer);
    state.showTimer = null;
  }
  if (state.cleanupTimer) {
    window.clearTimeout(state.cleanupTimer);
    state.cleanupTimer = null;
  }
  if (state.cooldownTimer) {
    window.clearTimeout(state.cooldownTimer);
    state.cooldownTimer = null;
  }
  if (clearQueue) {
    state.queue = [];
  }
  stopActiveAlertSound();
  if (typeof TTS !== 'undefined' && TTS.clearQueue) {
    TTS.clearQueue();
  }
  state.currentAlert = null;
  elements.stage.innerHTML = '';
  elements.stage.classList.remove('has-alert');
  if (!preserveCooldown) {
    state.blockedUntil = 0;
  }
}

function renderAlert(model) {
  const article = document.createElement('article');
  const styleKey = settings.styles[model.category] || DEFAULT_ALERT_STYLE;
  const accentRgb = toAccentRgbTriplet(model.accent);
  article.className = `alert-card theme-${styleKey} category-${model.category}`;
  article.style.setProperty('--alert-accent', model.accent);
  article.style.setProperty('--alert-accent-rgb', accentRgb);
  article.style.setProperty('--progress-duration', `${settings.showTime}ms`);

  if (settings.compact) {
    article.classList.add('compact');
  }

  const header = document.createElement('div');
  header.className = 'alert-header';

  const titleBadge = document.createElement('div');
  titleBadge.className = 'alert-title';
  titleBadge.textContent = model.title.toUpperCase();
  header.appendChild(titleBadge);

  if (!settings.hideSource) {
    const spacer = document.createElement('div');
    spacer.className = 'alert-header-spacer';
    header.appendChild(spacer);

    const sourceBadge = buildSourceBadge(model);
    if (sourceBadge) {
      header.appendChild(sourceBadge);
    }
  }

  const shell = document.createElement('div');
  shell.className = 'alert-shell';

  if (!settings.hideAvatar && normalizeText(model.avatar)) {
    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'alert-avatar';
    const avatarImg = document.createElement('img');
    avatarImg.src = model.avatar;
    avatarImg.alt = model.actor;
    avatarImg.loading = 'eager';
    avatarImg.onerror = () => {
      avatarWrap.remove();
      shell.classList.remove('has-avatar');
    };
    avatarWrap.appendChild(avatarImg);
    shell.appendChild(avatarWrap);
    shell.classList.add('has-avatar');
  }

  const copy = document.createElement('div');
  copy.className = 'alert-copy';

  const headline = document.createElement('div');
  headline.className = 'alert-headline';

  const actor = document.createElement('span');
  actor.className = 'alert-actor';
  actor.textContent = model.headlineLead;
  headline.appendChild(actor);

  const tail = document.createElement('span');
  tail.className = 'alert-tail';
  tail.textContent = ` ${model.headlineTail}`;
  headline.appendChild(tail);

  copy.appendChild(headline);

  if (!settings.hideSubtitle && normalizeText(model.subtitle)) {
    const subtitle = document.createElement('div');
    subtitle.className = 'alert-subtitle';
    subtitle.textContent = model.subtitle;
    copy.appendChild(subtitle);
  }

  if (shouldRenderBodyText(model)) {
    const message = document.createElement('div');
    message.className = 'alert-message';
    message.innerHTML = model.bodyText;
    copy.appendChild(message);
  }

  const metaRow = document.createElement('div');
  metaRow.className = 'alert-meta';

  if (!settings.hideAmount && normalizeText(model.amount)) {
    const amount = document.createElement('span');
    amount.className = 'alert-pill alert-amount';
    amount.textContent = model.amount;
    metaRow.appendChild(amount);
  }

  if (model.viewerCount) {
    const viewers = document.createElement('span');
    viewers.className = 'alert-pill';
    viewers.textContent = `${model.viewerCount} viewers`;
    metaRow.appendChild(viewers);
  }

  if (metaRow.childNodes.length) {
    copy.appendChild(metaRow);
  }

  shell.appendChild(copy);

  if (!settings.hideMedia && normalizeText(model.mediaUrl)) {
    const media = buildAlertMedia(model, shell);
    if (media) {
      shell.appendChild(media);
      shell.classList.add('has-media');
    }
  }

  article.appendChild(header);
  article.appendChild(shell);

  const progress = document.createElement('div');
  progress.className = 'alert-progress';
  article.appendChild(progress);

  return article;
}

function buildSourceBadge(model) {
  const badge = document.createElement('div');
  badge.className = 'source-badge';

  if (typeof getColorFromType === 'function' && model.sourceKey) {
    const color = getColorFromType(model.sourceKey);
    if (color) {
      badge.style.setProperty('--source-color', color);
    }
  }

  const iconPath = SOURCE_ICON_MAP[model.sourceKey];
  if (iconPath) {
    const img = document.createElement('img');
    img.src = iconPath;
    img.alt = model.sourceLabel;
    img.loading = 'eager';
    img.onerror = () => img.remove();
    badge.appendChild(img);
  }

  const label = document.createElement('span');
  label.textContent = model.sourceLabel || 'Social Stream';
  badge.appendChild(label);
  return badge;
}

function buildAlertMedia(model, shell) {
  const mediaUrl = normalizeText(model.mediaUrl);
  if (!mediaUrl) {
    return null;
  }

  const mediaWrap = document.createElement('div');
  mediaWrap.className = 'alert-media';

  const tagName = model.mediaType === 'video' ? 'video' : 'img';
  const mediaElement = document.createElement(tagName);
  mediaElement.src = mediaUrl;

  if (tagName === 'video') {
    mediaElement.autoplay = true;
    mediaElement.muted = true;
    mediaElement.loop = true;
    mediaElement.playsInline = true;
    mediaElement.setAttribute('playsinline', '');
  } else {
    mediaElement.loading = 'eager';
    mediaElement.alt = `${model.title} media`;
  }

  mediaElement.onerror = () => {
    mediaWrap.remove();
    shell.classList.remove('has-media');
  };

  mediaWrap.appendChild(mediaElement);
  return mediaWrap;
}

function shouldRenderBodyText(model) {
  const bodyText = normalizeText(model.bodyText);
  if (!bodyText) {
    return false;
  }
  const combinedHeadline = `${normalizeText(model.headlineLead)} ${normalizeText(model.headlineTail)}`.trim().toLowerCase();
  return bodyText.toLowerCase() !== combinedHeadline;
}

function updateStatus(text) {
  if (!elements.status) return;
  elements.status.textContent = text;
}

function clearActiveGeneratedSound(oscillator = null, gain = null) {
  const activeOscillator = oscillator || state.activeOscillator;
  const activeGain = gain || state.activeGain;

  if (activeOscillator) {
    if (state.activeOscillator === activeOscillator) {
      state.activeOscillator = null;
    }
    try {
      activeOscillator.onended = null;
      activeOscillator.disconnect();
    } catch (error) {
      log('oscillator cleanup failed', error);
    }
  }

  if (activeGain) {
    if (state.activeGain === activeGain) {
      state.activeGain = null;
    }
    try {
      activeGain.disconnect();
    } catch (error) {
      log('gain cleanup failed', error);
    }
  }
}

function stopActiveAlertSound() {
  if (elements.audio) {
    try {
      elements.audio.pause();
      elements.audio.currentTime = 0;
    } catch (error) {
      log('custom audio cleanup failed', error);
    }
  }

  if (state.activeOscillator) {
    try {
      state.activeOscillator.stop();
    } catch (error) {
      log('oscillator stop failed', error);
    }
  }

  clearActiveGeneratedSound();
}

function toAccentRgbTriplet(colorValue) {
  const trimmed = normalizeText(colorValue).replace(/^#/, '');
  const expanded = trimmed.length === 3
    ? trimmed.split('').map((char) => char + char).join('')
    : trimmed.slice(0, 6);

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    return '139, 92, 246';
  }

  const r = parseInt(expanded.slice(0, 2), 16);
  const g = parseInt(expanded.slice(2, 4), 16);
  const b = parseInt(expanded.slice(4, 6), 16);
  return `${r}, ${g}, ${b}`;
}

function ensureAudioContext() {
  var AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextCtor) return null;
  if (!state.audioContext) {
    state.audioContext = new AudioContextCtor();
  }
  if (state.audioContext.state === 'suspended') {
    state.audioContext.resume();
  }
  return state.audioContext;
}

function audioKeepAliveBlip() {
  try {
    var ctx = ensureAudioContext();
    if (!ctx) return;
    var buf = ctx.createBuffer(1, ctx.sampleRate * 0.02, ctx.sampleRate);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = 0.001;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
  } catch (e) {}
}

function startAudioKeepAlive() {
  if (state.audioKeepAlive) return;
  audioKeepAliveBlip();
  state.audioKeepAlive = setInterval(audioKeepAliveBlip, 3000);
}

async function primeAudioPipeline() {
  var PRIME_STALE_MS = 3000;
  var now = Date.now();
  if (state.lastAudioTime && (now - state.lastAudioTime < PRIME_STALE_MS)) return;
  try {
    var ctx = ensureAudioContext();
    if (!ctx) return;
    var buf = ctx.createBuffer(1, ctx.sampleRate * 0.05, ctx.sampleRate);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var gain = ctx.createGain();
    gain.gain.value = 0.001;
    src.connect(gain);
    gain.connect(ctx.destination);
    src.start();
    await new Promise(resolve => setTimeout(resolve, 80));
    state.lastAudioTime = Date.now();
  } catch (e) {
    log('audio prime failed', e);
  }
}

async function playAlertSound(model) {
  if (!settings.beep) {
    return;
  }

  stopActiveAlertSound();

  const categorySound = model.category && settings.categorySounds[model.category];
  const customSrc = categorySound || settings.customBeep;

  if (customSrc && elements.audio) {
    try {
      elements.audio.src = customSrc;
      elements.audio.volume = settings.beepVolume;
      elements.audio.currentTime = 0;
      await new Promise((resolve, reject) => {
        const ready = () => { cleanup(); resolve(); };
        const fail = (e) => { cleanup(); reject(e); };
        const timeout = setTimeout(() => { cleanup(); resolve(); }, 3000);
        function cleanup() {
          clearTimeout(timeout);
          elements.audio.removeEventListener('canplaythrough', ready);
          elements.audio.removeEventListener('error', fail);
        }
        elements.audio.addEventListener('canplaythrough', ready, { once: true });
        elements.audio.addEventListener('error', fail, { once: true });
        elements.audio.load();
      });
      await primeAudioPipeline();
      await elements.audio.play();
      state.lastAudioTime = Date.now();
      return;
    } catch (error) {
      log('custom beep failed', error);
    }
  }

  try {
    await primeAudioPipeline();

    const oscillator = state.audioContext.createOscillator();
    const gain = state.audioContext.createGain();
    oscillator.connect(gain);
    gain.connect(state.audioContext.destination);
    state.activeOscillator = oscillator;
    state.activeGain = gain;

    const baseFrequency = ({
      [ALERT_CATEGORIES.FOLLOW]: 540,
      [ALERT_CATEGORIES.SUBSCRIPTION]: 620,
      [ALERT_CATEGORIES.DONATION]: 720,
      [ALERT_CATEGORIES.BITS]: 840,
      [ALERT_CATEGORIES.RAID]: 460
    })[model.category] || 580;

    const now = state.audioContext.currentTime;
    oscillator.type = model.category === ALERT_CATEGORIES.RAID ? 'triangle' : 'sine';
    oscillator.frequency.setValueAtTime(baseFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(baseFrequency * 1.18, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, settings.beepVolume), now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    oscillator.onended = () => {
      clearActiveGeneratedSound(oscillator, gain);
    };
    oscillator.start(now);
    oscillator.stop(now + 0.32);
    state.lastAudioTime = Date.now();
  } catch (error) {
    log('beep generation failed', error);
    clearActiveGeneratedSound();
  }
}

window.__multiAlertsOverlay = {
  getSettings() {
    return {
      roomID: settings.roomID,
      password: settings.password,
      showTime: settings.showTime,
      cooldown: settings.cooldown,
      queueEnabled: settings.queueEnabled,
      maxQueue: settings.maxQueue,
      minShowTime: settings.minShowTime,
      minDonationValue: settings.minDonationValue,
      beep: settings.beep,
      beepVolume: settings.beepVolume,
      customBeep: settings.customBeep,
      categorySounds: Object.assign({}, settings.categorySounds),
      compact: settings.compact,
      hideAvatar: settings.hideAvatar,
      hideMedia: settings.hideMedia,
      hideSource: settings.hideSource,
      hideAmount: settings.hideAmount,
      hideSubtitle: settings.hideSubtitle,
      includeSources: Array.from(settings.includeSources),
      excludeSources: Array.from(settings.excludeSources),
      includeSourceMatches: Array.from(settings.includeSourceMatches),
      excludeSourceMatches: Array.from(settings.excludeSourceMatches),
      align: settings.align,
      scale: settings.scale,
      mediaScale: settings.mediaScale,
      headlineScale: settings.headlineScale,
      detailScale: settings.detailScale,
      pageBg: settings.pageBg,
      chroma: settings.chroma,
      previewOnly: settings.previewOnly,
      showStatus: settings.showStatus,
      debug: settings.debug,
      useSocket: settings.useSocket,
      serverURL: settings.serverURL,
      styles: Object.assign({}, settings.styles),
      disabledCategories: Object.assign({}, settings.disabledCategories)
    };
  },
  getState() {
    return {
      queueLength: state.queue.length,
      hasAlert: Boolean(state.currentAlert),
      blockedUntil: state.blockedUntil,
      currentCategory: state.currentAlert ? state.currentAlert.category : '',
      currentTitle: state.currentAlert ? state.currentAlert.title : '',
      statusText: elements.status ? elements.status.textContent : ''
    };
  },
  preview(descriptor, options) {
    if (options && typeof options === 'object') {
      handlePreviewMessage({
        __multiAlertsPreviewEnvelope: true,
        payload: descriptor,
        silent: Boolean(options.silent)
      });
      return;
    }
    handlePreviewMessage(descriptor);
  },
  sendPayload(payload) {
    handleIncomingPayload(payload);
  },
  clear(options) {
    clearAlert(options || {});
  }
};
