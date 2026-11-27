// Compatibility with saved sources and Node callers using the old reader path.
if (typeof window === "undefined" && typeof module !== "undefined") {
	module.exports = require("../streamate.js");
}
