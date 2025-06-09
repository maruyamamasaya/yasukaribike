// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function formatDateTime(id) {
  if (!id || id.length < 12) return '';
  const y = id.slice(0, 4);
  const m = id.slice(4, 6);
  const d = id.slice(6, 8);
  const hh = id.slice(8, 10);
  const mm = id.slice(10, 12);
  return `${y}/${m}/${d} ${hh}時${mm}分`;
}

function getKey(c) {
  if (c.order_id) return c.order_id.slice(0, 14);
  if (c.date) return c.date.replace(/\//g, '');
  return 0;
}

async function loadDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;

  const editLink = document.getElementById('edit-link');
  if (editLink) editLink.href = `edit.html?id=${encodeURIComponent(id)}`;

  try {
    const res = await fetch(API + '/customers/' + id);
    const data = await res.json();
    const item = data.Item || data;

    const tbody = document.querySelector('#detail-table tbody');
    tbody.innerHTML = '';
    const fields = [
      ['order_id', '注文ID'],
      ['date', '日付'],
      ['name', '名前（顧客名）'],
      ['status', 'ステータス'],
      ['phone', '電話番号'],
      ['email', 'メールアドレス'],
      ['type', 'お問い合わせ種別'],
      ['details', 'お問い合わせいただいてるバイク名']
    ];
    fields.forEach(([key, label]) => {
      let val = item[key];
      if (key === 'phone') val = item.phoneNumber || item.phone;
      if (val) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<th>${label}</th><td>${val}</td>`;
        tbody.appendChild(tr);
      }
    });

    // Display note history
    const hist = document.getElementById('history');
    hist.innerHTML = '';
    if (item.history) {
      hist.innerHTML = '<h4>履歴</h4>';
      const ul = document.createElement('ul');
      const entries = Object.entries(item.history).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      entries.forEach(([d, note]) => {
        const li = document.createElement('li');
        li.style.whiteSpace = 'pre-wrap';
        li.textContent = `${d}: ${note}`;
        ul.appendChild(li);
      });
      hist.appendChild(ul);
    }

    // fetch past records
    const params2 = new URLSearchParams();
    if (item.name) params2.append('name', item.name);
    if (item.phone || item.phoneNumber) params2.append('phone', item.phone || item.phoneNumber);
    if (item.email) params2.append('email', item.email);
    params2.append('id', item.order_id);
    const res2 = await fetch(API + '/customers/search?' + params2.toString());
    let list = [];
    if (res2.ok) {
      list = await res2.json();
    } else {
      console.error('Failed to fetch past records:', res2.status, res2.statusText);
    }
    const pastBody = document.querySelector('#past-table tbody');
    pastBody.innerHTML = '';
    list.sort((a, b) => getKey(a) - getKey(b));
    list.forEach(r => {
      const tr = document.createElement('tr');
      let note = '';
      if (r.history) {
        const keys = Object.keys(r.history).sort();
        const last = keys[keys.length - 1];
        if (last) note = r.history[last];
      }
      const dt = formatDateTime(r.order_id);
      const noteHtml = note.replace(/\n/g, '<br>');
      tr.innerHTML = `
        <td><a href="detail.html?id=${r.order_id}">${dt}</a></td>
        <td>${r.status || ''}</td>
        <td style="width:30%; white-space: pre-wrap;">${noteHtml}</td>`;
      pastBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

window.addEventListener('DOMContentLoaded', loadDetail);

