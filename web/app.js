// APIエンドポイント
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let currentPage = 1;
const PAGE_SIZE = 20;
let sortDescending = true;

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

function getKey(c) {
  if (c.order_id) return c.order_id.slice(0, 14);
  if (c.date) return c.date.replace(/\//g, '');
  return 0;
}

async function loadDashboard() {
  const res = await fetch(API + '/customers');
  const data = await res.json();
  const customers = (data.Items || data).filter(c => !c.draft);

  const total = customers.length;
  const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '/');
  const todayKey = today.replace(/\//g, '');
  const todayCount = customers.filter(c => {
    if (c.date) return c.date === today;
    if (c.order_id) return c.order_id.slice(0, 8) === todayKey;
    return false;
  }).length;
  const phoneToday = customers.filter(c => {
    const isToday = c.date ? c.date === today : c.order_id && c.order_id.slice(0, 8) === todayKey;
    return isToday && (c.type || c.category) === '電話';
  }).length;
  const visitToday = customers.filter(c => {
    const isToday = c.date ? c.date === today : c.order_id && c.order_id.slice(0, 8) === todayKey;
    return isToday && (c.type || c.category) === '訪問対応';
  }).length;
  const webInputToday = customers.filter(c => {
    const isToday = c.date ? c.date === today : c.order_id && c.order_id.slice(0, 8) === todayKey;
    return isToday && (c.type || c.category) === '顧客WEB入力';
  }).length;
  const unconfirmed = customers.filter(
    c => (c.status || '') !== '完了' && !isScheduled(c) && isDue(c)
  ).length;
  const scheduled = customers.filter(c => (c.status || '') !== '完了' && isScheduled(c)).length;
  const completed = customers.filter(c => (c.status || '') === '完了').length;

  document.getElementById('d-total').textContent = total;
  document.getElementById('d-today').textContent = todayCount;
  const phoneEl = document.getElementById('d-phone-today');
  if (phoneEl) phoneEl.textContent = phoneToday;
  const visitEl = document.getElementById('d-visit-today');
  if (visitEl) visitEl.textContent = visitToday;
  const webEl = document.getElementById('d-web-today');
  if (webEl) webEl.textContent = webInputToday;
  const mailAutoEl = document.getElementById('d-mail-auto');
  if (mailAutoEl) mailAutoEl.textContent = 0;
  const callLogEl = document.getElementById('d-call-log');
  if (callLogEl) callLogEl.textContent = 0;
  document.getElementById('d-unconfirmed').textContent = unconfirmed;
  const schedEl = document.getElementById('d-scheduled');
  if (schedEl) schedEl.textContent = scheduled;
  const compEl = document.getElementById('d-completed');
  if (compEl) compEl.textContent = completed;
}

async function loadCustomers(page = 1) {
  currentPage = page;
  const res = await fetch(API + '/customers');
  const data = await res.json();
  let customers = (data.Items || data)
    .filter(c => !c.draft)
    .filter(c => !isScheduled(c));

  customers = customers.filter(c => (c.status || '') !== '完了');
  customers.sort((a, b) =>
    sortDescending ? getKey(b) - getKey(a) : getKey(a) - getKey(b)
  );

  const totalPages = Math.max(1, Math.ceil(customers.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#customer-table tbody');
  tbody.innerHTML = '';

  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = customers.slice(start, start + PAGE_SIZE);
  const colspan = document.querySelector('#customer-table thead tr').children.length;
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
    let noteSnippet = '';
    if (c.history) {
      const keys = Object.keys(c.history).sort();
      const last = keys[keys.length - 1];
      if (last) noteSnippet = last;
    }

    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>
        ${c.status || ''}
        <button class="btn btn-sm btn-outline-secondary ms-2" onclick="toggleStatus('${c.order_id}', '${c.status || ''}')">
          ${statusButtonLabel(c.status || '未着手')}
        </button>
      </td>
      <td>${formatDateTime(c.order_id)}</td>
      <td style="width:40%; white-space: pre-wrap; font-size:0.85rem;">${noteSnippet}</td>
      <td>
        <a href="edit.html?id=${c.order_id}" class="btn btn-sm btn-primary">編集</a>
      </td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || customers.length === 0;
}

async function deleteCustomer(id) {
  if (!confirm('削除してよろしいですか？')) return;
  await fetch(API + '/customers/' + id, { method: 'DELETE' });
  loadCustomers();
}

async function toggleStatus(id, current) {
  const newStatus = nextStatus(current);
  await fetch(API + '/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  loadCustomers();
  loadDashboard();
}

async function loadEmailStats() {
  const el = document.getElementById('email-stats');
  if (!el) return;
  try {
    const res = await fetch(API + '/email-stats');
    const data = await res.json();
    if (!res.ok) return;
    const base = data.fetchTime || data.lastDate;
    const dateStr = base
      ? new Date(base).toLocaleString('ja-JP', {
          timeZone: 'Asia/Tokyo',
          hour12: false
        })
      : '';
    let text = `最終更新: ${dateStr} / 全件: ${data.count} (2025年6月1日から取得)`;
    if (typeof data.todayCount === 'number') {
      text += ` / 今日: ${data.todayCount}`;
    }
    el.textContent = text;
  } catch (err) {
    console.error(err);
  }
}

function nextPage() {
  loadCustomers(currentPage + 1);
}

function prevPage() {
  loadCustomers(currentPage - 1);
}

async function fetchAllEmails() {
  try {
    await fetch(API + '/api/fetch-all-emails');
    loadEmailStats();
  } catch (err) {
    console.error(err);
  }
}

// 初期表示
const dateHeader = document.getElementById('date-header');
if (dateHeader) {
  dateHeader.addEventListener('click', () => {
    sortDescending = !sortDescending;
    loadCustomers();
  });
}

loadDashboard();
loadCustomers();
loadEmailStats();

// AI要約ボタン
const summaryBtn = document.getElementById('ai-summary-btn');
if (summaryBtn) {
  summaryBtn.addEventListener('click', async () => {
    try {
      const res = await fetch(API + '/summary');
      const data = await res.json();
      alert(data.summary || data.error || 'No summary available');
    } catch (err) {
      alert('要約の取得に失敗しました');
    }
  });
}

const loadBtn = document.getElementById('load-btn');
if (loadBtn) {
  loadBtn.addEventListener('click', fetchAllEmails);
}

const callHistoryBtn = document.getElementById('call-history-btn');
if (callHistoryBtn) {
  callHistoryBtn.addEventListener('click', () => {
    alert('着信履歴の確認はダミーです');
  });
}
