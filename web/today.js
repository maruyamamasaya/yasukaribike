const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let sortDescending = true;

function getKey(c) {
  if (c.order_id) return c.order_id.slice(0, 14);
  if (c.date) return c.date.replace(/\//g, '');
  return 0;
}

function formatDateTime(id) {
  if (!id || id.length < 12) return '';
  const y = id.slice(0, 4);
  const m = id.slice(4, 6);
  const d = id.slice(6, 8);
  const hh = id.slice(8, 10);
  const mm = id.slice(10, 12);
  return `${y}/${m}/${d} ${hh}時${mm}分`;
}

function getDateStr(item) {
  let key = '';
  if (item.order_id) key = item.order_id.slice(0, 8);
  else if (item.date) key = item.date.replace(/\//g, '').slice(0, 8);
  if (!key) return '';
  return `${key.slice(0, 4)}/${key.slice(4, 6)}/${key.slice(6, 8)}`;
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
  customers.sort((a, b) =>
    sortDescending ? getKey(b) - getKey(a) : getKey(a) - getKey(b)
  );

  const tbody = document.querySelector('#today-table tbody');
  tbody.innerHTML = '';
  const colspan = document.querySelector('#today-table thead tr').children.length;
  let lastDate = '';

  customers.forEach(c => {
    const dateStr = getDateStr(c);
    if (dateStr && dateStr !== lastDate) {
      const gr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = colspan;
      td.className = 'table-secondary fw-bold';
      td.textContent = dateStr;
      gr.appendChild(td);
      tbody.appendChild(gr);
      lastDate = dateStr;
    }

    const tr = document.createElement('tr');
    let note = '';
    if (c.history) {
      const keys = Object.keys(c.history).sort();
      const last = keys[keys.length - 1];
      if (last) note = c.history[last];
    }
    let snippet = note.slice(0, 50);
    if (note.length > 50) snippet += '…';
    snippet = snippet.replace(/\n/g, '<br>');
    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.phoneNumber || c.phone || ''}</td>
      <td>
        ${c.status || ''}
        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="toggleStatus('${c.order_id}', '${c.status || ''}')">
          ${c.status === '未済' ? 'タスクを完了させる' : 'タスクを未済に戻す'}
        </button>
      </td>
      <td>${formatDateTime(c.order_id)}</td>
      <td style="width:20%; white-space: pre-wrap;">${snippet}</td>`;
    tbody.appendChild(tr);
  });
}

async function toggleStatus(id, current) {
  const newStatus = current === '済' ? '未済' : '済';
  await fetch(API + '/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  loadToday();
}

window.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('date-header');
  if (header) {
    header.addEventListener('click', () => {
      sortDescending = !sortDescending;
      loadToday();
    });
  }
  loadToday();
});
