const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function getKey(c) {
  if (c.order_id) return c.order_id.slice(0, 14);
  if (c.date) return c.date.replace(/\//g, '');
  return 0;
}

async function loadToday() {
  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = data.Items || data;
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '/');
  const todayKey = today.replace(/\//g, '');
  customers = customers.filter(c => {
    if (c.date) return c.date === today;
    if (c.order_id) return c.order_id.slice(0, 8) === todayKey;
    return false;
  });
  customers.sort((a, b) => getKey(b) - getKey(a));

  const tbody = document.querySelector('#today-table tbody');
  tbody.innerHTML = '';
  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.phoneNumber || c.phone || ''}</td>
      <td>${c.status || ''}</td>
      <td><a href="detail.html?id=${c.order_id}">詳細</a></td>`;
    tbody.appendChild(tr);
  });
}

window.addEventListener('DOMContentLoaded', loadToday);
