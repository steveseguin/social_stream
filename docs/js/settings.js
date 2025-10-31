import SETTINGS_METADATA, { SETTINGS_CATEGORY_INFO } from '../../shared/config/settingsMetadata.js';

const POPUP_SOURCE = '../popup.html';
const TYPE_GUESS = {
  setting: 'boolean',
  optionsetting: 'select',
  textsetting: 'text',
  numbersetting: 'number'
};

const TYPE_LABEL = {
  boolean: 'Toggle',
  select: 'Dropdown',
  text: 'Text input',
  number: 'Number input'
};

const EXPECTS_LABEL = {
  url: 'URL',
  list: 'Comma separated values'
};

const CATEGORY_INFO = SETTINGS_CATEGORY_INFO || {};
const CATEGORY_ORDER = new Map(
  Object.entries(CATEGORY_INFO).map(([key, info]) => [key, info?.order ?? 9000])
);
if (!CATEGORY_ORDER.has('__uncategorized')) {
  CATEGORY_ORDER.set('__uncategorized', 1000);
}

const state = {
  query: '',
  groupMode: 'section',
  records: [],
  loading: false
};

const domRefs = {
  root: document.getElementById('settings-root'),
  search: document.getElementById('setting-search'),
  group: document.getElementById('group-mode'),
  reload: document.getElementById('reload-settings')
};

if (!domRefs.root) {
  throw new Error('settings-root container is missing.');
}

function cleanText(value) {
  if (!value) {
    return '';
  }
  return value.replace(/\u00A0/g, ' ').replace(/\s+/g, ' ').trim();
}

function toTitleCase(value) {
  if (!value) {
    return '';
  }
  return value
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function typeToLabel(type) {
  return TYPE_LABEL[type] || toTitleCase(type) || 'Input';
}

function expectsToLabel(value) {
  return EXPECTS_LABEL[value] || toTitleCase(value);
}

function categoryToLabel(category) {
  if (!category) {
    return 'Uncategorized';
  }
  const info = CATEGORY_INFO[category];
  if (info && info.label) {
    return info.label;
  }
  return toTitleCase(category);
}

function getHeadingEntries(doc) {
  const nodes = [...doc.querySelectorAll('h2, h3, h4, h5')];
  return nodes
    .map((node, index) => {
      const clone = node.cloneNode(true);
      clone.querySelectorAll('a, button, .options-link, .copy-link').forEach(el => el.remove());
      const title = cleanText(clone.textContent);
      return title ? { node, title, order: index } : null;
    })
    .filter(Boolean);
}

function findSectionInfo(element, headingEntries) {
  let current = { title: 'Popup (uncategorized)', order: 9999 };
  for (const entry of headingEntries) {
    const relation = entry.node.compareDocumentPosition(element);
    if (relation & Node.DOCUMENT_POSITION_PRECEDING) {
      break;
    }
    if (
      relation === 0 ||
      relation & Node.DOCUMENT_POSITION_FOLLOWING ||
      entry.node.contains(element)
    ) {
      current = { title: entry.title, order: entry.order };
    }
  }
  return current;
}

function deriveTitle(element) {
  if (element.hasAttribute('title')) {
    return cleanText(element.getAttribute('title'));
  }
  const titled = element.closest('[title]');
  if (titled) {
    return cleanText(titled.getAttribute('title'));
  }
  return '';
}

function deriveLabel(element, doc) {
  if (element.id) {
    const lbl = doc.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (lbl) {
      const text = cleanText(lbl.textContent);
      if (text) {
        return text;
      }
    }
  }

  const labelAncestor = element.closest('label');
  if (labelAncestor) {
    const ownText = cleanText(labelAncestor.textContent);
    if (ownText) {
      return ownText;
    }
  }

  // Check siblings for span or text content
  const siblingText = getSiblingText(element);
  if (siblingText) {
    return siblingText;
  }

  // Fallback to parent container text
  let current = element.parentElement;
  while (current && current !== doc.body) {
    const text = cleanText(current.textContent);
    if (text) {
      return text;
    }
    current = current.parentElement;
  }
  return '';
}

function getSiblingText(element) {
  let parent = element.parentElement;
  while (parent) {
    const textNodes = [];
    parent.childNodes.forEach(node => {
      if (node === element) {
        return;
      }
      if (node.nodeType === Node.TEXT_NODE) {
        const val = cleanText(node.textContent);
        if (val) {
          textNodes.push(val);
        }
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        if (node.matches('input, select, textarea, option')) {
          return;
        }
        const val = cleanText(node.textContent);
        if (val) {
          textNodes.push(val);
        }
      }
    });
    if (textNodes.length) {
      return textNodes.join(' ').trim();
    }
    parent = parent.parentElement;
  }
  return '';
}

function addRecord(map, key, info) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      labels: new Set(),
      titles: new Set(),
      sections: [],
      attrNames: new Set(),
      elementTags: new Set(),
      inferredType: info.type || null
    });
  }
  const record = map.get(key);
  if (info.type && !record.inferredType) {
    record.inferredType = info.type;
  }
  if (info.label) {
    record.labels.add(info.label);
  }
  if (info.title) {
    record.titles.add(info.title);
  }
  if (info.sectionTitle) {
    record.sections.push({ title: info.sectionTitle, order: info.sectionOrder });
  }
  if (info.attrName) {
    record.attrNames.add(info.attrName);
  }
  if (info.elementTag) {
    record.elementTags.add(info.elementTag);
  }
}

