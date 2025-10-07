const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

const DEFAULT_STATUS_KEY = '未分類';

const STATUS_FOLDERS = [
  { key: 'お問い合わせ・来店', label: 'お問い合わせ・来店' },
  { key: '購入希望・見積り', label: '購入希望・見積り' },
  { key: '保証プラン・規約提示', label: '保証プラン・規約提示' },
  { key: '振込案内', label: '振込案内' },
  { key: '契約書送付フェーズ', label: '契約書送付フェーズ' },
  { key: DEFAULT_STATUS_KEY, label: DEFAULT_STATUS_KEY }
];

const STATUS_MAP = new Map(STATUS_FOLDERS.map(item => [item.key, item.label]));
const WHITESPACE_REGEX = /[\s\u3000、,]+/g;

let allCustomers = [];
let filteredCustomers = [];
let currentStatusKey = STATUS_FOLDERS[0]?.key || '';

function resolveCustomerStatus(rawStatus) {
  const normalized = typeof rawStatus === 'string' ? rawStatus.trim() : '';
  if (normalized && STATUS_MAP.has(normalized)) {
    return normalized;
  }
  return DEFAULT_STATUS_KEY;
}

function decodeStatusParam(value) {
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch (error) {
    console.warn('Failed to decode status param', error);
    return value;
  }
}

function getStatusFromQuery() {
  const params = new URLSearchParams(window.location.search);
  const rawStatus = decodeStatusParam(params.get('status'));
  if (rawStatus && STATUS_MAP.has(rawStatus)) {
    return rawStatus;
  }
  return STATUS_FOLDERS[0]?.key || '';
}

function formatDateTime(orderId, fallbackDate) {
  if (orderId && orderId.length >= 12) {
    const y = orderId.slice(0, 4);
    const m = orderId.slice(4, 6);
    const d = orderId.slice(6, 8);
    const hh = orderId.slice(8, 10);
    const mm = orderId.slice(10, 12);
    return `${y}/${m}/${d} ${hh}:${mm}`;
  }
  if (fallbackDate) {
    return String(fallbackDate);
  }
  return '';
}

function getSortKey(customer) {
  if (customer.order_id) return customer.order_id;
  if (customer.date) return String(customer.date).replace(/\D/g, '');
  if (customer.createdAt) return String(customer.createdAt).replace(/\D/g, '');
  return '';
}

function extractLatestNote(customer) {
  if (customer.history) {
    const entries = Object.entries(customer.history)
      .filter(([, value]) => typeof value === 'string')
      .sort(([a], [b]) => (a > b ? 1 : a < b ? -1 : 0));
    const latest = entries[entries.length - 1];
    if (latest && latest[1]) {
      return latest[1];
    }
  }
  if (customer.details) return customer.details;
  if (customer.memo) return customer.memo;
  return '';
}

function createDefinition(label, value) {
  if (!value) return null;
  const group = document.createElement('div');
  group.className = 'status-meta-item';
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value;
  group.append(dt, dd);
  return group;
}

function truncate(text, limit = 120) {
  const value = text || '';
  if (value.length <= limit) return value;
  return `${value.slice(0, limit)}…`;
}

function normalize(value) {
  return String(value || '').toLowerCase();
}

function buildSearchPool(customer) {
  const pool = [
    customer.name,
    customer.furigana,
    customer.phoneNumber,
    customer.phone,
    customer.email,
    customer.status,
    customer.customerStatus,
    customer.category,
    customer.type,
    customer.details,
    customer.memo
  ];

  if (customer.history) {
    Object.values(customer.history).forEach(note => {
      if (typeof note === 'string') {
        pool.push(note);
      }
    });
  }

  return pool
    .filter(Boolean)
    .map(normalize);
}

function matchesKeyword(customer, terms) {
  if (!terms.length) return true;
  const pool = buildSearchPool(customer);
  return terms.every(term => pool.some(value => value.includes(term)));
}

function createResultCard(customer) {
  const card = document.createElement('article');
  card.className = 'result-card status-result-card';

  const header = document.createElement('div');
  header.className = 'result-header';

  const title = document.createElement('h3');
  title.className = 'result-title';
  title.textContent = customer.name || '（名称未設定）';

  const actions = document.createElement('div');
  actions.className = 'result-actions';

  const statusBadge = document.createElement('span');
  statusBadge.className = 'badge rounded-pill status-badge';
  statusBadge.textContent = resolveCustomerStatus(customer.customerStatus);
  actions.appendChild(statusBadge);

  if (customer.order_id) {
    const detailLink = document.createElement('a');
    detailLink.className = 'btn btn-outline-light btn-sm';
    detailLink.href = `detail.html?id=${encodeURIComponent(customer.order_id)}`;
    detailLink.textContent = '詳細を見る';
    detailLink.setAttribute('aria-label', `${title.textContent}の詳細を見る`);
    actions.appendChild(detailLink);
  }

  header.append(title, actions);
  card.appendChild(header);

  const meta = document.createElement('div');
  meta.className = 'status-meta';

  const contactValues = [customer.phoneNumber || customer.phone, customer.email]
    .filter(Boolean)
    .join(' / ');

  const metaItems = [
    createDefinition('受付日時', formatDateTime(customer.order_id, customer.date)),
    createDefinition('お問い合わせ種別', customer.category || customer.type),
    createDefinition('連絡先', contactValues),
    createDefinition('メモタグ', customer.tag)
  ];

  metaItems.forEach(item => {
    if (item) meta.appendChild(item);
  });

  if (meta.children.length) {
    card.appendChild(meta);
  }

  const note = extractLatestNote(customer);
  if (note) {
    const paragraph = document.createElement('p');
    paragraph.className = 'status-note';
    paragraph.textContent = truncate(note, 160);
    card.appendChild(paragraph);
  }

  return card;
}

