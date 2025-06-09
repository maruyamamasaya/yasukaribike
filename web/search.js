// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;


async function searchCustomers() {
  const dateInput = document.getElementById('s-date').value.trim();
  const date = dateInput ? dateInput.replace(/-/g, '/') : '';
  const name = document.getElementById('s-name').value.trim();
  const phone = document.getElementById('s-phone').value.trim();
  const email = document.getElementById('s-email').value.trim();
  const status = document.getElementById('s-status').value.trim();
  const category = document.getElementById('s-category').value.trim();
  const details = document.getElementById('s-details').value.trim();

  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = data.Items || data;

  customers = customers.filter(c =>
    (!date || (c.date || '').includes(date)) &&
    (!name || (c.name || '').includes(name)) &&
    (!phone || (c.phone || c.phoneNumber || '').includes(phone)) &&
    (!email || (c.email || '').includes(email)) &&
    (!status || (c.status || '') === status) &&
    (!category || (c.category || '') === category) &&
    (!details || (c.details || '').includes(details))
  );


  const tbody = document.querySelector('#result-table tbody');
  tbody.innerHTML = '';
  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.email || ''}</td>
      <td>${c.category || ''}</td>
      <td>${c.status || ''}</td>
      <td><a href="detail.html?id=${c.order_id}">詳細</a></td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', searchCustomers);
