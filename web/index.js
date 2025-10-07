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

function resolveCustomerStatus(rawStatus) {
  const normalized = typeof rawStatus === 'string' ? rawStatus.trim() : '';
  if (normalized && STATUS_MAP.has(normalized)) {
    return normalized;
  }
  return DEFAULT_STATUS_KEY;
}

function openStatusFolder(key, options = {}) {
  if (!key) return;
  const { newTab = false } = options;
  const url = `status.html?status=${encodeURIComponent(key)}`;
  if (newTab) {
    window.open(url, '_blank', 'noopener');
  } else {
    window.location.href = url;
  }
}

function createFolderElement({ key, label }, countLabel) {
  const wrapper = document.createElement('div');
  wrapper.className = 'folder-card folder-status-card';
  wrapper.dataset.statusKey = key;
  wrapper.setAttribute('role', 'link');
  wrapper.setAttribute('tabindex', '0');
  wrapper.setAttribute('aria-label', `${label}の顧客一覧を開く`);

  wrapper.innerHTML = `
    <span class="folder-icon" aria-hidden="true"></span>
    <span class="folder-title">${label}</span>
    <span class="folder-count">${countLabel}</span>
  `;

  wrapper.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    const shouldOpenNewTab = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    openStatusFolder(key, { newTab: shouldOpenNewTab });
  });

  wrapper.addEventListener('auxclick', event => {
    if (event.button === 1) {
      event.preventDefault();
      openStatusFolder(key, { newTab: true });
    }
  });

  wrapper.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openStatusFolder(key, { newTab: event.ctrlKey || event.metaKey });
    }
  });

  return wrapper;
}

function countByStatus(customers) {
  const counts = new Map();
  STATUS_FOLDERS.forEach(({ key }) => counts.set(key, 0));

  customers.forEach(customer => {
    const statusKey = resolveCustomerStatus(customer.customerStatus);
    counts.set(statusKey, (counts.get(statusKey) || 0) + 1);
  });

  return counts;
}

function renderStatusFolders(container, counts) {
  container.innerHTML = '';

  STATUS_FOLDERS.forEach(status => {
    const countValue = counts && counts.has(status.key) ? counts.get(status.key) : 0;
    const countLabel = typeof countValue === 'number'
      ? countValue.toLocaleString('ja-JP')
      : String(countValue || 0);

    container.appendChild(createFolderElement(status, countLabel));
  });
}

async function loadCounts() {
  const statusContainer = document.getElementById('status-folders');
  const errorMessage = document.getElementById('status-error');
  if (!statusContainer) return;

  renderStatusFolders(statusContainer);
  if (errorMessage) {
    errorMessage.classList.add('d-none');
  }

  try {
    const res = await fetch(API + '/customers');
    const payload = await res.json();
    const customers = (payload.Items || payload).filter(c => !c.draft);

    const counts = countByStatus(customers);
    renderStatusFolders(statusContainer, counts);
  } catch (error) {
    console.error('Failed to load counts', error);
    if (errorMessage) {
      errorMessage.classList.remove('d-none');
    }

    const fallbackCounts = new Map(STATUS_FOLDERS.map(status => [status.key, '—']));
    renderStatusFolders(statusContainer, fallbackCounts);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadCounts();
});
