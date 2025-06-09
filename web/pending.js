const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function getKey(c) {
  if (c.order_id) return c.order_id.slice(0, 14);
  if (c.date) return c.date.replace(/\//g, '');
  return 0;
}

function formatDateTime(id) {
  if (!id || id.length < 14) return '';
  const y = id.slice(0, 4);
  const m = id.slice(4, 6);
  const d = id.slice(6, 8);
  const hh = id.slice(8, 10);
  const mm = id.slice(10, 12);
  const ss = id.slice(12, 14);
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}

async function loadPending() {
  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = (data.Items || data).filter(c => (c.status || '') === '未済');
  customers.sort((a, b) => getKey(b) - getKey(a));

  const tbody = document.querySelector('#pending-table tbody');
  tbody.innerHTML = '';

  customers.forEach(c => {
    const tr = document.createElement('tr');

    let noteSnippet = '';
    if (c.history) {
      const keys = Object.keys(c.history).sort();
      const last = keys[keys.length - 1];
      if (last) noteSnippet = c.history[last] || '';
    }

    if (noteSnippet.length > 50) noteSnippet = noteSnippet.slice(0, 50) + '…';
    noteSnippet = noteSnippet.replace(/\n/g, '<br>');

    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.phoneNumber || c.phone || ''}</td>
      <td>${c.status || ''}</td>
      <td>${formatDateTime(c.order_id)}</td>
      <td style="white-space: pre-wrap;">${noteSnippet}</td>
    `;

    tbody.appendChild(tr);
  });
}

window.addEventListener('DOMContentLoaded', loadPending);
