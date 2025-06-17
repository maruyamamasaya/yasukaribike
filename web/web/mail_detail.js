const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function escapeHtml(text) {
  return String(text).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function loadMailDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;
  let res;
  try {
    res = await fetch(API + '/emails/' + encodeURIComponent(id));
  } catch (err) {
    console.error(err);
    return;
  }
  if (!res.ok) return;
  const item = await res.json();
  const tbody = document.querySelector('#mail-detail-table tbody');
  if (!tbody) return;
  tbody.innerHTML = '';
  const fields = [
    ['unique_id', 'UID'],
    ['from', '送信元'],
    ['to', '宛先'],
    ['date', '受信日時'],
    ['body', '本文']
  ];
  fields.forEach(([key, label]) => {
    if (!item[key]) return;
    const tr = document.createElement('tr');
    let val = String(item[key]);
    if (key === 'date') {
      val = new Date(val).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', hour12: false });
    } else if (key === 'body') {
      val = val.replace(/<br\s*\/?>/gi, '\n');
    }
    tr.innerHTML = `<th>${label}</th><td style="white-space:pre-wrap;"></td>`;
    tr.querySelector('td').textContent = val;
    tbody.appendChild(tr);
  });
}

window.addEventListener('DOMContentLoaded', loadMailDetail);
