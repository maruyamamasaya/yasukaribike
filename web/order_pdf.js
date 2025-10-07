const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

function sanitize(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildTableRows(item) {
  const rows = [
    ['管理ID', sanitize(item.order_id)],
    ['顧客名', sanitize(item.name)],
    ['カナ', sanitize(item.kana)],
    ['顧客ステータス', sanitize(item.customerStatus) || '未選択'],
    ['担当者', sanitize(item.staff)],
    ['電話番号', sanitize(item.phoneNumber || item.phone)],
    ['メールアドレス', sanitize(item.email)],
    ['お問い合わせ種別', sanitize(item.category || item.type)],
    ['バイク名など', sanitize(item.details)]
  ];
  return rows
    .map(([label, value]) => `<tr><th style="width:25%;">${label}</th><td>${value || '&nbsp;'}</td></tr>`)
    .join('');
}

function buildHistory(item) {
  if (!item.history) return '';
  const entries = Object.entries(item.history).sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) return '';
  const latest = entries[entries.length - 1];
  const sanitized = sanitize(latest[1] || '');
  const formattedNote = sanitized ? sanitized.replace(/\n/g, '<br>') : '';
  return `
    <div class="mt-4">
      <h5 class="mb-2">最新メモ (${latest[0]})</h5>
      <div class="border rounded p-3" style="min-height:120px;">
        ${formattedNote || '<span class="text-muted">メモはありません</span>'}
      </div>
    </div>
  `;
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
    const rowsHtml = buildTableRows(item);
    const historyHtml = buildHistory(item);
    container.innerHTML = `
      <div class="mb-4">
        <h2 class="text-center">注文書（仮）</h2>
        <p class="text-center text-muted">※ このレイアウトは今後調整可能です。</p>
      </div>
      <table class="table table-bordered">
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      ${historyHtml}
    `;
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
