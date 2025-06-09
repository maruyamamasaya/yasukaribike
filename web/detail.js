const API = 'https://example.com/api';

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
  } catch (e) {
    console.error(e);
  }
}

window.addEventListener('DOMContentLoaded', loadDetail);
