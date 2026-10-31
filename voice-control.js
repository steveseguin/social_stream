(function () {
	"use strict";
	var native = window.ninjafy && window.ninjafy.voiceControl,
		token = location.hash.slice(1),
		working = false,
		lastState = null;
	var $ = function (id) {
		return document.getElementById(id);
	};
	try {
		if (token) {
			sessionStorage.setItem("ssn-voice-pair", token);
			history.replaceState(null, "", location.pathname);
		} else if (!native) token = sessionStorage.getItem("ssn-voice-pair") || "";
	} catch (_) {}
	if (!native) {
		$("desktop-tools").hidden = true;
		document.body.classList.add("dock");
	}
	function request(action, options) {
		if (native) return window.ninjafy.voiceControl(action, options || {});
		if (!token) return Promise.reject(Error("Open Voice Control in an updated SSApp, or use its private OBS dock link."));
		return fetch("/control", { method: "POST", headers: { "Content-Type": "application/json", "X-SSN-Voice": token }, body: JSON.stringify({ action: action, options: options || {} }) })
			.then(function (r) {
				if (r.status === 403) throw Error("Dock access expired. Create a new link in SSApp.");
				return r.json();
			})
			.then(function (r) {
				if (r.error) throw Error(r.error);
				return r;
			});
	}
	function render(s) {
		lastState = s;
		$("phase").textContent = s.phase.charAt(0).toUpperCase() + s.phase.slice(1);
		$("mode").textContent = s.armed ? "ACTIONS ENABLED" : "TEST MODE";
		$("message").textContent = s.message;
		$("heard").textContent = s.heard || "Nothing yet.";
		$("match").textContent = s.match ? "Matched: " + s.match : "";
		$("commands").textContent = s.commands + " active voice trigger" + (s.commands === 1 ? "" : "s") + " in Event Flow.";
		$("arm").checked = s.armed;
		$("arm").disabled = s.phase !== "listening";
		$("start").disabled = s.phase !== "stopped" || working;
		$("stop").disabled = s.phase === "stopped";
		$("microphone").disabled = s.phase !== "stopped";
		$("devices").disabled = s.phase !== "stopped";
		$("level").style.width = s.level * 100 + "%";
	}
	async function run(action, options) {
		working = true;
		$("start").disabled = true;
		if (action === "start") $("stop").disabled = false;
		var error = "";
		try {
			render(await request(action, options));
		} catch (e) {
			error = e.message;
		} finally {
			working = false;
			if (lastState) render(lastState);
			if (error) $("message").textContent = error;
		}
	}
	$("start").onclick = function () {
		run("start", { deviceId: $("microphone").value });
	};
	$("stop").onclick = function () {
		run("stop");
	};
	$("arm").onchange = function () {
		run("arm", { armed: this.checked });
	};
	$("devices").onclick = async function () {
		try {
			var result = await request("devices");
			$("microphone").textContent = "";
			var option = document.createElement("option");
			option.value = "";
			option.textContent = "System default";
			$("microphone").appendChild(option);
			result.devices.forEach(function (d, i) {
				var o = document.createElement("option");
				o.value = d.deviceId;
				o.textContent = d.label || "Microphone " + (i + 1);
				$("microphone").appendChild(o);
			});
			if (!result.devices.length) $("message").textContent = "No microphone found or permission denied.";
		} catch (e) {
			$("message").textContent = e.message;
		}
	};
	$("dock").onclick = async function () {
		try {
			var s = await request("dock");
			$("dock-link").hidden = false;
			$("dock-link").value = s.dockUrl;
			$("dock-link").select();
		} catch (e) {
			$("message").textContent = e.message;
		}
	};
	$("revoke").onclick = function () {
		run("revoke");
		$("dock-link").hidden = true;
		$("dock-link").value = "";
	};
	setInterval(function () {
		if (!working)
			request("status")
				.then(render)
				.catch(function (e) {
					$("phase").textContent = "Disconnected";
					$("message").textContent = e.message;
					$("start").disabled = true;
					$("arm").disabled = true;
				});
	}, 700);
	request("status")
		.then(render)
		.catch(function (e) {
			$("message").textContent = e.message;
			$("start").disabled = true;
		});
})();
