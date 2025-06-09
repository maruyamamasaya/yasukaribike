// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function formatDateTime(id) {
  if (!id || id.length < 14) return '';
  const y = id.slice(0, 4);
  const m = id.slice(4, 6);
  const d = id.slice(6, 8);
  const hh = id.slice(8, 10);
  const mm = id.slice(10, 12);
  const ss = id.slice(12, 14);
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}

async function loadDetail() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  if (!id) return;

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
      for (const [d, note] of Object.entries(item.history)) {
        const li = document.createElement('li');
        li.textContent = `${d}: ${note}`;
        ul.appendChild(li);
      }
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
    list.forEach(r => {
      const tr = document.createElement('tr');
      let note = '';
      if (r.history) {
        const keys = Object.keys(r.history).sort();
        const last = keys[keys.length - 1];
        if (last) note = r.history[last];
      }
      const dt = formatDateTime(r.order_id);
      tr.innerHTML = `
        <td><a href="detail.html?id=${r.order_id}">${dt}</a></td>
        <td>${r.status || ''}</td>
        <td>${note}</td>`;
      pastBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

window.addEventListener('DOMContentLoaded', loadDetail);

