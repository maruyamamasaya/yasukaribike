const API = 'https://example.com/api';

function getKey(c) {
  return c.createdAt || c.id || 0;
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
