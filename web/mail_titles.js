const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

let titles = [];
let sortKey = 'date';
let sortAsc = false;

async function loadTitles() {
  let res;
  let data = {};
  const spinner = document.getElementById('loading');
  if (spinner) spinner.style.display = 'block';
  try {
    res = await fetch(API + '/emails');
    data = await res.json();
  } catch (err) {
    console.error(err);
    if (spinner) spinner.style.display = 'none';
    return;
  }
  if (!res.ok) return;
  titles = Array.isArray(data.Items) ? data.Items : Array.isArray(data) ? data : [];
  renderTable();
  if (spinner) spinner.style.display = 'none';
}

async function fetchEmails() {
  try {
    await fetch(API + '/api/fetch-all-emails');
  } catch (err) {
    console.error(err);
  }
}

function formatDateJST(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
}

function renderTable() {
  const tbody = document.querySelector('#title-table tbody');
  if (!tbody) return;
  const sorted = [...titles].sort((a, b) => {
    const av = a[sortKey] || '';
    const bv = b[sortKey] || '';
    if (av === bv) return 0;
    return (av > bv ? 1 : -1) * (sortAsc ? 1 : -1);
  });
  tbody.innerHTML = '';
  sorted.forEach(m => {
    const tr = document.createElement('tr');
    const link = `mail_detail.html?id=${encodeURIComponent(m.unique_id || '')}`;
    const bodyShort = (m.body || '').split('\n')[0].slice(0, 30);
    const dateText = formatDateJST(m.date);
    tr.innerHTML = `
      <td><a href="${link}">${escapeHtml(m.unique_id || '')}</a></td>
      <td>${escapeHtml(m.from || '')}</td>
      <td>${escapeHtml(m.to || '')}</td>
      <td>${escapeHtml(bodyShort)}</td>
      <td>${escapeHtml(dateText)}</td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('th[data-key]').forEach(th => {
    const icon = th.querySelector('.sort-icon');
    if (!icon) return;
    icon.textContent = th.dataset.key === sortKey ? (sortAsc ? '▲' : '▼') : '';
  });
}

async function fetchAndLoad() {
  const spinner = document.getElementById('loading');
  if (spinner) spinner.style.display = 'block';
  await fetchEmails();
  await loadTitles();
  if (spinner) spinner.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('load-btn').addEventListener('click', fetchAndLoad);
  document.querySelectorAll('th[data-key]').forEach(th => {
    const span = document.createElement('span');
    span.className = 'sort-icon';
    th.appendChild(span);
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (sortKey === key) {
        sortAsc = !sortAsc;
      } else {
        sortKey = key;
        sortAsc = true;
      }
      renderTable();
    });
  });
  loadTitles();
});