function updateCountLabel(filteredLength, totalLength) {
  const countEl = document.getElementById('status-count');
  if (!countEl) return;
  const totalLabel = totalLength.toLocaleString('ja-JP');
  const filteredLabel = filteredLength.toLocaleString('ja-JP');
  if (filteredLength === totalLength) {
    countEl.textContent = `${totalLabel}件`;
  } else {
    countEl.textContent = `${filteredLabel}件 (全${totalLabel}件)`;
  }
}

function renderResults(list) {
  const container = document.getElementById('status-results');
  const emptyMessage = document.getElementById('status-empty');
  const loadingIndicator = document.getElementById('status-loading');
  if (loadingIndicator) {
    loadingIndicator.classList.add('d-none');
  }

  if (!container || !emptyMessage) return;

  container.innerHTML = '';
  if (!list.length) {
    emptyMessage.classList.remove('d-none');
    return;
  }

  emptyMessage.classList.add('d-none');
  list.forEach(customer => {
    container.appendChild(createResultCard(customer));
  });
}

function parseKeywordTerms(value) {
  if (!value) return [];
  return value
    .split(WHITESPACE_REGEX)
    .map(term => normalize(term))
    .filter(Boolean);
}

function applyFilter() {
  const keywordInput = document.getElementById('status-keyword');
  const keyword = keywordInput ? keywordInput.value.trim() : '';
  const terms = parseKeywordTerms(keyword);
  filteredCustomers = allCustomers.filter(customer => matchesKeyword(customer, terms));
  renderResults(filteredCustomers);
  updateCountLabel(filteredCustomers.length, allCustomers.length);
}

async function loadCustomers() {
  const errorEl = document.getElementById('status-error');
  const loadingIndicator = document.getElementById('status-loading');
  if (errorEl) errorEl.classList.add('d-none');
  if (loadingIndicator) loadingIndicator.classList.remove('d-none');

  try {
    const response = await fetch(API + '/customers');
    const payload = await response.json();
    const records = Array.isArray(payload.Items) ? payload.Items : payload;
    allCustomers = records
      .filter(customer => !customer.draft)
      .map(customer => ({
        ...customer,
        customerStatus: resolveCustomerStatus(customer.customerStatus)
      }))
      .filter(customer => customer.customerStatus === currentStatusKey)
      .sort((a, b) => {
        const keyA = getSortKey(a);
        const keyB = getSortKey(b);
        if (keyA === keyB) return 0;
        return keyA > keyB ? -1 : 1;
      });
    applyFilter();
  } catch (error) {
    console.error('Failed to load status customers', error);
    if (errorEl) errorEl.classList.remove('d-none');
    allCustomers = [];
    filteredCustomers = [];
    renderResults(filteredCustomers);
    updateCountLabel(0, 0);
    if (loadingIndicator) loadingIndicator.classList.add('d-none');
  }
}

function updatePageHeading() {
  const statusLabel = STATUS_MAP.get(currentStatusKey) || currentStatusKey || 'ステータス別一覧';
  const heading = document.getElementById('status-heading');
  const subtitle = document.getElementById('status-subtitle');
  const title = document.getElementById('status-title');

  if (heading) heading.textContent = statusLabel;
  if (subtitle) subtitle.textContent = `${statusLabel} に分類されている顧客の一覧です。最新のメモや連絡先を確認できます。`;
  if (title) title.textContent = `${statusLabel} / ステータス別一覧`;
  document.title = `${statusLabel} | ステータス別一覧`;
}

function attachEventHandlers() {
  const keywordInput = document.getElementById('status-keyword');
  const clearButton = document.getElementById('status-clear');

  if (keywordInput) {
    keywordInput.addEventListener('input', () => {
      window.requestAnimationFrame(applyFilter);
    });
    keywordInput.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        keywordInput.value = '';
        applyFilter();
      }
    });
  }

  if (clearButton) {
    clearButton.addEventListener('click', () => {
      if (keywordInput) keywordInput.value = '';
      keywordInput?.focus();
      applyFilter();
    });
  }
}

function init() {
  currentStatusKey = getStatusFromQuery();
  updatePageHeading();
  attachEventHandlers();
  loadCustomers();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
