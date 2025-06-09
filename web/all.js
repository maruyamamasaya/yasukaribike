const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function getKey(c) {
  if (c.order_id) return c.order_id.slice(0, 14);
  if (c.date) return c.date.replace(/\//g, '');
  return 0;
}

async function loadAll() {
  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = data.Items || data;
  customers.sort((a, b) => getKey(b) - getKey(a));

  const tbody = document.querySelector('#all-table tbody');
  tbody.innerHTML = '';
  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.phoneNumber || c.phone || ''}</td>
      <td>${c.status || ''}</td>
      <td><a href="edit.html?id=${c.order_id}" class="btn btn-sm btn-primary">編集</a></td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteCustomer('${c.order_id}')">削除</button></td>
      <td><a href="detail.html?id=${c.order_id}">詳細</a></td>`;
    tbody.appendChild(tr);
  });
}

async function deleteCustomer(id) {
  if (!confirm('削除してよろしいですか？')) return;
  await fetch(API + '/customers/' + id, { method: 'DELETE' });
  loadAll();
}

window.addEventListener('DOMContentLoaded', loadAll);
