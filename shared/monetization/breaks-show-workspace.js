(function (root) {
	"use strict";
	// Uses the Breaks workspace's existing controls and sealed request path.
	root.SSNBreaksShowWorkspace = function (panel, helpers) {
		var node = helpers.node,
			button = helpers.button,
			state = null,
			result = null,
			buyer = "",
			page = 0,
			selectedPrize = "",
			prizeRevision = 0,
			fetching = false;
		var section = node("section");
		section.dataset.view = "show";
		section.hidden = true;
		section.innerHTML =
			'<div class="br-actions"><label>Show<select data-show-select></select></label><button type="button" data-show-new>New show</button><button type="button" data-show-attach>Add current break</button><button type="button" data-show-export>Export full show</button></div>' +
			'<div class="br-two"><div><h2>Running order</h2><div data-show-queue></div><button type="button" data-show-setup>Prepare a break</button><details><summary>Giveaway prizes</summary><div data-show-prizes></div><form data-prize-form>' +
			helpers.field("prize-name", "Prize", "text", 'maxlength="160" required') +
			"<label>Use stock<select data-prize-stock></select></label>" +
			helpers.field("prize-buyer", "Winner account", "text", 'maxlength="80"') +
			helpers.select("prize-platform", "Platform", [
				["other", "Other"],
				["whatnot", "Whatnot"],
				["ebay", "eBay"],
				["tiktok", "TikTok"],
				["twitch", "Twitch"],
				["youtube", "YouTube"]
			]) +
			helpers.field("prize-order", "Order reference", "text", 'maxlength="100"') +
			'<div class="br-actions"><button type="submit">Save prize</button><button type="button" data-prize-new>New prize</button></div></form><details><summary>Use an SSN giveaway winner</summary><button type="button" data-prize-load>Load recent winners</button><div data-prize-winners></div></details><div class="br-actions"><a data-tool="giveaway-control.html" target="_blank" rel="noopener">SSN giveaways</a><a href="docs/breaks.html#show" target="_blank" rel="noopener">Giveaway guide</a></div></details></div>' +
			'<div><h2>Pack orders</h2><div class="br-actions"><button type="button" data-show-refresh>Refresh packing</button><button type="button" data-show-csv>Export packing CSV</button></div><p data-show-issues class="br-muted"></p><div data-show-buyers></div><div data-show-pages class="br-actions"></div><details><summary>Show estimate</summary><div data-show-totals></div></details></div></div>' +
			'<section data-packing-slip hidden><h2>Packing slip</h2><div data-slip-content class="br-record"></div><div data-slip-actions class="br-actions"></div></section>';
		panel.appendChild(section);
		section
			.querySelector("[data-show-buyers]")
			.parentElement.appendChild(section.querySelector("[data-packing-slip]"));
		var create = node("form", undefined, "br-actions");
		create.hidden = true;
		create.dataset.showCreate = "";
		create.innerHTML =
			helpers.field("show-title", "Show name", "text", 'maxlength="100" required') +
			'<button type="submit">Create show</button>';
		create.appendChild(
			button("Cancel", function () {
				create.hidden = true;
			})
		);
		section.insertBefore(create, section.children[1]);
		var cleanup = node("details");
		cleanup.appendChild(node("summary", "Saved show"));
		cleanup.appendChild(
			button("Remove show records", function () {
				if (
					showId() &&
					confirm(
						"Remove this show, its archived breaks, queue, and prize records? Export first. Stock quantities will not change."
					)
				)
					run("breakShow", { remove: true, discard: true });
			})
		);
		section.appendChild(cleanup);
		function el(q) {
			return section.querySelector(q);
		}
		function field(name) {
			return section.querySelector('[data-field="' + name + '"]');
		}
		function showId() {
			return state && state.showId;
		}
		function run(command, data) {
			return helpers.send(command, Object.assign({ showId: showId() }, data));
		}
		function resetPrize() {
			selectedPrize = "";
			prizeRevision = state ? state.revision : 0;
			["prize-name", "prize-buyer", "prize-platform", "prize-order"].forEach(function (k) {
				field(k).value = k === "prize-platform" ? "other" : "";
			});
			el("[data-prize-stock]").value = "";
			el("[data-prize-stock]").disabled = false;
			field("prize-name").readOnly = false;
		}
		function refresh() {
			if (fetching || !showId()) return Promise.resolve(false);
			fetching = true;
			return run("breakShowGet", { buyerKey: buyer, page: page }).then(function () {
				fetching = false;
			});
		}
		el("[data-show-refresh]").onclick = refresh;
		el("[data-show-new]").onclick = function () {
			create.hidden = false;
			field("show-title").focus();
		};
		create.onsubmit = function (e) {
			e.preventDefault();
			run("breakShow", { create: true, title: field("show-title").value }).then(function (ok) {
				if (ok) {
					create.hidden = true;
					field("show-title").value = "";
					buyer = "";
					page = 0;
					resetPrize();
					refresh();
				}
			});
		};
		el("[data-show-select]").onchange = function () {
			buyer = "";
			page = 0;
			run("breakShow", { showId: this.value }).then(function (ok) {
				if (ok) {
					resetPrize();
					refresh();
				}
			});
		};
		el("[data-show-attach]").onclick = function () {
			run("breakShow", { attach: true }).then(function (ok) {
				if (ok) refresh();
			});
		};
		el("[data-show-setup]").onclick = function () {
			helpers.show("setup");
		};
		el("[data-prize-new]").onclick = resetPrize;
		el("[data-prize-stock]").onchange = function () {
			var stock = state.stock.filter(function (s) {
				return s.id === el("[data-prize-stock]").value;
			})[0];
			if (stock && !field("prize-name").value) field("prize-name").value = stock.name;
		};
		el("[data-prize-form]").onsubmit = function (e) {
			e.preventDefault();
			if (!showId()) return helpers.say("Create a show first.", true);
			run("breakPrize", {
				id: selectedPrize,
				revision: selectedPrize ? prizeRevision : state.revision,
				name: field("prize-name").value,
				stockId: el("[data-prize-stock]").value,
				buyer: field("prize-buyer").value,
				platform: field("prize-platform").value || "other",
				orderRef: field("prize-order").value
			}).then(function (ok) {
				if (ok) {
					resetPrize();
					refresh();
				}
			});
		};
		el("[data-prize-load]").onclick = function () {
			run("breakGiveawayResults");
		};
		function saveFile(name, body, type) {
			var a = document.createElement("a"),
				url = URL.createObjectURL(new Blob([body], { type: type }));
			a.href = url;
			a.download = name;
			a.click();
			setTimeout(function () {
				URL.revokeObjectURL(url);
			}, 30000);
		}
		async function exportShow(csv) {
			if (!showId()) return;
			var content = "",
				revision = state.revision,
				id = showId();
			try {
				do {
					var r = await helpers.read("breakShowGet", {
						showId: id,
						revision: revision,
						export: !csv,
						csv: csv,
						offset: content.length
					});
					if (
						r.revision !== revision ||
						typeof r.exportChunk !== "string" ||
						(!r.exportChunk && content.length < r.total)
					)
						throw new Error("Show export interrupted. Try again.");
					content += r.exportChunk;
				} while (content.length < r.total);
				saveFile(
					csv ? "packing.csv" : "show-record.json",
					content,
					csv ? "text/csv;charset=utf-8" : "application/json"
				);
				helpers.say("Show record downloaded.");
			} catch (e) {
				helpers.say(e.message, true);
			}
		}
		el("[data-show-export]").onclick = function () {
			exportShow(false);
		};
		el("[data-show-csv]").onclick = function () {
			exportShow(true);
		};
		function printDialog() {
			if (!result || !result.selected) return;
			var frame = document.createElement("iframe");
			frame.title = "Packing slip print";
			frame.style.cssText = "position:fixed;width:0;height:0;border:0";
			document.body.appendChild(frame);
			frame.onload = function () {
				frame.contentWindow.focus();
				frame.contentWindow.print();
				setTimeout(function () {
					frame.remove();
				}, 30000);
			};
			var doc = frame.contentWindow.document;
			doc.open();
			doc.write(
				"<!doctype html><html><head><title>Packing slip</title><style>@page{margin:12mm}body{font:12pt Arial,sans-serif;color:#000;background:#fff}h2{margin:0 0 8px}</style></head><body>" +
					root.SSNBreaks.packingHTML(result) +
					"</body></html>"
			);
			doc.close();
		}
		function renderPacking(r, nativePrinter) {
			result = r;
			var list = el("[data-show-buyers]");
			list.textContent = "";
			el("[data-show-issues]").textContent = r.unresolvedCount
				? r.unresolvedCount + " unresolved: " + r.unresolved.slice(0, 3).join("; ")
				: r.total
					? r.total + " buyers. Check platform orders before shipping."
					: "Buyers and giveaway winners appear here.";
			r.groups.forEach(function (g) {
				var row = node("article", undefined, "br-record");
				row.appendChild(node("strong", g.buyer + " / " + g.platform));
				row.appendChild(
					node(
						"span",
						g.count +
							(g.count === 1 ? " item" : " items") +
							(g.issues ? " / " + g.issues + " payment checks" : ""),
						"br-muted"
					)
				);
				row.appendChild(
					node(
						"span",
						g.status === "pending" ? "To pack" : g.status === "packed" ? "Packed" : "Shipped",
						g.issues
							? "br-badge br-failed"
							: g.status === "pending"
								? "br-badge br-unchecked"
								: "br-badge br-paid"
					)
				);
				row.appendChild(
					button("Review & print", function () {
						buyer = g.key;
						el("[data-packing-slip]").hidden = true;
						refresh().then(function () {
							el("[data-packing-slip]").scrollIntoView({ block: "nearest" });
						});
					})
				);
				list.appendChild(row);
			});
			var pages = el("[data-show-pages]");
			pages.textContent = "";
			if (r.page > 0)
				pages.appendChild(
					button("Previous", function () {
						page--;
						refresh();
					})
				);
			if ((r.page + 1) * 25 < r.total)
				pages.appendChild(
					button("Next", function () {
						page++;
						refresh();
					})
				);
			var totals = el("[data-show-totals]");
			totals.textContent = "";
			r.totals.forEach(function (t) {
				totals.appendChild(
					node(
						"p",
						t.currency +
							" " +
							(t.revenue - t.cost).toFixed(2) +
							" estimated after recorded costs" +
							(t.unknown ? " / " + t.unknown + " unpriced stock records" : "")
					)
				);
			});
			var slip = el("[data-packing-slip]");
			slip.hidden = !r.selected;
			if (!r.selected) return;
			el("[data-slip-content]").innerHTML = root.SSNBreaks.packingHTML(r);
			var actions = el("[data-slip-actions]");
			actions.textContent = "";
			var correction = el("[data-payment-correction]");
			if (correction) correction.remove();
			var paymentRows = r.selected.lines.filter(function (l) {
				return l.payment;
			});
			if (paymentRows.length) {
				correction = node("details");
				correction.dataset.paymentCorrection = "";
				correction.innerHTML =
					"<summary>Correct a payment</summary><form>" +
					helpers.select(
						"pack-line",
						"Spot",
						paymentRows.map(function (l) {
							return [l.id, l.title];
						})
					) +
					helpers.select("pack-payment", "Payment", [
						["unknown", "Not checked"],
						["paid", "Paid"],
						["failed", "Failed"],
						["refunded", "Refunded"]
					]) +
					helpers.field("pack-paid", "Confirmed amount", "number", 'min="0" step="0.01"') +
					'<button type="submit">Save payment</button></form>';
				slip.appendChild(correction);
				function choosePayment() {
					var l = paymentRows.filter(function (l) {
						return l.id === field("pack-line").value;
					})[0];
					field("pack-payment").value = l.payment;
					field("pack-paid").value = l.paid === null ? "" : l.paid;
					field("pack-paid").title = l.currency;
				}
				field("pack-line").onchange = choosePayment;
				choosePayment();
				correction.querySelector("form").onsubmit = function (e) {
					e.preventDefault();
					run("breakPackingPayment", {
						lineId: field("pack-line").value,
						payment: field("pack-payment").value,
						paid: field("pack-paid").value,
						revision: r.revision
					}).then(function (ok) {
						if (ok) refresh();
					});
				};
			}
			actions.appendChild(button("Print / Save PDF", printDialog));
			if (nativePrinter)
				actions.appendChild(
					button("Print thermal slip", function () {
						var bytes = crypto.getRandomValues(new Uint8Array(16)),
							id = Array.from(bytes)
								.map(function (v) {
									return v.toString(16).padStart(2, "0");
								})
								.join("");
						run("breakPrint", { buyerKey: r.selected.key, jobId: id, revision: r.revision }).then(
							function (ok) {
								if (ok) {
									helpers.say("Sent to printer. Check the printed slip.");
									refresh();
								}
							}
						);
					})
				);
			["packed", "shipped", "pending"].forEach(function (status) {
				actions.appendChild(
					button(
						status === "pending" ? "Mark pending" : status === "packed" ? "Mark packed" : "Mark shipped",
						function () {
							var reviewed =
								status === "pending" ||
								!r.selected.issues ||
								confirm("This buyer has unresolved payments. Have you checked the platform orders?");
							if (!reviewed) return;
							run("breakPack", {
								buyerKey: r.selected.key,
								status: status,
								reviewed: reviewed,
								revision: r.revision
							}).then(function (ok) {
								if (ok) refresh();
							});
						}
					)
				);
			});
		}
		function render(next) {
			var prior = state;
			state = next.breaks || state;
			if (!state) return;
			// Keep an untouched prize editable across unrelated stock or display changes.
			if (selectedPrize && prior && prior.showId === state.showId && prizeRevision === prior.revision) {
				var oldPrize =
					prior.show &&
					prior.show.prizes.find(function (p) {
						return p.id === selectedPrize;
					});
				var newPrize =
					state.show &&
					state.show.prizes.find(function (p) {
						return p.id === selectedPrize;
					});
				if (oldPrize && newPrize && JSON.stringify(oldPrize) === JSON.stringify(newPrize))
					prizeRevision = state.revision;
			}
			if (prior && prior.showId !== state.showId) {
				buyer = "";
				page = 0;
				result = null;
				resetPrize();
				el("[data-prize-winners]").textContent = "";
			}
			var selected = el("[data-show-select]");
			selected.textContent = "";
			selected.appendChild(new Option("Choose a show", ""));
			state.shows.forEach(function (s) {
				selected.appendChild(new Option(s.title, s.id));
			});
			selected.value = state.showId;
			var stock = el("[data-prize-stock]"),
				value = stock.value;
			stock.textContent = "";
			stock.appendChild(new Option("None / separate prize", ""));
			state.stock.forEach(function (s) {
				stock.appendChild(new Option(s.name + " (" + s.quantity + ")", s.id));
			});
			stock.value = value;
			stock.disabled = !!selectedPrize;
			var queue = el("[data-show-queue]");
			queue.textContent = "";
			var current = state.show;
			if (!current)
				queue.appendChild(node("p", "Create a show to group breaks, prizes, and packing.", "br-muted"));
			if (state.active && state.active.showId === state.showId)
				queue.appendChild(node("p", "Current: " + state.active.title));
			((current && current.queue) || []).forEach(function (q) {
				var row = node("article", undefined, "br-record");
				row.appendChild(node("strong", q.title));
				row.appendChild(node("span", q.spots + " spots", "br-muted"));
				row.appendChild(
					button("Start break", function () {
						if (state.active && !confirm("Archive the current break and start this one?")) return;
						run("breakQueueStart", { id: q.id, replace: !!state.active }).then(function (ok) {
							if (ok) helpers.show("live");
						});
					})
				);
				row.appendChild(
					button("Remove", function () {
						run("breakQueueRemove", { id: q.id });
					})
				);
				queue.appendChild(row);
			});
			var prizes = el("[data-show-prizes]");
			prizes.textContent = "";
			((current && current.prizes) || []).forEach(function (p) {
				var row = node("article", undefined, "br-record");
				row.appendChild(node("strong", p.name));
				row.appendChild(
					node("span", p.buyer ? p.buyer + " / " + p.platform : "Winner not recorded", "br-muted")
				);
				row.appendChild(
					button("Record winner", function () {
						selectedPrize = p.id;
						prizeRevision = state.revision;
						field("prize-name").value = p.name;
						field("prize-name").readOnly = true;
						field("prize-buyer").value = p.buyer;
						if (
							!Array.from(field("prize-platform").options).some(function (o) {
								return o.value === p.platform;
							})
						)
							field("prize-platform").appendChild(new Option(p.platform, p.platform));
						field("prize-platform").value = p.platform;
						field("prize-order").value = p.orderRef;
						stock.value = p.stock ? p.stock.stockId : "";
						stock.disabled = true;
						field("prize-buyer").focus();
					})
				);
				row.appendChild(
					button("Remove & return stock", function () {
						if (confirm("Remove this prize and return any reserved stock?"))
							run("breakPrizeRemove", { id: p.id }).then(function (ok) {
								if (ok) resetPrize();
							});
					})
				);
				prizes.appendChild(row);
			});
			if (next.showExport)
				saveFile("show-record.json", JSON.stringify(next.showExport, null, 2), "application/json");
			if (next.packingCSV) saveFile("packing.csv", next.packingCSV, "text/csv;charset=utf-8");
			if (next.giveawayResults) {
				var winners = el("[data-prize-winners]");
				winners.textContent = "";
				if (!next.giveawayResults.length) winners.appendChild(node("p", "No saved SSN winners."));
				next.giveawayResults.forEach(function (w) {
					winners.appendChild(
						button(w.name + " / " + w.platform + " / " + w.round, function () {
							if (!selectedPrize) return helpers.say("Choose Record winner beside a prize first.", true);
							run("breakPrize", {
								id: selectedPrize,
								revision: prizeRevision,
								buyer: w.name,
								platform: w.platform,
								receipt: w.receipt
							}).then(function (ok) {
								if (ok) {
									resetPrize();
									refresh();
								}
							});
						})
					);
				});
			}
			if (next.showResult) renderPacking(next.showResult, next.nativePrinter);
			else if (result && result.revision !== state.revision) {
				result = null;
				el("[data-packing-slip]").hidden = true;
				el("[data-show-buyers]").textContent = "";
				el("[data-show-issues]").textContent = "Refresh packing to load the latest changes.";
			}
			if (!section.hidden && showId() && !result && !fetching) setTimeout(refresh, 50);
		}
		return {
			render: render,
			refresh: refresh,
			controls: function (busy) { el("[data-prize-stock]").disabled = busy || !!selectedPrize; },
			clear: function () {
				state = null;
				result = null;
				buyer = "";
				el("[data-slip-content]").textContent = "";
				el("[data-slip-actions]").textContent = "";
				el("[data-packing-slip]").hidden = true;
				var correction = el("[data-payment-correction]");
				if (correction) correction.remove();
				el("[data-show-buyers]").textContent = "";
				el("[data-show-queue]").textContent = "";
				el("[data-show-prizes]").textContent = "";
				el("[data-prize-winners]").textContent = "";
				el("[data-show-select]").textContent = "";
				el("[data-show-totals]").textContent = "";
				el("[data-show-issues]").textContent = "";
				el("[data-show-pages]").textContent = "";
				el("[data-prize-stock]").textContent = "";
				field("show-title").value = "";
				resetPrize();
			}
		};
	};
})(window);
