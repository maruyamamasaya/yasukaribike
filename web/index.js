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

function createFolderElement({ key, label }, count) {
  const wrapper = document.createElement('div');
  wrapper.className = 'folder-card folder-status-card';
  wrapper.dataset.statusKey = key;

  wrapper.innerHTML = `
    <span class="folder-icon" aria-hidden="true"></span>
    <span class="folder-title">${label}</span>
    <span class="folder-count">${count}</span>
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

async function loadCounts() {
  const totalEl = document.getElementById('total-count');
  const statusContainer = document.getElementById('status-folders');
  if (!totalEl || !statusContainer) return;

  try {
    const res = await fetch(API + '/customers');
    const payload = await res.json();
    const customers = (payload.Items || payload).filter(c => !c.draft);

    totalEl.textContent = customers.length.toLocaleString('ja-JP');

    const counts = countByStatus(customers);
    statusContainer.innerHTML = '';
    STATUS_FOLDERS.forEach(status => {
      const count = counts.get(status.key) || 0;
      statusContainer.appendChild(createFolderElement(status, count.toLocaleString('ja-JP')));
    });
  } catch (error) {
    console.error('Failed to load counts', error);
    totalEl.textContent = '—';
    statusContainer.innerHTML = '<p class="text-danger mb-0">件数を取得できませんでした。</p>';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const toggleButton = document.getElementById('total-folder');
  const statusContainer = document.getElementById('status-folders');

  if (toggleButton && statusContainer) {
    toggleButton.addEventListener('click', () => {
      const isHidden = statusContainer.classList.toggle('d-none');
      toggleButton.setAttribute('aria-expanded', String(!isHidden));
    });
  }

  loadCounts();
});
