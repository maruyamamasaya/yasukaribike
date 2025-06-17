const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let sortDescending = true;
let currentPage = 1;
const PAGE_SIZE = 20;
let allEmails = [];
let currentPageItems = [];
let dateCounts = {};
let dateFilter = '';

function getCategory() {
  const params = new URLSearchParams(window.location.search);
  return params.get('cat');
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

function getKey(item) {
  return item.createdAt || '';
}

function getTimeValue(item) {
  const key = item.date || item.createdAt;
  return key ? new Date(key).getTime() : 0;
}

function hasText(item, keyword) {
  return (item.body || '').includes(keyword);
}

function formatDateJST(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `<span class="date-part">${y}/${m}/${day}</span><br><span class="time-part">${hh}時${mm}分</span>`;
}

function formatYMD(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

function buildDateCounts(items) {
  dateCounts = {};
  items.forEach(i => {
    const key = formatYMD(i.date || i.createdAt);
    if (key) {
      dateCounts[key] = (dateCounts[key] || 0) + 1;
    }
  });
}

function renderDateButtons() {
  const container = document.getElementById('date-buttons');
  if (!container) return;
  container.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'btn btn-outline-secondary btn-sm me-1';
  if (!dateFilter) allBtn.classList.add('active');
  allBtn.textContent = 'すべて';
  allBtn.addEventListener('click', () => {
    dateFilter = '';
    renderDateButtons();
    loadEmails(1);
  });
  container.appendChild(allBtn);
  Object.keys(dateCounts)
    .sort((a, b) => (sortDescending ? b.localeCompare(a) : a.localeCompare(b)))
    .forEach(d => {
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline-secondary btn-sm me-1';
      if (dateFilter === d) btn.classList.add('active');
      btn.textContent = `${d} (${dateCounts[d]})`;
      btn.addEventListener('click', () => {
        dateFilter = d;
        renderDateButtons();
        loadEmails(1);
      });
      container.appendChild(btn);
    });
}

async function fetchData() {
  let res;
  let data = {};
  try {
    res = await fetch(API + '/emails');
    data = await res.json();
  } catch (err) {
    console.error(err);
    return [];
  }
  if (!res.ok) return [];
  const items = Array.isArray(data.Items) ? data.Items : Array.isArray(data) ? data : [];
  return items;
}

async function loadEmails(page = 1, refresh = false) {
  currentPage = page;
  const spinner = document.getElementById('loading');
  if (refresh || allEmails.length === 0) {
    if (spinner) spinner.style.display = 'block';
    allEmails = await fetchData();
    if (spinner) spinner.style.display = 'none';
    buildDateCounts(allEmails);
    renderDateButtons();
  } else if (spinner) {
    spinner.style.display = 'none';
  }
  let items = [...allEmails];
  const cat = getCategory();
  if (cat) items = items.filter(i => i.category === cat);

  const qEl = document.getElementById('quick-search');
  const tEl = document.getElementById('text-search');
  const keyword = qEl ? qEl.value.trim() : '';
  const textKey = tEl ? tEl.value.trim() : '';
  if (keyword) {
    items = items.filter(i =>
      (i.from || '').includes(keyword) ||
      (i.to || '').includes(keyword) ||
      (i.subject || '').includes(keyword)
    );
  }
  if (textKey) {
    items = items.filter(i => hasText(i, textKey));
  }

  // rebuild date counts based on current filters (without dateFilter)
  buildDateCounts(items);
  renderDateButtons();

  if (dateFilter) {
    items = items.filter(i => formatYMD(i.date || i.createdAt) === dateFilter);
  }

  items.sort((a, b) =>
    sortDescending ? getTimeValue(b) - getTimeValue(a) : getTimeValue(a) - getTimeValue(b)
  );

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#mail-table tbody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = items.slice(start, start + PAGE_SIZE);
  currentPageItems = slice;

  slice.forEach(item => {
    const tr = document.createElement('tr');
    let bodySnippet = item.body || '';
    if (bodySnippet.length > 200) bodySnippet = bodySnippet.slice(0, 200) + '…';
    const link = `mail_detail.html?id=${encodeURIComponent(item.unique_id || '')}`;
    const dateText = formatDateJST(item.date || item.createdAt);
    const btnLabel = item.task_added ? '追加済み' : 'タスクに追加';
    tr.innerHTML = `
      <td><a href="${link}">${dateText}</a></td>
      <td>${escapeHtml(item.from || '')}</td>
      <td>${escapeHtml(item.subject || '')}</td>
      <td style="white-space:pre-wrap; width:40%;">${escapeHtml(bodySnippet)}</td>
      <td><button class="btn btn-sm btn-primary" onclick="addTask('${item.unique_id}')" data-added="${item.task_added ? '1' : '0'}">${btnLabel}</button></td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || items.length === 0;
}

function nextPage() {
  loadEmails(currentPage + 1);
}

function prevPage() {
  loadEmails(currentPage - 1);
}

async function addTask(id) {
  if (!id) return;
  const item = allEmails.find(e => e.unique_id === id);
  if (item && item.task_added) {
    const ok = confirm('再度追加しますか？\n前回追加済みの場合は、タスクが重複する恐れがあります。');
    if (!ok) return;
  }
  const res = await fetch(API + `/emails/${encodeURIComponent(id)}/add-task`, {
    method: 'POST'
  });
  if (res.ok) {
    loadEmails(currentPage, true);
  } else {
    alert('タスク追加に失敗しました');
  }
}

async function addAllTasks() {
  if (!currentPageItems.length) return;
  const already = currentPageItems.filter(i => i.task_added).length;
  let msg = '表示中のメールを一括でタスク追加しますか？';
  if (already > 0) msg += `\n${already}件は追加済みです。再度追加するとタスクが重複する恐れがあります。`;
  if (!confirm(msg)) return;
  for (const item of currentPageItems) {
    await fetch(API + `/emails/${encodeURIComponent(item.unique_id)}/add-task`, {
      method: 'POST'
    });
  }
  loadEmails(currentPage, true);
}

window.addEventListener('DOMContentLoaded', () => {
  const descBtn = document.getElementById('sort-desc');
  const ascBtn = document.getElementById('sort-asc');
  if (descBtn) descBtn.addEventListener('click', () => { sortDescending = true; loadEmails(); });
  if (ascBtn) ascBtn.addEventListener('click', () => { sortDescending = false; loadEmails(); });
  const bulkBtn = document.getElementById('bulk-add-btn');
  if (bulkBtn) bulkBtn.addEventListener('click', addAllTasks);
  const qEl = document.getElementById('quick-search');
  const tEl = document.getElementById('text-search');
  if (qEl) qEl.addEventListener('input', () => loadEmails(1));
  if (tEl) tEl.addEventListener('input', () => loadEmails(1));
  loadEmails(1, true);
});
