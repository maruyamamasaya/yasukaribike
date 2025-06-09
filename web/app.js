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
  const today = new Date().toISOString().split('T')[0].replace(/-/g, '/');
  const todayKey = today.replace(/\//g, '');
  const todayCount = customers.filter(c => {
    if (c.date) return c.date === today;
    if (c.order_id) return c.order_id.slice(0, 8) === todayKey;
    return false;
  }).length;
  const unconfirmed = customers.filter(c => (c.status || '') === '未済').length;

  document.getElementById('d-total').textContent = total;
  document.getElementById('d-today').textContent = todayCount;
  document.getElementById('d-unconfirmed').textContent = unconfirmed;
}

async function loadCustomers(page = 1) {
  currentPage = page;
  const q = document.getElementById('search-box').value;
  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = data.Items || data;

  customers = customers.filter(c => !q || c.name.includes(q));

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#customer-table tbody');
  tbody.innerHTML = '';

  const start = (currentPage - 1) * PAGE_SIZE;
  customers.slice(start, start + PAGE_SIZE).forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.phoneNumber || c.phone || ''}</td>
      <td>${c.status || ''}</td>
      <td>
        <button onclick="editCustomer('${c.id}')">編集</button>
        <button onclick="deleteCustomer('${c.id}')">削除</button>
      </td>
      <td><a href="detail.html?id=${c.id}">詳細</a></td>`;
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

function showAddForm() {
  currentItem = null;
  document.getElementById('f-id').value = '';
  document.getElementById('f-name').value = '';
  document.getElementById('f-email').value = '';
  document.getElementById('f-category').value = '';
  document.getElementById('f-phone').value = '';
  document.getElementById('f-note').value = '';
  document.getElementById('history-view').innerHTML = '';
  document.getElementById('form-area').style.display = 'block';
}

async function editCustomer(id) {
  const res = await fetch(API + '/customers/' + id);
  const data = await res.json();
  const item = data.Item || data;
  currentItem = item;
  document.getElementById('f-id').value = item.id;
  document.getElementById('f-name').value = item.name;
  document.getElementById('f-email').value = item.email;
  document.getElementById('f-category').value = item.category;
  document.getElementById('f-phone').value = item.phoneNumber || item.phone;
  document.getElementById('f-note').value = '';
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
  const id = document.getElementById('f-id').value;
  const note = document.getElementById('f-note').value.trim();
  const today = new Date().toISOString().split('T')[0];
  let history = {};
  if (id && currentItem && currentItem.history) {
    history = { ...currentItem.history };
  }
  if (note) {
    history[today] = note;
  }

  let status;
  if (id) {
    if (currentItem && currentItem.id === id) {
      status = currentItem.status;
    } else {
      try {
        const res = await fetch(API + '/customers/' + id);
        if (res.ok) {
          const data = await res.json();
          status = (data.Item || data).status;
        }
      } catch (e) {
        console.error(e);
      }
    }
  } else {
    status = '未済';
  }

  const body = {
    name: document.getElementById('f-name').value,
    email: document.getElementById('f-email').value,
    category: document.getElementById('f-category').value,
    phoneNumber: document.getElementById('f-phone').value,
    history,
    bikes: []
  };
  if (status !== undefined) {
    body.status = status;
  }
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
