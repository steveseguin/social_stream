(function (root) {
    'use strict';
    root.SSNCommerceBoardControls = function (panel, request, baseURL) {
        var state, busy = false, selected = '', dirty = false, lastRender = '', initialized = false;
        var flight = null, generation = 0, hostOn, boardRender = '', salesRender = '';
        var auction = null, saleSpot = null, salePlatform = '';
        // Static markup only. Operator-entered names and results always use textContent/value.
        panel.innerHTML = '<summary>▦ Spot boards &amp; recent sales</summary><div class="cb-content">' +
            '<p>Track your show. <a href="docs/commerce-boards.html" target="_blank" rel="noopener">Visual guide</a></p>' +
            '<div class="cb-links"><label>OBS display<select data-field="view"><option value="board">Spot / team board</option><option value="sales">Recent sales · list</option><option value="wall">Recent sales · wall</option><option value="ticker">Recent sales · strip</option></select></label><button type="button" data-action="copy">Copy OBS link</button><a data-preview target="_blank" rel="noopener">Preview sample</a></div>' +
            '<label>OBS link<input data-field="link" readonly type="text" aria-label="OBS browser source link"></label>' +
            '<details><summary>Create or replace a board</summary><label>Board title<input data-field="title" type="text" maxlength="80" value="Pick your spot"></label>' +
            '<label>Style<select data-field="style"><option value="spots">Numbered tiles</option><option value="teams">Team tiles</option></select></label><div class="cb-row"><label>Spots<input data-field="count" type="number" min="1" max="120" value="120"></label><label>Columns<input data-field="columns" type="number" min="1" max="20" value="20"></label></div>' +
            '<label>Team / spot names · one per line<textarea data-field="labels" rows="4" maxlength="8000" placeholder="Leave blank for numbered spots"></textarea></label><button type="button" data-action="save">Create board</button></details>' +
            '<p data-board-status></p><div class="cb-row"><button type="button" data-action="visibility">Show board</button><button type="button" data-action="refresh">Refresh</button></div>' +
            '<div class="cb-spots" aria-label="Select a spot"></div><div data-editor hidden><p data-selected></p><div class="cb-row"><button type="button" data-action="spot-sale">Record sale for this spot</button><button type="button" data-action="claimed">Mark claimed only</button><button type="button" data-action="available">Make available</button></div><label>Reveal text<input data-field="result" type="text" maxlength="100" placeholder="Item assigned on your selling platform"></label><button type="button" data-action="revealed">Reveal</button><p>Claiming reserves the spot. Revealing shows this text to the audience.</p></div>' +
            '<details><summary>Recent sales</summary><label class="cb-toggle"><span class="switch"><input data-field="visible" type="checkbox" aria-label="Show recent sales"><span class="slider round"></span></span>Show recent sales</label>' +
            '<label class="cb-toggle"><span class="switch"><input data-field="automatic" type="checkbox" aria-label="Collect store purchases"><span class="slider round"></span></span>Collect connected store purchases</label>' +
            '<label>Auction item helper<select data-field="auction-source"><option value="">Manual entry</option><option value="whatnot">Whatnot</option><option value="ebay">eBay Live</option></select></label><button type="button" data-action="settings">Save sales options</button>' +
            '<p>Automatic purchases use store connections, including eBay seller orders. Whatnot and eBay Live auctions require your payment check.</p><p data-sales-status></p>' +
            '<div data-auction-helper hidden><p data-auction></p><button type="button" data-action="auction">Use auction item</button><p>Copies the name only. Check payment in your seller console, then enter the sale total below.</p></div>' +
            '<p data-sale-spot hidden></p><button type="button" data-action="unlink" hidden>Remove spot link</button><p data-sale-origin hidden></p>' +
            '<label>Sold item<input data-field="sale-title" type="text" maxlength="180"></label><div class="cb-row"><label>Sale total · optional<input data-field="amount" type="number" min="0" max="9999999" step="0.01"></label><label>Currency<input data-field="currency" type="text" maxlength="3" value="USD"></label><label>Quantity<input data-field="quantity" type="number" min="1" max="100000" value="1"></label></div>' +
            '<button type="button" data-action="sale">Confirm sale</button><ol class="cb-sales"></ol><button type="button" data-action="clear">Clear sales</button><p>Up to 100 recent entries, saved on this SSN installation. Remove refunds or mistakes here.</p></details>' +
            '<p data-feedback role="status" aria-live="polite"></p></div>';
        function field(name) { return panel.querySelector('[data-field="' + name + '"]'); }
        function say(message) { panel.querySelector('[data-feedback]').textContent = message; }
        function saleLink() {
            panel.querySelector('[data-sale-origin]').hidden = !salePlatform;
            panel.querySelector('[data-sale-origin]').textContent = salePlatform ? 'Source: ' + (salePlatform === 'ebay' ? 'eBay Live' : 'Whatnot') + ' · awaiting your confirmation' : '';
            panel.querySelector('[data-sale-spot]').hidden = !saleSpot;
            panel.querySelector('[data-sale-spot]').textContent = saleSpot ? 'Linked spot: ' + saleSpot.label + '. This sale also claims the spot.' : '';
            panel.querySelector('[data-action="unlink"]').hidden = !saleSpot;
            panel.querySelector('[data-action="sale"]').textContent = saleSpot ? 'Confirm sale & claim spot' : 'Confirm sale';
        }
        function link(demo) {
            var base = baseURL(); if (!base || (!demo && !new URL(base).searchParams.get('session'))) throw new Error('Wait for your SSN session to load.');
            var original = new URL(base), url = new URL('commerce-board.html', original);
            if (!demo) ['session', 'password', 'server', 'server2', 'server3', 'localserver', 'localserverport'].forEach(function (key) { if (original.searchParams.has(key)) url.searchParams.set(key, original.searchParams.get(key)); });
            else url.searchParams.set('demo', '');
            url.searchParams.set('view', field('view').value);
            if (demo && field('style').value === 'teams') url.searchParams.set('style', 'teams');
            return url.href;
        }
        function links() { try { field('link').value = link(false); } catch (_) { field('link').value = ''; } try { panel.querySelector('[data-preview]').href = link(true); } catch (_) {} }
        function render(next) {
            if (!next || !next.boards) throw new Error('Board controls are unavailable. Update Social Stream.');
            state = next.boards;
            if (next.auction !== undefined) auction = next.auction;
            if (next.hostOn !== undefined) hostOn = next.hostOn;
            if (!initialized) {
                initialized = true;
                if (state.board.spots.length) {
                    field('title').value = state.board.title; field('style').value = state.board.style;
                    field('columns').value = state.board.columns; field('count').value = state.board.spots.length;
                    field('labels').value = state.board.spots.every(function (s) { return s.label === s.id; }) ? '' : state.board.spots.map(function (s) { return s.label; }).join('\n');
                }
            }
            links();
            var signature = JSON.stringify([state, selected, hostOn, auction]);
            if (signature === lastRender) return; // Keep keyboard focus and scroll while polling unchanged state.
            lastRender = signature;
            if (!dirty) { field('automatic').checked = state.automatic; field('visible').checked = state.salesVisible; field('auction-source').value = state.auctionSource || ''; }
            panel.querySelector('[data-sales-status]').textContent = (state.salesVisible ? 'Recent-sales display selected' : 'Recent-sales display hidden') + ' · ' + state.sales.length + ' entries';
            panel.querySelector('[data-auction-helper]').hidden = !state.auctionSource;
            panel.querySelector('[data-auction]').textContent = auction ? 'Last captured: ' + auction.title + ' · ' + auction.status + (auction.priceText ? ' · ' + auction.priceText + ' shown by source' : '') : 'Waiting for ' + (state.auctionSource === 'ebay' ? 'eBay Live' : 'Whatnot') + '. Open your show in SSN with Capture Stream Events enabled.';
            panel.querySelector('[data-action="auction"]').disabled = !auction;
            panel.querySelector('[data-board-status]').textContent = (state.board.visible ? 'Board selected' : 'Board hidden') + ' · ' + state.board.spots.length + ' spots' + (hostOn === false ? ' · SSN is off' : '');
            panel.querySelector('[data-action="visibility"]').textContent = state.board.visible ? 'Hide board' : 'Show board';
            var grid = panel.querySelector('.cb-spots'), boardSignature = JSON.stringify([state.board.spots, selected]);
            if (boardSignature !== boardRender) {
            boardRender = boardSignature;
            var scroll = grid.scrollTop, focused = grid.contains(document.activeElement) ? document.activeElement.dataset.spot : '';
            grid.textContent = '';
            state.board.spots.forEach(function (spot) {
                var button = document.createElement('button'); button.type = 'button'; button.textContent = spot.label;
                button.dataset.spot = spot.id;
                button.className = 'cb-' + spot.status; button.setAttribute('aria-label', spot.label + ': ' + spot.status); button.setAttribute('aria-pressed', String(selected === spot.id));
                button.onclick = function () { selected = spot.id; field('result').value = spot.result; render(stateWrapper()); field('result').focus(); };
                grid.appendChild(button);
            });
            if (focused) { var replacement = grid.querySelector('[data-spot="' + focused + '"]'); if (replacement) replacement.focus({preventScroll:true}); }
            grid.scrollTop = scroll;
            }
            var chosen = state.board.spots.filter(function (s) { return s.id === selected; })[0];
            panel.querySelector('[data-editor]').hidden = !chosen;
            panel.querySelector('[data-selected]').textContent = chosen ? chosen.label + ' · ' + chosen.status : '';
            var sales = panel.querySelector('.cb-sales'), salesSignature = JSON.stringify([state.sales, state.board.id]);
            if (salesSignature === salesRender) return;
            salesRender = salesSignature;
            var saleScroll = sales.scrollTop, saleFocus = sales.contains(document.activeElement) ? document.activeElement.dataset.sale : '';
            var saleIndex = saleFocus ? Array.prototype.indexOf.call(sales.querySelectorAll('button'), document.activeElement) : -1;
            sales.textContent = '';
            state.sales.forEach(function (sale) {
                var li = document.createElement('li'), label = document.createElement('span'), button = document.createElement('button');
                label.textContent = sale.title + ' · ' + sale.source + (sale.quantity > 1 ? ' · Qty ' + sale.quantity : '') + (sale.amount !== null && sale.currency ? ' · ' + sale.currency + ' ' + sale.amount.toFixed(2) + ' total' : ''); button.type = 'button'; button.textContent = 'Remove'; button.setAttribute('aria-label', 'Remove sale: ' + sale.title);
                button.dataset.sale = sale.id;
                button.onclick = function () { send('saleRemove', {id:sale.id}); }; li.appendChild(label); var actions = document.createElement('div'); actions.className = 'cb-sale-actions'; actions.appendChild(button);
                if (sale.boardId && sale.boardId === state.board.id && sale.spotId) {
                    var refund = document.createElement('button'); refund.type = 'button'; refund.textContent = 'Refund & reopen'; refund.dataset.sale = sale.id;
                    refund.setAttribute('aria-label', 'Remove sale and reopen spot: ' + sale.title);
                    refund.onclick = function () { if (window.confirm('Remove this sale and make its spot available again?')) send('saleRemove', {id:sale.id, reopenSpot:true}); };
                    actions.appendChild(refund);
                }
                li.appendChild(actions); sales.appendChild(li);
            });
            if (saleFocus) {
                var buttons = sales.querySelectorAll('button'), target = Array.prototype.find.call(buttons, function (b) { return b.dataset.sale === saleFocus; }) || buttons[Math.min(saleIndex, buttons.length - 1)] || panel.querySelector('[data-action="sale"]');
                target.focus({preventScroll:true});
            }
            sales.scrollTop = saleScroll;
        }
        function stateWrapper() { return {boards:state}; }
        function unwrap(reply) { if (!reply || reply.error || reply.ok === false) throw new Error(reply && (typeof reply.error === 'string' ? reply.error : reply.error && reply.error.message) || 'Commerce command failed.'); return reply.payload || reply; }
        function refresh() {
            if (busy || flight || !panel.open) return flight;
            var epoch = generation;
            flight = request('getCommerceState').then(function (reply) { if (epoch === generation) render(unwrap(reply).commerce); }).catch(function (error) { if (epoch === generation) say(error.message); }).then(function () { flight = null; });
            return flight;
        }
        function send(command, data) {
            if (busy) return; busy = true; generation++;
            panel.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
            return request('commerceControl', {command:command, data:data}).then(function (reply) {
                var result = unwrap(reply); if (command === 'salesSettings') dirty = false;
                render(result.commerceState || result.commerce); say('Saved.');
                if (command === 'saleAdd') { field('sale-title').value = ''; field('amount').value = ''; field('quantity').value = '1'; saleSpot = null; salePlatform = ''; saleLink(); say(state.salesVisible ? 'Sale saved.' : 'Sale saved. Turn on Show recent sales to select its display.'); }
                if (command === 'saleRemove' && data.reopenSpot) { var chosen = state.board.spots.filter(function (s) { return s.id === selected; })[0]; if (chosen) field('result').value = chosen.result; }
            }).catch(function (error) { say(error.message); }).then(function () { busy = false; panel.querySelectorAll('button').forEach(function (b) { b.disabled = false; }); panel.querySelector('[data-action="auction"]').disabled = !auction; });
        }
        panel.addEventListener('click', function (event) {
            var button = event.target.closest('[data-action]'); if (!button || busy) return;
            var action = button.dataset.action;
            if (action === 'refresh') return refresh();
            if (action === 'copy') { try { var url = link(false); field('link').value = url; navigator.clipboard.writeText(url).then(function () { say('OBS link copied.'); }).catch(function () { field('link').select(); say('Copy the selected link.'); }); } catch (error) { field('link').select(); say(error.message); } return; }
            if (!state) { say('Refresh to connect to SSN first.'); return; }
            if (action === 'spot-sale') {
                var spot = state.board.spots.filter(function (s) { return s.id === selected; })[0]; if (!spot) return;
                salePlatform = ''; saleSpot = {id:spot.id, boardId:state.board.id, label:spot.label}; saleLink();
                field('sale-title').value = state.board.title + ' / ' + spot.label; field('amount').value = ''; field('quantity').value = '1';
                panel.querySelectorAll('details')[1].open = true; field('sale-title').focus(); return;
            }
            if (action === 'unlink') { saleSpot = null; saleLink(); return; }
            if (action === 'auction' && auction) {
                if (field('sale-title').value && !window.confirm('Replace the current sale item with the captured auction item?')) return;
                salePlatform = auction.source; saleLink(); field('sale-title').value = auction.title; field('amount').value = ''; field('quantity').value = '1'; field('amount').focus();
                say('Item copied. Check payment and enter the confirmed sale total before confirming.'); return;
            }
            if (action === 'save') {
                if (state.board.spots.length && !window.confirm('Replace this board and clear its spot selections?')) return;
                selected = ''; return send('boardSave', {title:field('title').value, style:field('style').value, count:Number(field('count').value), columns:Number(field('columns').value), labels:field('labels').value});
            }
            if (action === 'visibility') return send('boardVisibility', {visible:!state.board.visible});
            if (['available','claimed','revealed'].indexOf(action) !== -1) return send('boardSpot', {id:selected, status:action, result:field('result').value});
            if (action === 'settings') return send('salesSettings', {automatic:field('automatic').checked, visible:field('visible').checked, auctionSource:field('auction-source').value});
            if (action === 'sale') return send('saleAdd', {title:field('sale-title').value, amount:field('amount').value, currency:field('currency').value.toUpperCase(), quantity:Number(field('quantity').value), spotId:saleSpot && saleSpot.id, boardId:saleSpot && saleSpot.boardId, platform:salePlatform});
            if (action === 'clear' && window.confirm('Clear the recent-sales display?')) return send('salesClear', {});
        });
        panel.addEventListener('change', function (event) {
            if (event.target === field('automatic') || event.target === field('visible') || event.target === field('auction-source')) dirty = true;
            if (event.target === field('style') && field('style').value === 'teams' && field('columns').value === '20') field('columns').value = '6';
            if (event.target === field('view') && field('view').value !== 'board') panel.querySelectorAll('details')[1].open = true;
            links();
        });
        panel.addEventListener('toggle', function (event) { if (event.target === panel) refresh(); });
        field('link').onclick = function () { this.select(); };
        var timer = setInterval(refresh, 5000); root.addEventListener('beforeunload', function () { clearInterval(timer); });
    };
})(window);
