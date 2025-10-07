const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

const ORDER_FIELDS = [
  { label: '管理ID', getValue: item => item.order_id || '' },
  { label: '顧客名', getValue: item => item.name || '' },
  { label: 'カナ', getValue: item => item.kana || '' },
  { label: '顧客ステータス', getValue: item => item.customerStatus || '未選択' },
  { label: '担当者', getValue: item => item.staff || '' },
  { label: '電話番号', getValue: item => item.phoneNumber || item.phone || '' },
  { label: 'メールアドレス', getValue: item => item.email || '' },
  { label: 'お問い合わせ種別', getValue: item => item.category || item.type || '' },
  { label: 'バイク名など', getValue: item => item.details || '', multiline: true }
];

function createEditableRow(label, value, multiline = false) {
  const tr = document.createElement('tr');
  const th = document.createElement('th');
  th.style.width = '25%';
  th.textContent = label;

  const td = document.createElement('td');
  const input = multiline ? document.createElement('textarea') : document.createElement('input');
  if (!multiline) {
    input.type = 'text';
    input.className = 'form-control editable-input';
  } else {
    input.rows = 3;
    input.className = 'form-control editable-textarea';
  }
  input.value = value;

  const display = document.createElement('div');
  display.className = 'editable-display';

  const updateDisplay = () => {
    display.textContent = input.value || '';
  };
  input.addEventListener('input', updateDisplay);
  updateDisplay();

  td.appendChild(input);
  td.appendChild(display);

  tr.appendChild(th);
  tr.appendChild(td);
  return tr;
}

function createEditableHistory(item) {
  const wrapper = document.createElement('div');
  wrapper.className = 'mt-4';

  const title = document.createElement('h5');
  title.className = 'mb-2';

  let latestDate = '';
  let latestNote = '';

  if (item.history) {
    const entries = Object.entries(item.history).sort(([a], [b]) => a.localeCompare(b));
    if (entries.length) {
      const latest = entries[entries.length - 1];
      latestDate = latest[0];
      latestNote = latest[1] || '';
    }
  }

  title.textContent = latestDate ? `最新メモ (${latestDate})` : '最新メモ';
  wrapper.appendChild(title);

  const textarea = document.createElement('textarea');
  textarea.className = 'form-control editable-textarea';
  textarea.rows = 6;
  textarea.value = latestNote;

  const display = document.createElement('div');
  display.className = 'editable-display';

  const updateDisplay = () => {
    const text = textarea.value || '';
    display.textContent = text;
  };
  textarea.addEventListener('input', updateDisplay);
  updateDisplay();

  if (!latestNote) {
    textarea.placeholder = 'メモを入力してください';
  }

  wrapper.appendChild(textarea);
  wrapper.appendChild(display);

  return wrapper;
}

async function loadOrder() {
  const params = new URLSearchParams(location.search);
  const id = params.get('id');
  const container = document.getElementById('order-content');
  const backLink = document.getElementById('back-link');
  if (backLink && id) {
    backLink.href = `detail.html?id=${encodeURIComponent(id)}`;
  }
  if (!id) {
    if (container) {
      container.innerHTML = '<p class="text-danger">顧客IDが指定されていません。</p>';
    }
    return;
  }

  try {
    const res = await fetch(API + '/customers/' + id);
    if (!res.ok) throw new Error('Failed to fetch customer');
    const data = await res.json();
    const item = data.Item || data;
    if (!container) return;
    container.innerHTML = '';

    const header = document.createElement('div');
    header.className = 'mb-4';

    const title = document.createElement('h2');
    title.className = 'text-center';
    title.textContent = '注文書（仮）';

    const subtitle = document.createElement('p');
    subtitle.className = 'text-center text-muted';
    subtitle.textContent = '※ このレイアウトは今後調整可能です。';

    header.appendChild(title);
    header.appendChild(subtitle);
    container.appendChild(header);

    const table = document.createElement('table');
    table.className = 'table table-bordered';
    const tbody = document.createElement('tbody');

    ORDER_FIELDS.forEach(field => {
      const value = field.getValue(item);
      const row = createEditableRow(field.label, value, Boolean(field.multiline));
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);

    const historyBlock = createEditableHistory(item);
    container.appendChild(historyBlock);
  } catch (error) {
    if (container) {
      container.innerHTML = `<p class="text-danger">顧客情報を取得できませんでした: ${error.message}</p>`;
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const printButton = document.getElementById('print-button');
  if (printButton) {
    printButton.addEventListener('click', () => window.print());
  }
  loadOrder();
});
