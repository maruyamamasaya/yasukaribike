// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function getKey(c) {
  if (c.order_id) return c.order_id.slice(0, 14);
  if (c.date) return c.date.replace(/\//g, '');
  return 0;
}

async function searchCustomers() {
  const email = document.getElementById('s-email').value.trim();
  const status = document.getElementById('s-status').value.trim();
  const category = document.getElementById('s-category').value.trim();
  const sort = document.getElementById('s-sort').value;

  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = data.Items || data;

  customers = customers.filter(c =>
    (!email || (c.email || '').includes(email)) &&
    (!status || (c.status || '') === status) &&
    (!category || (c.category || '') === category)
  );

  customers.sort((a, b) => {
    const ka = getKey(a);
    const kb = getKey(b);
    if (ka === kb) return 0;
    if (sort === 'newest') {
      return ka > kb ? -1 : 1;
    }
    return ka < kb ? -1 : 1;
  });

  const tbody = document.querySelector('#result-table tbody');
  tbody.innerHTML = '';
  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${c.name}</td>
      <td>${c.email || ''}</td>
      <td>${c.category || ''}</td>
      <td>${c.status || ''}</td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', searchCustomers);
