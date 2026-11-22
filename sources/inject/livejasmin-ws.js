// Older saved source lists and Node callers can still resolve this path.
if (typeof window === "undefined" && typeof module !== "undefined") {
	module.exports = require("../livejasmin.js");
}
