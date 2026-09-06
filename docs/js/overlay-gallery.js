(function () {
  'use strict';
  var cards = Array.prototype.slice.call(document.querySelectorAll('.gallery-card'));
  var filters = Array.prototype.slice.call(document.querySelectorAll('[data-category]'));
  var search = document.getElementById('gallery-search');
  var session = document.getElementById('gallery-session');
  var password = document.getElementById('gallery-password');
  var setup = document.getElementById('gallery-setup');
  var count = document.getElementById('gallery-count');
  var dialog = document.getElementById('gallery-lightbox');
  var close = document.getElementById('gallery-close');
  var lastFocus = null;
  var category = 'all';
  var theme = document.getElementById('gallery-theme');
  var matching = document.getElementById('gallery-matching');
  var matchingTitle = document.getElementById('gallery-matching-title');
  var motion = document.getElementById('gallery-set-motion');
  var setLinks = document.getElementById('gallery-set-links');
  var setStatus = document.getElementById('gallery-set-status');
  var collections = Object.create(null);
  var selectedSet = null;
  cards.forEach(function (card) {
    if (!card.dataset.collection) return;
    var key = card.dataset.collection;
    if (!collections[key]) collections[key] = Object.create(null);
    collections[key][card.dataset.kind] = card;
  });
  function overlayURL(card, still) {
    var url = new URL('../' + card.dataset.path, window.location.href);
    url.searchParams.set('session', session.value.trim());
    if (password.value) url.searchParams.set('password', password.value);
    if (still) url.searchParams.set('staticart', '');
    else url.searchParams.delete('staticart');
    return url.href;
  }
  function updateSetLinks() {
    if (!selectedSet) return;
    var ready = Boolean(session.value.trim());
    Array.prototype.forEach.call(setLinks.children, function (row) {
      var url = ready ? overlayURL(selectedSet[row.dataset.kind], !motion.checked) : '';
      row.querySelector('input').value = url;
      row.querySelector('button').disabled = !ready;
      var link = row.querySelector('a');
      if (ready) link.href = url;
      else link.removeAttribute('href');
      link.setAttribute('aria-disabled', String(!ready));
    });
    setStatus.textContent = ready ? 'Ready to copy into OBS.' : 'Enter your session ID above to create the three links.';
  }
  function copySetLink(input) {
    var value = input.value;
    function fallback() {
      input.focus();
      input.select();
      var copied = false;
      try { copied = document.execCommand('copy'); } catch (error) {}
      setStatus.textContent = copied ? 'Link copied.' : 'Link selected. Press Ctrl+C (Command+C on Mac) to copy.';
    }
    if (!value) return;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(value).then(function () { setStatus.textContent = 'Link copied.'; }, fallback);
    } else fallback();
  }
  cards.forEach(function (card) {
    var button = card.querySelector('.gallery-use-set');
    var group = collections[card.dataset.collection];
    if (!button || !group || !group.chat || !group.featured || !group.alerts) return;
    button.hidden = false;
    button.addEventListener('click', function () {
      selectedSet = group;
      matchingTitle.textContent = group.featured.querySelector('h2').textContent;
      setLinks.textContent = '';
      ['chat', 'featured', 'alerts'].forEach(function (kind) {
        var label = {chat: 'Chat', featured: 'Featured message', alerts: 'Alerts'}[kind];
        var row = document.createElement('div');
        row.className = 'gallery-set-row';
        row.dataset.kind = kind;
        var image = document.createElement('img');
        image.src = group[kind].querySelector('.gallery-preview img').src;
        image.alt = label + ' preview';
        var field = document.createElement('label');
        field.textContent = label;
        var input = document.createElement('input');
        input.type = 'text'; input.readOnly = true;
        input.spellcheck = false;
        input.placeholder = 'Enter your session ID above';
        field.appendChild(input);
        var actions = document.createElement('div');
        actions.className = 'gallery-set-actions';
        var copy = document.createElement('button');
        copy.type = 'button'; copy.textContent = 'Copy link';
        copy.setAttribute('aria-label', 'Copy ' + label.toLowerCase() + ' link');
        copy.addEventListener('click', function () { copySetLink(input); });
        var open = document.createElement('a');
        open.textContent = 'Open'; open.target = '_blank'; open.rel = 'noopener';
        open.setAttribute('aria-label', 'Open ' + label.toLowerCase() + ' overlay');
        actions.appendChild(copy); actions.appendChild(open);
        row.appendChild(image); row.appendChild(field); row.appendChild(actions);
        setLinks.appendChild(row);
      });
      matching.hidden = false;
      setup.open = true;
      updateSetLinks();
      if (session.value.trim()) matchingTitle.focus();
      else session.focus();
      (session.value.trim() ? matching : setup).scrollIntoView({block: 'start'});
    });
  });
  motion.addEventListener('change', updateSetLinks);
  try {
    var saved = localStorage.getItem('darkMode');
    document.documentElement.classList.toggle('dark-mode', saved === 'true' || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches));
  } catch (error) {}
  function updateThemeLabel() { theme.textContent = document.documentElement.classList.contains('dark-mode') ? 'Light mode' : 'Dark mode'; }
  updateThemeLabel();
  theme.addEventListener('click', function () {
    var dark = document.documentElement.classList.toggle('dark-mode');
    try { localStorage.setItem('darkMode', String(dark)); } catch (error) {}
    updateThemeLabel();
  });
  function filterCards() {
    var terms = search.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    var visible = 0;
    cards.forEach(function (card) {
      var match = (category === 'all' || card.dataset.kind === category) && terms.every(function (term) { return card.dataset.search.indexOf(term) !== -1; });
      card.hidden = !match;
      if (match) visible++;
    });
    count.textContent = visible + ' of ' + cards.length + ' overlays';
    document.getElementById('gallery-empty').hidden = visible !== 0;
    filters.forEach(function (button) { button.setAttribute('aria-pressed', String(button.dataset.category === category)); });
  }
  filters.forEach(function (button) { button.addEventListener('click', function () { category = button.dataset.category; filterCards(); }); });
  search.addEventListener('input', filterCards);
  function updateLinks() {
    cards.forEach(function (card) {
      var link = card.querySelector('.gallery-open');
      if (!session.value.trim()) { link.href = '#gallery-setup'; return; }
      var url = new URL('../' + card.dataset.path, window.location.href);
      url.searchParams.set('session', session.value.trim());
      if (password.value) url.searchParams.set('password', password.value);
      link.href = url.href;
    });
    updateSetLinks();
  }
  session.addEventListener('input', updateLinks);
  password.addEventListener('input', updateLinks);
  cards.forEach(function (card) {
    card.querySelector('.gallery-open').addEventListener('click', function (event) {
      if (session.value.trim()) return;
      event.preventDefault();
      setup.open = true;
      session.focus();
      session.scrollIntoView({ block: 'center' });
    });
  });
  function closeDialog() {
    dialog.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }
  Array.prototype.forEach.call(document.querySelectorAll('[data-screenshot]'), function (link) {
    link.addEventListener('click', function (event) {
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      lastFocus = link;
      var image = document.getElementById('gallery-full-image');
      image.src = link.href;
      image.alt = link.dataset.title + ' overlay showing sample messages';
      document.getElementById('gallery-lightbox-title').textContent = link.dataset.title;
      dialog.hidden = false;
      document.body.style.overflow = 'hidden';
      close.focus();
    });
  });
  close.addEventListener('click', closeDialog);
  dialog.addEventListener('click', function (event) { if (event.target === dialog) closeDialog(); });
  document.addEventListener('keydown', function (event) {
    if (dialog.hidden) return;
    if (event.key === 'Escape') closeDialog();
    if (event.key === 'Tab') { event.preventDefault(); close.focus(); }
  });
  updateLinks();
  filterCards();
})();
