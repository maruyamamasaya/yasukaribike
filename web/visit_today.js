const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let sortDescending = true;
let currentPage = 1;
const PAGE_SIZE = 20;

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

async function loadVisitToday(page = 1) {
  currentPage = page;
  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = (data.Items || data).filter(c => !c.draft);
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0]
    .replace(/-/g, '/');
  const todayKey = today.replace(/\//g, '');
  customers = customers.filter(c => {
    const isToday = c.date ? c.date === today : c.order_id && c.order_id.slice(0, 8) === todayKey;
    return isToday && (c.type || c.category) === '訪問対応';
  });
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

  const tbody = document.querySelector('#visit-table tbody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = customers.slice(start, start + PAGE_SIZE);
  const colspan = document.querySelector('#visit-table thead tr').children.length;
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
      <td style="width:40%; white-space: pre-wrap; font-size:0.85rem;">${snippet}</td>`;
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
  loadVisitToday(currentPage + 1);
}

function prevPage() {
  loadVisitToday(currentPage - 1);
}

async function toggleStatus(id, current) {
  const newStatus = current === '済' ? '未済' : '済';
  await fetch(API + '/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  loadVisitToday();
}

window.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('date-header');
  if (header) {
    header.addEventListener('click', () => {
      sortDescending = !sortDescending;
      loadVisitToday();
    });
  }
  const qEl = document.getElementById('quick-search');
  const tEl = document.getElementById('text-search');
  if (qEl) qEl.addEventListener('input', () => loadVisitToday(1));
  if (tEl) tEl.addEventListener('input', () => loadVisitToday(1));
  loadVisitToday();
});
