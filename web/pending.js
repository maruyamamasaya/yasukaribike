const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let sortDescending = true;
let currentPage = 1;
const PAGE_SIZE = 20;

function isScheduled(c) {
  if (!c.scheduledDate) return false;
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  return c.scheduledDate > today;
}

function isDue(c) {
  const todayKey = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const key = c.date
    ? c.date.replace(/\//g, '')
    : c.order_id
    ? c.order_id.slice(0, 8)
    : '';
  return key && key <= todayKey;
}

function getKey(c) {
  if (c.order_id) return c.order_id.slice(0, 14);
  if (c.date) return c.date.replace(/\//g, '');
  return 0;
}

function hasText(customer, keyword) {
  if ((customer.details || '').includes(keyword)) return true;
  if (customer.history) {
    for (const note of Object.values(customer.history)) {
      if (typeof note === 'string' && note.includes(keyword)) return true;
    }
  }
  return false;
}

function formatDateTime(id) {
  if (!id || id.length < 12) return '';
  const y = id.slice(0, 4);
  const m = id.slice(4, 6);
  const d = id.slice(6, 8);
  const hh = id.slice(8, 10);
  const mm = id.slice(10, 12);
  return `<span class="date-part">${y}/${m}/${d}</span><br><span class="time-part">${hh}時${mm}分</span>`;
}

function getDateStr(item) {
  let key = '';
  if (item.order_id) key = item.order_id.slice(0, 8);
  else if (item.date) key = item.date.replace(/\//g, '').slice(0, 8);
  if (!key) return '';
  return `${key.slice(0, 4)}/${key.slice(4, 6)}/${key.slice(6, 8)}`;
}

async function loadPending(page = 1) {
  currentPage = page;
  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = (data.Items || data)
    .filter(c => !c.draft)
    .filter(c => (c.status || '') !== '完了')
    .filter(c => !isScheduled(c))
    .filter(c => isDue(c));
  const qEl = document.getElementById('quick-search');
  const tEl = document.getElementById('text-search');
  const keyword = qEl ? qEl.value.trim() : '';
  const textKey = tEl ? tEl.value.trim() : '';
  if (keyword) {
    customers = customers.filter(c =>
      (c.name || '').includes(keyword) ||
      (c.phoneNumber || c.phone || '').includes(keyword) ||
      (c.email || '').includes(keyword)
    );
  }
  if (textKey) {
    customers = customers.filter(c => hasText(c, textKey));
  }
  customers.sort((a, b) =>
    sortDescending ? getKey(b) - getKey(a) : getKey(a) - getKey(b)
  );

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#pending-table tbody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = customers.slice(start, start + PAGE_SIZE);
  const colspan = document.querySelector('#pending-table thead tr').children.length;
  let lastDate = '';

  slice.forEach(c => {
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
    tr.classList.add('link-row');
    tr.addEventListener('click', () => {
      window.location.href = `detail.html?id=${c.order_id}`;
    });

    let noteSnippet = '';
    if (c.history) {
      const keys = Object.keys(c.history).sort();
      const last = keys[keys.length - 1];
      if (last) noteSnippet = c.history[last] || '';
    }

    if (noteSnippet.length > 50) noteSnippet = noteSnippet.slice(0, 50) + '…';
    noteSnippet = noteSnippet.replace(/\n/g, '<br>');

    const btnLabel = statusButtonLabel(c.status || '未着手');
    tr.innerHTML = `
      <td>${c.name || ''}</td>
      <td>${formatDateTime(c.order_id)}</td>
      <td>
        ${c.status || ''}
        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="event.stopPropagation(); toggleStatus('${c.order_id}', '${c.status || ''}')">${btnLabel}</button>
      </td>
      <td style="width:40%; white-space: pre-wrap; font-size:0.85rem;">${noteSnippet}</td>
      <td><a href="edit.html?id=${c.order_id}" class="btn btn-sm btn-primary" onclick="event.stopPropagation();">編集</a></td>
    `;

    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || customers.length === 0;
}

function nextPage() {
  loadPending(currentPage + 1);
}

function prevPage() {
  loadPending(currentPage - 1);
}

async function toggleStatus(id, current) {
  const newStatus = nextStatus(current);
  await fetch(API + '/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  loadPending();
}

window.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('date-header');
  if (header) {
    header.addEventListener('click', () => {
      sortDescending = !sortDescending;
      loadPending();
    });
  }
  const qEl = document.getElementById('quick-search');
  const tEl = document.getElementById('text-search');
  if (qEl) qEl.addEventListener('input', () => loadPending(1));
  if (tEl) tEl.addEventListener('input', () => loadPending(1));
  loadPending();
});
