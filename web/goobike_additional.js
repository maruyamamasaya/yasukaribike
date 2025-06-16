const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return text.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function loadEmails() {
  const res = await fetch(API + '/goobike-emails');
  const data = await res.json();
  const items = data.Items || data;
  const tbody = document.querySelector('#goobike-table tbody');
  tbody.innerHTML = '';
  items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.inquiry_id}</td>
      <td>${escapeHtml(item.name || '')}</td>
      <td>${escapeHtml(item.email || '')}</td>
      <td>${escapeHtml(item.phone || '')}</td>
      <td style="white-space:pre-wrap;">${escapeHtml(item.body || '')}</td>
      <td>${item.createdAt || ''}</td>`;
    tbody.appendChild(tr);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fetch-btn').addEventListener('click', async () => {
    const btn = document.getElementById('fetch-btn');
    btn.disabled = true;
    try {
      await fetch(API + '/api/fetch-email');
    } catch (err) {
      console.error(err);
    }
    await loadEmails();
    btn.disabled = false;
  });
  loadEmails();
});
