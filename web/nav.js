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
  if (document.referrer && document.referrer.startsWith(window.location.origin)) {
    const url = new URL(document.referrer);
    prev = decodeURIComponent(url.pathname.split('/').pop());
  }
  const current = decodeURIComponent(window.location.pathname.split('/').pop());
  el.textContent = prev ? `${prev} > ${current}` : current;
}

document.addEventListener('DOMContentLoaded', showBreadcrumb);
