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
  let prevPath = '';
  if (document.referrer && document.referrer.startsWith(window.location.origin)) {
    const url = new URL(document.referrer);
    prevPath = decodeURIComponent(url.pathname.split('/').pop());
  }
  const currPath = decodeURIComponent(window.location.pathname.split('/').pop());

  let html = '';
  if (prevPath) {
    html += `<a href="${prevPath}">${prevPath}</a> &gt; `;
  }
  html += `<a href="${currPath}">${currPath}</a>`;
  el.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', showBreadcrumb);
