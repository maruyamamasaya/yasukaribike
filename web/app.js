// APIエンドポイント（後で差し替える）
const API = 'https://example.com/api';

let currentItem = null;

async function loadCustomers() {
  const q = document.getElementById('search-box').value;
  const res = await fetch(API + '/customers');
  const data = await res.json();
  const tbody = document.querySelector('#customer-table tbody');
  tbody.innerHTML = '';
  const customers = data.Items || data;
  customers
    .filter(c => !q || c.name.includes(q))
    .forEach(c => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${c.name}</td>
        <td>${c.phone || ''}</td>
        <td>${c.status || ''}</td>
        <td>
          <button onclick="editCustomer('${c.id}')">編集</button>
          <button onclick="deleteCustomer('${c.id}')">削除</button>
        </td>`;
      tbody.appendChild(tr);
    });
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
  document.getElementById('f-phone').value = item.phone;
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

  const body = {
    name: document.getElementById('f-name').value,
    email: document.getElementById('f-email').value,
    category: document.getElementById('f-category').value,
    phone: document.getElementById('f-phone').value,
    status: '未済',
    history,
    bikes: []
  };
  const method = id ? 'PUT' : 'POST';
  const url = id ? API + '/customers/' + id : API + '/customers';
  await fetch(url, { method, body: JSON.stringify(body) });
  hideForm();
  loadCustomers();
}

function hideForm() {
  document.getElementById('form-area').style.display = 'none';
}

// 初期表示
loadCustomers();
