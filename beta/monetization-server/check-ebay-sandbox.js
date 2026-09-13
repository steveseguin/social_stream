// Run with node --env-file=<private sandbox env path> check-ebay-sandbox.js.
// Never logs credentials, tokens, request headers or raw eBay responses.
if (process.env.EBAY_ENVIRONMENT !== 'sandbox') throw new Error('This check requires EBAY_ENVIRONMENT=sandbox');
const clientId = process.env.EBAY_CLIENT_ID, secret = process.env.EBAY_CLIENT_SECRET;
if (!clientId || !secret) throw new Error('Load the private sandbox environment file first');
try {
	const response = await fetch('https://api.sandbox.ebay.com/identity/v1/oauth2/token', {
		method: 'POST', redirect: 'error', signal: AbortSignal.timeout(12000),
		headers: { Authorization: 'Basic ' + Buffer.from(clientId + ':' + secret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
		body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }).toString()
	});
	if (!response.ok) throw new Error('Sandbox authentication failed (HTTP ' + response.status + ')');
	const result = await response.json();
	if (!result.access_token) throw new Error('Sandbox did not return an application token');
	console.log('Sandbox application authentication passed. No token saved.');
	for (const id of process.argv.slice(2)) {
		if (!/^\d{9,15}$/.test(id)) throw new Error('Sandbox item IDs must be numeric');
		const itemResponse = await fetch('https://api.sandbox.ebay.com/buy/browse/v1/item/get_item_by_legacy_id?legacy_item_id=' + id, {
			redirect: 'error', signal: AbortSignal.timeout(12000), headers: { Authorization: 'Bearer ' + result.access_token, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' }
		});
		const item = await itemResponse.json();
		console.log(JSON.stringify({ id, status: itemResponse.status, title: item.title, price: item.price, errors: item.errors && item.errors.map(e => ({ id: e.errorId, message: e.message })) }));
		if (!itemResponse.ok) process.exitCode = 1;
	}
	console.log(process.env.EBAY_RUNAME ? 'RuName configured; seller consent and a sandbox paid-order test are still required.' : 'Next: configure the sandbox OAuth redirect name (EBAY_RUNAME) and a sandbox seller account.');
} catch (error) {
	console.error(error.message.startsWith('Sandbox') ? error.message : 'Sandbox authentication check could not complete.');
	process.exitCode = 1;
}
