const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const backgroundSource = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
const dockSource = fs.readFileSync(path.join(root, 'dock.html'), 'utf8');
const tipJarSource = fs.readFileSync(path.join(root, 'tipjar.html'), 'utf8');
const multiAlertsSource = fs.readFileSync(path.join(root, 'multi-alerts.js'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing function ${name}`);
  const braceStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`Unable to extract function ${name}`);
}

function getBranch(source, marker, nextMarker) {
  const start = source.indexOf(marker);
  assert(start >= 0, `Missing branch ${marker}`);
  const end = source.indexOf(nextMarker, start + marker.length);
  assert(end > start, `Missing branch boundary ${nextMarker}`);
  return source.slice(start, end);
}

const sandbox = {};
vm.createContext(sandbox);
vm.runInContext(
  `${extractFunction(backgroundSource, 'normalizeInboundWebhookId')}\n` +
  `${extractFunction(backgroundSource, 'getInboundWebhookDeliveryId')}\n` +
  'this.getInboundWebhookDeliveryId = getInboundWebhookDeliveryId;',
  sandbox
);

const dedupeSandbox = {};
vm.createContext(dedupeSandbox);
vm.runInContext(
  'const recentInboundWebhookDeliveries = new Map();\n' +
  `${extractFunction(backgroundSource, 'isDuplicateInboundWebhook')}\n` +
  'this.isDuplicateInboundWebhook = isDuplicateInboundWebhook;',
  dedupeSandbox
);

assert.strictEqual(dedupeSandbox.isDuplicateInboundWebhook('kofi', 'delivery-1'), false);
assert.strictEqual(dedupeSandbox.isDuplicateInboundWebhook('kofi', 'delivery-1'), true);
assert.strictEqual(dedupeSandbox.isDuplicateInboundWebhook('kofi', 'delivery-2'), false);
assert.strictEqual(dedupeSandbox.isDuplicateInboundWebhook('stripe', 'delivery-1'), false);

assert.strictEqual(
  sandbox.getInboundWebhookDeliveryId('stripe', { id: 'evt_123', data: { object: { id: 'cs_123' } } }),
  'evt_123'
);
assert.strictEqual(
  sandbox.getInboundWebhookDeliveryId('kofi', { message_id: 'kofi-123' }),
  'kofi-123'
);
assert.strictEqual(
  sandbox.getInboundWebhookDeliveryId('bmac', { event_id: 1234, data: { id: 99 } }),
  '1234'
);
assert.strictEqual(
  sandbox.getInboundWebhookDeliveryId('fourthwall', { id: 'fw-event-123', webhookId: 'configuration-id' }),
  'fw-event-123'
);

const routingSandbox = {};
vm.createContext(routingSandbox);
vm.runInContext(
  `${extractFunction(backgroundSource, 'hasTargetedMetaPayload')}\n` +
  'this.hasTargetedMetaPayload = hasTargetedMetaPayload;',
  routingSandbox
);
assert.strictEqual(routingSandbox.hasTargetedMetaPayload({ meta: { webhookId: 'delivery-1' } }), false);
assert.strictEqual(routingSandbox.hasTargetedMetaPayload({ meta: { webhookId: 'delivery-1', amount: 3 } }), true);
assert.strictEqual(routingSandbox.hasTargetedMetaPayload({ meta: 3 }), true);

const providerBranches = [
  ['stripe', 'else if ("stripe" in data)', 'else if ("kofi" in data)'],
  ['kofi', 'else if ("kofi" in data)', 'else if ("bmac" in data)'],
  ['bmac', 'else if ("bmac" in data)', 'else if ("fourthwall" in data)'],
  ['fourthwall', 'else if ("fourthwall" in data)', 'if (typeof resp == "object")']
];

for (const [provider, marker, nextMarker] of providerBranches) {
  const branch = getBranch(backgroundSource, marker, nextMarker);
  assert(branch.includes(`getInboundWebhookDeliveryId("${provider}"`), `${provider} does not preserve its webhook ID`);
  assert(branch.includes(`isDuplicateInboundWebhook("${provider}"`), `${provider} does not suppress provider retries`);
  assert(branch.includes('setInboundWebhookMeta('), `${provider} does not expose meta.webhookId`);
  assert(branch.includes('applyBotActions('), `${provider} bypasses bot actions`);
  assert(branch.includes('eventFlowSystem.processMessage('), `${provider} bypasses Event Flow`);
  assert(branch.includes('sendToDestinations('), `${provider} bypasses normal message routing`);
}

assert(dockSource.includes('!!socketserver &&'), 'Modern Dock webhook preference is not limited to its direct API route');
assert(dockSource.includes('queueRawDonationWebhookFallback(data)'), 'Modern Dock has no background-first compatibility fallback');
assert(dockSource.includes('WEBHOOK_BACKGROUND_GRACE_MS'), 'Modern Dock fallback has no bounded grace period');
for (const provider of ['stripe', 'kofi', 'bmac', 'fourthwall']) {
  assert(dockSource.includes(`"${provider}" in data`), `Dock compatibility path does not cover ${provider}`);
}
assert(tipJarSource.includes("const webhookId = meta.webhookId || '';"), 'Tip Jar does not prefer stable webhook IDs');
assert(tipJarSource.includes('isDuplicateContribution(data, contribution, true)'), 'Normal Tip Jar donations are not deduplicated');
assert(tipJarSource.includes('processTip(donationString, contribution.donator, sourceType, data)'), 'Tip Jar drops original donation metadata after dedupe');
assert(multiAlertsSource.includes('payload.meta?.webhookId'), 'Multi Alerts does not deduplicate stable webhook IDs');

console.log('PASS shared webhook routing, Event Flow, and downstream dedupe contracts');
