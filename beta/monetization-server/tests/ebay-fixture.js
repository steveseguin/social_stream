// Synthetic eBay transport. Never connects to eBay or creates real orders.
export function fixture() {
	const state = { orders: [], calls: [], bid: 32.5, failOrders: false, expires: 7200 };
	state.fetch = async (endpoint, init = {}) => {
		const url = new URL(endpoint);
		state.calls.push({ url, init });
		let value;
		if (url.pathname === "/identity/v1/oauth2/token") value = { access_token: "synthetic-access", refresh_token: "synthetic-refresh", expires_in: state.expires };
		else if (url.pathname === "/buy/browse/v1/item/get_item_by_legacy_id") {
			const first = url.searchParams.get("legacy_item_id") === "123456789012";
			value = { title: first ? "Retro handheld game console" : "Cozy studio light", price: { value: first ? "50" : "19.99", currency: "USD" }, buyingOptions: first ? ["AUCTION"] : ["FIXED_PRICE"], currentBidPrice: first ? { value: String(state.bid), currency: "USD" } : undefined, itemEndDate: first ? new Date(Date.now() + 3723000).toISOString() : undefined, estimatedAvailabilities: [{ estimatedAvailabilityStatus: "IN_STOCK" }], seller: { username: "test-seller" } };
		} else if (url.pathname === "/sell/fulfillment/v1/order") {
			if (state.failOrders) return { ok: false, status: 503 };
			const offset = Number(url.searchParams.get("offset"));
			value = { orders: state.orders.slice(offset, offset + 200), next: state.orders.length > offset + 200 ? "https://api.ebay.com/unused-next" : undefined };
		} else throw new Error("Unexpected network request: " + url.pathname);
		return { ok: true, status: 200, json: async () => value };
	};
	return state;
}
export function order(id = "synthetic-order", itemId = "234567890123") {
	return { orderId: id, orderPaymentStatus: "PAID", creationDate: new Date().toISOString(), cancelStatus: { cancelState: "NONE_REQUESTED" }, buyer: { username: "private-buyer", email: "private@example.invalid" }, fulfillmentStartInstructions: [{ address: "DO NOT FORWARD" }], paymentSummary: { payments: [{ paymentStatus: "PAID", paymentDate: new Date().toISOString() }] }, lineItems: [{ lineItemId: "1", legacyItemId: itemId, title: "Cozy studio light", quantity: 2 }] };
}
