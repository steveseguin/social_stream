const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', 'sources', 'streamlabs.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const instrumented = source.replace(
  /\n\}\)\(\);\s*$/,
  '\n  window.__streamlabsTest = { buildPayload, deriveDonation };\n})();'
);

const windowStub = {};
const documentStub = {
  getElementById: () => null,
  querySelector: () => null
};

windowStub.self = windowStub;
windowStub.top = windowStub;

const sandbox = vm.createContext({
  window: windowStub,
  document: documentStub,
  console,
  setTimeout: () => 0
});

vm.runInContext(instrumented, sandbox);

const { buildPayload, deriveDonation } = sandbox.window.__streamlabsTest;

const cheerPayload = buildPayload({
  messageTemplate: 'Alice cheered 500 bits',
  messageText: 'Alice cheered 500 bits',
  tokens: { name: 'Alice', amount: '500' }
});

assert.strictEqual(cheerPayload.event, 'cheer');
assert.strictEqual(cheerPayload.hasDonation, '500 bits');
assert.strictEqual(cheerPayload.donoValue, 5);

const largeCheer = deriveDonation({ amount: '1,500' }, 'Alice cheered 1,500 bits', 'cheer');
assert.strictEqual(largeCheer.hasDonation, '1,500 bits');
assert.strictEqual(largeCheer.donoValue, 15);

console.log('streamlabs-source tests passed');
