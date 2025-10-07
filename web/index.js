const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

const STATUS_FOLDERS = [
  { key: 'お問い合わせ・来店', label: 'お問い合わせ・来店' },
  { key: '購入希望・見積り', label: '購入希望・見積り' },
  { key: '保証プラン・規約提示', label: '保証プラン・規約提示' },
  { key: '振込案内', label: '振込案内' },
  { key: '契約書送付フェーズ', label: '契約書送付フェーズ' }
];

function createFolderElement({ key, label }, countLabel) {
  const wrapper = document.createElement('div');
  wrapper.className = 'folder-card folder-status-card';
  wrapper.dataset.statusKey = key;

  wrapper.innerHTML = `
    <span class="folder-icon" aria-hidden="true"></span>
    <span class="folder-title">${label}</span>
    <span class="folder-count">${countLabel}</span>
  `;

  return wrapper;
}

function countByStatus(customers) {
  const counts = new Map();
  STATUS_FOLDERS.forEach(({ key }) => counts.set(key, 0));

  customers.forEach(customer => {
    const status = customer.status || '未着手';
    if (counts.has(status)) {
      counts.set(status, counts.get(status) + 1);
    }
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
