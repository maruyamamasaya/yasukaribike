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
