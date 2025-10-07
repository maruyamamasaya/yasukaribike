// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

const CUSTOMER_STATUS_OPTIONS = [
  '',
  'お問い合わせ・来店',
  '購入希望・見積り',
  '保証プラン・規約提示',
  '振込案内',
  '契約書送付フェーズ'
];

let currentId = null;

function formatDateTime(id) {
  if (!id || id.length < 12) return '';
  const y = id.slice(0, 4);
  const m = id.slice(4, 6);
  const d = id.slice(6, 8);
  const hh = id.slice(8, 10);
  const mm = id.slice(10, 12);
  return `<span class="date-part">${y}/${m}/${d}</span><br><span class="time-part">${hh}時${mm}分</span>`;
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
  currentId = id;

  const editLink = document.getElementById('edit-link');
  if (editLink) editLink.href = `edit.html?id=${encodeURIComponent(id)}`;
  const pdfLink = document.getElementById('pdf-link');
  if (pdfLink) pdfLink.href = `order_pdf.html?id=${encodeURIComponent(id)}`;

  try {
    const res = await fetch(API + '/customers/' + id);
    const data = await res.json();
    const item = data.Item || data;

    const tbody = document.querySelector('#detail-table tbody');
    tbody.innerHTML = '';
    const fields = [
      ['order_id', '管理ID'],
      ['name', '名前（顧客名）'],
      ['kana', 'カナ'],
      ['status', 'ステータス'],
      ['staff', '担当者名'],
      ['phone', '電話番号'],
      ['email', 'メールアドレス'],
      ['type', 'お問い合わせ種別'],
      ['details', 'バイク名など']
    ];
    fields.forEach(([key, label]) => {
      let val = item[key];
      if (key === 'phone') val = item.phoneNumber || item.phone;
      if (val) {
        const tr = document.createElement('tr');
        if (key === 'status') {
          const btnLabel = statusButtonLabel(val || '未着手');
          tr.innerHTML = `<th>${label}</th><td>${val} <button class="btn btn-sm btn-outline-secondary ms-2" onclick="toggleStatus('${item.order_id}', '${val}')">${btnLabel}</button></td>`;
        } else {
          tr.innerHTML = `<th>${label}</th><td>${val}</td>`;
        }
        tbody.appendChild(tr);
      }
    });

    const customerStatusTr = document.createElement('tr');
    const customerStatusLabel = document.createElement('th');
    customerStatusLabel.textContent = '顧客ステータス';
    const customerStatusTd = document.createElement('td');
    const customerStatusSelect = document.createElement('select');
    customerStatusSelect.className = 'form-select';
    CUSTOMER_STATUS_OPTIONS.forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status || '未選択';
      customerStatusSelect.appendChild(option);
    });
    const currentStatus = item.customerStatus && CUSTOMER_STATUS_OPTIONS.includes(item.customerStatus)
      ? item.customerStatus
      : '';
    customerStatusSelect.value = currentStatus;
    customerStatusSelect.addEventListener('change', async e => {
      customerStatusSelect.disabled = true;
      try {
        await updateCustomerStatus(item.order_id, e.target.value);
      } finally {
        customerStatusSelect.disabled = false;
      }
    });
    customerStatusTd.appendChild(customerStatusSelect);
    customerStatusTr.appendChild(customerStatusLabel);
    customerStatusTr.appendChild(customerStatusTd);
    tbody.appendChild(customerStatusTr);

    const schedTr = document.createElement('tr');
    const schedVal = item.scheduledDate || '特になし';
    schedTr.innerHTML = `<th>タスク先送り状況</th><td>${schedVal} <button class="btn btn-sm btn-outline-warning ms-2" onclick="showScheduleInput()">先送り設定</button> <input id="schedule-input" type="date" class="form-control mt-2" style="display:none; width:auto;" /></td>`;
    tbody.appendChild(schedTr);
    const schedInput = document.getElementById('schedule-input');
    if (schedInput) {
      schedInput.value = item.scheduledDate || '';
      schedInput.addEventListener('change', async e => {
        const date = e.target.value;
        await fetch(API + '/customers/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scheduledDate: date })
        });
        loadDetail();
      });
    }

    // Display note history
    const hist = document.getElementById('history');
    hist.innerHTML = '';
    if (item.history) {
      hist.innerHTML = '<h4>メモ</h4>';
      const entries = Object.entries(item.history).sort(([a], [b]) =>
        a.localeCompare(b)
      );
      if (entries.length) {
        const [latestDate, latestNote] = entries[entries.length - 1];
        const latestDiv = document.createElement('div');
        latestDiv.className = 'mb-2';
        latestDiv.innerHTML = `<div class="fw-bold">${latestDate}</div>`;
        const p = document.createElement('p');
        p.style.whiteSpace = 'pre-wrap';
        p.textContent = latestNote;
        latestDiv.appendChild(p);
        hist.appendChild(latestDiv);

        if (entries.length > 1) {
          const histHeader = document.createElement('h5');
          histHeader.textContent = '編集履歴';
          hist.appendChild(histHeader);
        }

        for (let i = entries.length - 2; i >= 0; i--) {
          const [d, note] = entries[i];
          const div = document.createElement('div');
          div.className = 'mb-2';
          const label = document.createElement('span');
          label.textContent = d;
          const btn = document.createElement('button');
          btn.className = 'btn btn-sm btn-outline-secondary ms-2';
          btn.textContent = '表示';
          const noteEl = document.createElement('p');
          noteEl.style.whiteSpace = 'pre-wrap';
          noteEl.style.display = 'none';
          noteEl.className = 'mt-2';
          noteEl.textContent = note;
          btn.addEventListener('click', () => {
            const hidden = noteEl.style.display === 'none';
            noteEl.style.display = hidden ? 'block' : 'none';
            btn.textContent = hidden ? '非表示' : '表示';
          });
          div.appendChild(label);
          div.appendChild(btn);
          div.appendChild(noteEl);
          hist.appendChild(div);
        }
      }
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
      let truncated = note;
      let ellipsis = '';
      if (note.length > 500) {
        truncated = note.slice(0, 500);
        ellipsis = '...';
      }
      const noteHtml = (truncated + ellipsis).replace(/\n/g, '<br>');
      const btnLabel = statusButtonLabel(r.status || '未着手');
      tr.innerHTML = `
        <td><a href="detail.html?id=${r.order_id}">${dt}</a></td>
        <td>
          ${r.status || ''}
          <button class="btn btn-sm btn-outline-secondary ms-2" onclick="toggleStatus('${r.order_id}', '${r.status || ''}')">${btnLabel}</button>
        </td>
        <td style="width:50%; white-space: pre-wrap;">${noteHtml}</td>`;
      pastBody.appendChild(tr);
    });
  } catch (e) {
    console.error(e);
  }
}

async function toggleStatus(id, current) {
  const newStatus = nextStatus(current);
  await fetch(API + '/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: newStatus })
  });
  loadDetail();
}

async function updateCustomerStatus(id, customerStatus) {
  await fetch(API + '/customers/' + id, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ customerStatus: customerStatus || '' })
  });
  loadDetail();
}

function showScheduleInput() {
  const input = document.getElementById('schedule-input');
  if (input) {
    input.style.display = 'block';
    if (input.showPicker) input.showPicker();
  }
}

window.addEventListener('DOMContentLoaded', loadDetail);

