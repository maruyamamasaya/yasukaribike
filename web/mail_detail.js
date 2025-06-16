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
    res = await fetch(API + '/goobike-emails/' + encodeURIComponent(id));
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
    ['inquiry_id', '問い合わせ番号'],
    ['name', '名前'],
    ['email', 'メールアドレス'],
    ['from_email', '送信元'],
    ['inquiry_method', '問合せ方法'],
    ['inquiry_content', '問合せ内容'],
    ['request_car', '依頼車種'],
    ['status', 'ステータス'],
    ['createdAt', '受信日時'],
    ['updatedAt', '更新日時'],
    ['subject', 'タイトル'],
    ['body', '本文']
  ];
  fields.forEach(([key, label]) => {
    if (!item[key]) return;
    const tr = document.createElement('tr');
    const val = String(item[key]).replace(/\n/g, '<br>');
    tr.innerHTML = `<th>${label}</th><td style="white-space:pre-wrap;">${escapeHtml(val)}</td>`;
    tbody.appendChild(tr);
  });
}

window.addEventListener('DOMContentLoaded', loadMailDetail);