function finalizeRecords(map) {
  const records = [];
  for (const [key, entry] of map.entries()) {
    const metadata = SETTINGS_METADATA[key] || null;
    const labels = [...entry.labels].map(cleanText).filter(Boolean);
    const titles = [...entry.titles].map(cleanText).filter(Boolean);
    const sections = buildSectionList(entry.sections);

    const label =
      (metadata && metadata.label) ||
      pickBestLabel(labels) ||
      toTitleCase(key);

    const type =
      (metadata && metadata.type) ||
      entry.inferredType ||
      inferTypeFromTags(entry.elementTags);

    const description = (metadata && metadata.description) || titles[0] || '';
    const descriptionSource = metadata
      ? 'metadata'
      : description
      ? 'popup'
      : 'placeholder';

    const record = {
      key,
      label,
      type,
      metadata,
      description,
      descriptionSource,
      titles,
      section: sections[0] || { title: 'Popup (uncategorized)', order: 9999 },
      allSections: sections,
      attrNames: [...entry.attrNames],
      elementTags: [...entry.elementTags]
    };

    records.push(record);
  }
  return records;
}

function buildSectionList(entries) {
  const dedupe = new Map();
  entries.forEach(({ title, order }) => {
    const clean = cleanText(title);
    if (!clean) {
      return;
    }
    const current = dedupe.get(clean);
    if (current === undefined || order < current) {
      dedupe.set(clean, order);
    }
  });
  return [...dedupe.entries()]
    .map(([title, order]) => ({ title, order }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function pickBestLabel(labels) {
  if (!labels.length) {
    return '';
  }
  const sorted = [...labels].sort((a, b) => a.length - b.length);
  return sorted[0];
}

function inferTypeFromTags(tags) {
  if (tags.has('select')) {
    return 'select';
  }
  if (tags.has('textarea')) {
    return 'text';
  }
  return 'text';
}

function collectSettings(doc) {
  const headingEntries = getHeadingEntries(doc);
  const map = new Map();
  const elements = [...doc.querySelectorAll('input, select, textarea')];

  elements.forEach(element => {
    element
      .getAttributeNames()
      .filter(name => /^data-(setting|optionsetting|textsetting|numbersetting)\d*$/.test(name))
      .forEach(attrName => {
        const match = attrName.match(/^data-(setting|optionsetting|textsetting|numbersetting)/);
        if (!match) {
          return;
        }
        const key = element.getAttribute(attrName);
        if (!key) {
          return;
        }
        const base = match[1];
        const type = TYPE_GUESS[base] || null;
        const sectionInfo = findSectionInfo(element, headingEntries);
        const label = cleanText(deriveLabel(element, doc));
        const title = deriveTitle(element) || cleanText(element.getAttribute('placeholder'));

        addRecord(map, key, {
          type,
          attrName,
          label,
          title,
          sectionTitle: sectionInfo.title,
          sectionOrder: sectionInfo.order,
          elementTag: element.tagName.toLowerCase()
        });
      });
  });

  return finalizeRecords(map);
}

function groupRecords(records, options) {
  const { mode } = options;
  const groups = new Map();

  records.forEach(record => {
    if (mode === 'category') {
      const categoryKey = record.metadata?.category || '__uncategorized';
      const title = categoryToLabel(record.metadata?.category);
      const order = CATEGORY_ORDER.get(categoryKey) ?? 9000;
      const id = `category::${categoryKey}`;
      if (!groups.has(id)) {
        groups.set(id, { id, title, order, items: [] });
      }
      groups.get(id).items.push(record);
    } else {
      const { title, order } = record.section;
      const id = `section::${order}::${title}`;
      if (!groups.has(id)) {
        groups.set(id, { id, title, order, items: [] });
      }
      groups.get(id).items.push(record);
    }
  });

  return [...groups.values()].sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
}

function createMetaItem(term, value) {
  const dt = document.createElement('dt');
  dt.textContent = term;
  const dd = document.createElement('dd');
  dd.textContent = value;
  return { dt, dd };
}

function renderBadge(container, text, className) {
  const badge = document.createElement('span');
  badge.className = `setting-badge ${className}`.trim();
  badge.textContent = text;
  container.appendChild(badge);
}

function createSettingCard(record) {
  const card = document.createElement('article');
  card.className = 'setting-card';
  card.dataset.settingKey = record.key;

  const header = document.createElement('div');
  header.className = 'setting-card-header';

  const title = document.createElement('h3');
  title.className = 'setting-title';
  title.textContent = record.label;

  const key = document.createElement('code');
  key.className = 'setting-key';
  key.textContent = record.key;

  header.appendChild(title);
  header.appendChild(key);
  card.appendChild(header);

  const badges = document.createElement('div');
  badges.className = 'setting-badges';

  if (record.metadata) {
    renderBadge(badges, 'Metadata enriched', 'status-metadata');
  } else {
    renderBadge(badges, 'Auto-imported', 'status-placeholder');
  }

  if (record.metadata?.category) {
    renderBadge(badges, categoryToLabel(record.metadata.category), '');
  }

  if (badges.childElementCount) {
    card.appendChild(badges);
  }

  const description = document.createElement('p');
  description.className = 'setting-description';
  if (record.description) {
    description.textContent = record.description;
    if (record.descriptionSource === 'popup' && record.metadata) {
      description.title = 'Popup tooltip description';
    }
  } else {
    description.classList.add('placeholder');
    description.textContent = 'No description yet. Update shared/config/settingsMetadata.js to document this setting.';
  }
  card.appendChild(description);

  const meta = document.createElement('dl');
  meta.className = 'setting-meta';

  const metaItems = [];
  metaItems.push(createMetaItem('Input', typeToLabel(record.type)));

  if (record.metadata?.scope) {
    metaItems.push(createMetaItem('Scope', toTitleCase(record.metadata.scope)));
  }

  if (record.metadata?.surfaces?.length) {
    metaItems.push(createMetaItem('Surfaces', record.metadata.surfaces.join(', ')));
  }

  if (record.metadata?.targets?.length) {
    metaItems.push(createMetaItem('Targets', record.metadata.targets.join(', ')));
  }

  if (record.metadata?.expects) {
    metaItems.push(createMetaItem('Accepts', expectsToLabel(record.metadata.expects)));
  }

  if (record.section?.title) {
    metaItems.push(createMetaItem('Popup section', record.section.title));
  }

  if (record.allSections.length > 1) {
    const others = record.allSections.slice(1).map(section => section.title).join(', ');
    metaItems.push(createMetaItem('Also appears in', others));
  }

  if (!record.metadata && record.titles?.length > 1) {
    const extras = record.titles.slice(1).join(' • ');
    if (extras) {
      metaItems.push(createMetaItem('Additional hints', extras));
    }
  }

  metaItems.forEach(({ dt, dd }) => {
    meta.appendChild(dt);
    meta.appendChild(dd);
  });

  if (meta.childElementCount) {
    card.appendChild(meta);
  }

  return card;
}

function render(records) {
  domRefs.root.innerHTML = '';

  if (!records.length) {
    const empty = document.createElement('div');
    empty.className = 'settings-empty';
    empty.textContent = 'No settings match your filters.';
    domRefs.root.appendChild(empty);
    return;
  }

  const groups = groupRecords(records, { mode: state.groupMode });

  groups.forEach(group => {
    const section = document.createElement('section');
    section.className = 'settings-section';

    const header = document.createElement('div');
    header.className = 'settings-section-header';

    const title = document.createElement('h2');
    title.className = 'settings-section-title';
    title.textContent = group.title;

    const meta = document.createElement('span');
    meta.className = 'settings-section-meta';
    meta.textContent = `${group.items.length} setting${group.items.length === 1 ? '' : 's'}`;

    header.appendChild(title);
    header.appendChild(meta);
    section.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'settings-grid';

    const sortedItems = group.items.sort((a, b) => a.label.localeCompare(b.label));
    sortedItems.forEach(item => {
      grid.appendChild(createSettingCard(item));
    });

    section.appendChild(grid);
    domRefs.root.appendChild(section);
  });
}

function filterRecords(records) {
  if (!state.query) {
    return records;
  }
  const q = state.query.toLowerCase();
  return records.filter(record => {
    const haystack = [
      record.key,
      record.label,
      record.description,
      record.metadata?.category,
      record.metadata?.scope,
      ...(record.metadata?.targets || []),
      ...(record.metadata?.surfaces || []),
      ...(record.titles || [])
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

function setLoading(isLoading, message) {
  state.loading = isLoading;
  if (domRefs.reload) {
    domRefs.reload.disabled = isLoading;
  }
  if (isLoading) {
    domRefs.root.innerHTML = '';
    const loading = document.createElement('div');
    loading.className = 'loading-state';
    const spinner = document.createElement('div');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');
    const text = document.createElement('p');
    text.textContent = message || 'Loading settings from popup.html…';
    loading.appendChild(spinner);
    loading.appendChild(text);
    domRefs.root.appendChild(loading);
  } else {
    const loader = domRefs.root.querySelector('.loading-state');
    if (loader && loader.parentElement === domRefs.root) {
      loader.remove();
    }
  }
}

function renderError(error) {
  domRefs.root.innerHTML = '';
  const box = document.createElement('div');
  box.className = 'settings-empty';
  box.innerHTML = `
    <strong>Unable to load popup.html</strong><br>
    ${error}
  `;
  domRefs.root.appendChild(box);
}

async function loadSettings() {
  try {
    setLoading(true);
    const response = await fetch(`${POPUP_SOURCE}?_=${Date.now()}`, {
      cache: 'no-cache'
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} (${response.statusText})`);
    }
    const html = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const records = collectSettings(doc);
    state.records = records;
    const filtered = filterRecords(records);
    render(filtered);
  } catch (error) {
    renderError(error.message || String(error));
  } finally {
    setLoading(false);
  }
}

function initEvents() {
  if (domRefs.search) {
    domRefs.search.addEventListener('input', event => {
      state.query = event.target.value.trim();
      const filtered = filterRecords(state.records);
      render(filtered);
    });
  }

  if (domRefs.group) {
    domRefs.group.addEventListener('change', event => {
      state.groupMode = event.target.value === 'category' ? 'category' : 'section';
      const filtered = filterRecords(state.records);
      render(filtered);
    });
  }

  if (domRefs.reload) {
    domRefs.reload.addEventListener('click', () => {
      if (!state.loading) {
        loadSettings();
      }
    });
  }
}

function init() {
  initEvents();
  loadSettings();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
