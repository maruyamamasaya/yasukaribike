const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

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
  const items = Array.isArray(data.Items) ? data.Items : Array.isArray(data) ? data : [];
  const tbody = document.querySelector('#title-table tbody');
  tbody.innerHTML = '';
  items.forEach(m => {
    const tr = document.createElement('tr');
    const link = `mail_detail.html?id=${encodeURIComponent(m.unique_id || '')}`;
    const bodyShort = (m.body || '').split('\n')[0].slice(0, 30);
    tr.innerHTML = `
      <td><a href="${link}">${escapeHtml(m.unique_id || '')}</a></td>
      <td>${escapeHtml(m.to || '')}</td>
      <td>${escapeHtml(bodyShort)}</td>
      <td>${escapeHtml(m.date || '')}</td>`;
    tbody.appendChild(tr);
  });
  if (spinner) spinner.style.display = 'none';
}

async function fetchEmails() {
  try {
    await fetch(API + '/api/fetch-all-emails');
  } catch (err) {
    console.error(err);
  }
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
  loadTitles();
});
