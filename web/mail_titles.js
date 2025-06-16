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
    res = await fetch(API + '/goobike-emails');
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
    const link = `mail_detail.html?id=${encodeURIComponent(m.inquiry_id || '')}`;
    tr.innerHTML = `
      <td><a href="${link}">${escapeHtml(m.inquiry_id || '')}</a></td>
      <td>${escapeHtml(m.name || '')}</td>
      <td>${escapeHtml(m.email || '')}</td>
      <td>${escapeHtml(m.subject || '')}</td>
      <td>${escapeHtml(m.createdAt || '')}</td>`;
    tbody.appendChild(tr);
  });
  if (spinner) spinner.style.display = 'none';
}

async function fetchEmails() {
  const endpoints = [
    '/api/fetch-email',
    '/api/fetch-skip-email',
    '/api/fetch-answer-request-email',
    '/api/fetch-reserve-email'
  ];
  for (const ep of endpoints) {
    try {
      await fetch(API + ep);
    } catch (err) {
      console.error(err);
    }
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
