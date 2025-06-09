// APIエンドポイント
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let currentItem = null;
let currentPage = 1;
const PAGE_SIZE = 10;

async function loadDashboard() {
  const res = await fetch(API + '/customers');
  const data = await res.json();
  const customers = data.Items || data;

  const total = customers.length;
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '/');
  const todayKey = today.replace(/\//g, '');
  const todayCount = customers.filter(c => {
    if (c.date) return c.date === today;
    if (c.order_id) return c.order_id.slice(0, 8) === todayKey;
    return false;
  }).length;
  const unconfirmed = customers.filter(c => (c.status || '') === '未済').length;
  const completed = customers.filter(c => (c.status || '') === '済').length;

  document.getElementById('d-total').textContent = total;
  document.getElementById('d-today').textContent = todayCount;
  document.getElementById('d-unconfirmed').textContent = unconfirmed;
  const compEl = document.getElementById('d-completed');
  if (compEl) compEl.textContent = completed;
}

async function loadCustomers(page = 1) {
  currentPage = page;
  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = data.Items || data;

  customers = customers.filter(c => (c.status || '') !== '済');

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#customer-table tbody');
  tbody.innerHTML = '';

  const start = (currentPage - 1) * PAGE_SIZE;
  customers.slice(start, start + PAGE_SIZE).forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.phoneNumber || c.phone || ''}</td>
      <td>
        ${c.status || ''}
        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="toggleStatus('${c.order_id}', '${c.status || ''}')">
          ${c.status === '未済' ? 'タスクを完了させる' : 'タスクを未済に戻す'}
        </button>
      </td>
      <td>
        <button class="btn btn-sm btn-primary" onclick="editCustomer('${c.order_id}')">編集</button>
      </td>
      <td><a href="detail.html?id=${c.order_id}" class="btn btn-sm btn-link">詳細</a></td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || customers.length === 0;
}

async function deleteCustomer(id) {
  if (!confirm('削除してよろしいですか？')) return;
  await fetch(API + '/customers/' + id, { method: 'DELETE' });
  loadCustomers();
}

async function toggleStatus(id, current) {
  const newStatus = current === '済' ? '未済' : '済';
  await fetch(API + '/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  loadCustomers();
  loadDashboard();
}

function showAddForm() {
  currentItem = null;
  document.getElementById('f-order_id').value = '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-kana').value = '';
  document.getElementById('f-email').value = '';
  document.getElementById('f-category').value = '電話';
  document.getElementById('f-phone').value = '';
  document.getElementById('f-details').value = '';
  const statusEl = document.getElementById('f-status');
  statusEl.value = '未済';
  statusEl.disabled = true;
  document.getElementById('f-staff').value = '';
  document.getElementById('f-history-note').value = '';
  document.getElementById('history-view').innerHTML = '';
  document.getElementById('form-area').style.display = 'block';
}

async function editCustomer(id) {
  const res = await fetch(API + '/customers/' + id);
  const data = await res.json();
  const item = data.Item || data;
  currentItem = item;
  document.getElementById('f-order_id').value = item.order_id;
  document.getElementById('f-name').value = item.name;
  document.getElementById('f-kana').value = item.kana || '';
  document.getElementById('f-email').value = item.email;
  document.getElementById('f-category').value = item.category || item.type || '電話';
  document.getElementById('f-phone').value = item.phoneNumber || item.phone;
  document.getElementById('f-details').value = item.details || '';
  const statusEl = document.getElementById('f-status');
  statusEl.disabled = false;
  statusEl.value = item.status || '未済';
  document.getElementById('f-staff').value = item.staff || '';
  document.getElementById('f-history-note').value = '';
  const hv = document.getElementById('history-view');
  hv.innerHTML = '';
  if (item.history) {
    Object.entries(item.history).forEach(([d, n]) => {
      const div = document.createElement('div');
      div.textContent = `${d}: ${n}`;
      hv.appendChild(div);
    });
  }
  document.getElementById('form-area').style.display = 'block';
}

async function saveCustomer() {
  const id = document.getElementById('f-order_id').value;
  const note = document.getElementById('f-history-note').value.trim();
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0];
  let history = {};
  if (id && currentItem && currentItem.history) {
    history = { ...currentItem.history };
  }
  if (note) {
    history[today] = note;
  }

  const status = document.getElementById('f-status').value || '未済';

  const body = {
    name: document.getElementById('f-name').value,
    kana: document.getElementById('f-kana').value,
    email: document.getElementById('f-email').value,
    category: document.getElementById('f-category').value,
    phoneNumber: document.getElementById('f-phone').value,
    details: document.getElementById('f-details').value,
    staff: document.getElementById('f-staff').value,
    status,
    history,
    bikes: []
  };
  const method = id ? 'PUT' : 'POST';
  const url = id ? API + '/customers/' + id : API + '/customers';
  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  hideForm();
  loadCustomers();
}

function hideForm() {
  document.getElementById('form-area').style.display = 'none';
}

function nextPage() {
  loadCustomers(currentPage + 1);
}

function prevPage() {
  loadCustomers(currentPage - 1);
}

// 初期表示
loadDashboard();
loadCustomers();
