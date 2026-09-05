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
