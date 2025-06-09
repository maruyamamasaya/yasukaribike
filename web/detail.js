// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

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
    for (const [key, val] of Object.entries(item)) {
      if (key === 'history') continue;
      const tr = document.createElement('tr');
      tr.innerHTML = `<th>${key}</th><td>${val ?? ''}</td>`;
      tbody.appendChild(tr);
    }

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
    const list = await res2.json();
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
      tr.innerHTML = `<td>${r.date || ''}</td><td>${r.status || ''}</td><td>${note}</td>`;
      pastBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

window.addEventListener('DOMContentLoaded', loadDetail);

