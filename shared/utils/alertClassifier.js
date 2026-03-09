const ALERT_CATEGORIES = Object.freeze({
  FOLLOW: 'follow',
  SUBSCRIPTION: 'subscription',
  DONATION: 'donation',
  BITS: 'bits',
  RAID: 'raid'
});

const ALERT_STYLE_PRESETS = Object.freeze(['classic', 'twitch', 'minimal']);
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
  'subscription',
  'subscription_gift',
  'resub',
  'sponsorship',
  'giftpurchase',
  'giftredemption',
  'membermilestone',
  'membership',
  'new_member',
  'renewed_member',
  'upgraded_member',
  'gift_giver',
  'gift_recipient',
  'new_sponsor'
]);
const DONATION_EVENTS = new Set([
  'donation',
  'supersticker',
  'thankyou',
  'jeweldonation',
  'tip',
  'support'
]);
const BITS_EVENTS = new Set(['cheer', 'bits']);
const RAID_EVENTS = new Set(['raid', 'host', 'hosting']);

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

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeKey(value) {
  return normalizeText(value).toLowerCase();
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
  const directPlatform = normalizeKey(payload.platform);
  if (directPlatform) return directPlatform;

  const payloadType = normalizeKey(payload.type);
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
    const normalized = normalizeKey(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return payloadType || '';
}

function pickEventKey(payload = {}) {
  const directEvent = normalizeKey(payload.event);
  if (directEvent) return directEvent;

  const payloadType = normalizeKey(payload.type);
  if (payloadType && !KNOWN_SOURCES.has(payloadType)) {
    return payloadType;
  }

  const metaCandidates = [
    payload.meta?.eventType,
    payload.meta?.rawType,
    payload.meta?.alertType
  ];

  for (const candidate of metaCandidates) {
    const normalized = normalizeKey(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return '';
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
    payload.meta?.raiders,
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

function inferCategory(payload = {}) {
  const eventKey = pickEventKey(payload);
  if (COUNT_EVENTS.has(eventKey)) {
    return null;
  }

  const donationLabel = normalizeKey(payload.hasDonation);

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
  if (!eventKey && donationLabel) {
    return /(^|\s)(bit|bits|cheer|cheers)\b/.test(donationLabel)
      ? ALERT_CATEGORIES.BITS
      : ALERT_CATEGORIES.DONATION;
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
      if (eventKey === 'resub' || eventKey === 'renewed_member') {
        return { lead: actor, tail: 'renewed their support' };
      }
      if (eventKey === 'membermilestone') {
        return { lead: actor, tail: 'hit a membership milestone' };
      }
      return { lead: actor, tail: 'just subscribed' };
    case ALERT_CATEGORIES.DONATION:
      return { lead: actor, tail: 'sent support' };
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

function buildBodyText(category, payload, viewerCount) {
  const eventKey = pickEventKey(payload);
  const rawMessage = normalizeText(payload.chatmessage);
  const subtitle = pickSubtitle(payload);

  if (category === ALERT_CATEGORIES.RAID && viewerCount) {
    return rawMessage || `Welcome the raid from ${pickActorName(payload)}.`;
  }
  if (category === ALERT_CATEGORIES.DONATION) {
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

export function buildAlertViewModel(payload = {}) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const category = inferCategory(payload);
  if (!category) {
    return null;
  }

  const eventKey = pickEventKey(payload);
  const sourceKey = pickSourceKey(payload);
  const sourceLabel = SOURCE_LABELS[sourceKey] || humanizeKey(sourceKey);
  const actor = pickActorName(payload);
  const amount = normalizeText(payload.hasDonation);
  const subtitle = pickSubtitle(payload);
  const viewerCount = pickViewerCount(payload);
  const mediaUrl = pickMediaUrl(payload);
  const headline = buildHeadline(category, eventKey, actor, amount, viewerCount);
  const bodyText = buildBodyText(category, payload, viewerCount);

  return {
    category,
    eventKey,
    sourceKey,
    sourceLabel,
    title: CATEGORY_LABELS[category] || 'New Alert',
    accent: CATEGORY_ACCENTS[category] || '#9146ff',
    actor,
    amount,
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

export function createMockAlertPayload(category, overrides = {}) {
  const baseName = overrides.chatname || 'SapheusOwO';
  const accent = CATEGORY_ACCENTS[category] || '#9146ff';
  const common = {
    type: 'twitch',
    platform: 'twitch',
    chatname: baseName,
    chatimg: createAvatarDataUri(baseName, accent),
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
        chatname: 'campa',
        chatimg: createAvatarDataUri('campa', accent),
        chatmessage: 'Raiding with 42 viewers!',
        contentimg: createMediaPreviewDataUri('RAID', accent),
        meta: { viewers: 42, fromLogin: 'campa' }
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

export {
  ALERT_CATEGORIES,
  ALERT_STYLE_PRESETS,
  CATEGORY_LABELS,
  CATEGORY_ACCENTS,
  DEFAULT_ALERT_STYLE,
  SOURCE_LABELS
};
