function goBack(event) {
  if (event) event.preventDefault();
  if (document.referrer && document.referrer.startsWith(window.location.origin)) {
    window.history.back();
  } else {
    window.location.href = 'index.html';
  }
}

function showBreadcrumb() {
  const el = document.getElementById('breadcrumb');
  if (!el) return;
  let prev = '';
  let prevPath = '';
  if (document.referrer && document.referrer.startsWith(window.location.origin)) {
    const url = new URL(document.referrer);
    prev = decodeURIComponent(url.pathname.split('/').pop());
    prevPath = url.pathname.split('/').pop();
  }
  const current = decodeURIComponent(window.location.pathname.split('/').pop());
  if (prev) {
    el.innerHTML = `<a href="${prevPath}">${prev}</a> &gt; ${current}`;
  } else {
    el.textContent = current;
  }
}

function addTopButton() {
  if (window.location.pathname.endsWith('index.html')) return;
  const container = document.querySelector('.container');
  if (!container) return;
  const div = document.createElement('div');
  div.className = 'mb-2 text-end';
  div.innerHTML = '<a href="index.html" class="btn btn-outline-primary">TOPに戻る</a>';
  container.prepend(div);
}

document.addEventListener('DOMContentLoaded', () => {
  showBreadcrumb();
  addTopButton();
});

function nextStatus(status) {
  if (status === '未着手') return '進行中';
  if (status === '進行中') return '完了';
  return '未着手';
}

function statusButtonLabel(status) {
  if (status === '未着手') return 'タスクを進行中にする';
  if (status === '進行中') return 'タスクを完了にする';
  return 'タスクを未着手に戻す';
}

function statusBadge(status) {
  let color = 'secondary';
  if (status === '進行中') color = 'warning';
  else if (status === '完了') color = 'success';
  return `<span class="badge bg-${color}">${status}</span>`;
}
