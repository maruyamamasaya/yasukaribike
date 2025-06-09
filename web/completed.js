const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

async function loadCompleted() {
  const res = await fetch(API + '/customers');
  const data = await res.json();
  const customers = (data.Items || data).filter(c => (c.status || '') === '済');
  const tbody = document.querySelector('#done-table tbody');
  tbody.innerHTML = '';
  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.phoneNumber || c.phone || ''}</td>
      <td>${c.status}</td>
      <td><a href="detail.html?id=${c.order_id}">詳細</a></td>`;
    tbody.appendChild(tr);
  });
}

window.addEventListener('DOMContentLoaded', loadCompleted);
