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

document.addEventListener('DOMContentLoaded', showBreadcrumb);

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
