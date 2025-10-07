// Express サーバーを利用する場合はローカルの URL を指定する
// API は環境変数(API_URL)または現在のオリジンを利用する
const API = (typeof window !== 'undefined' && window.API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.API_URL) ||
  window.location.origin;

let currentPage = 1;
const PAGE_SIZE = 20;
let searchResults = [];
let searchTimeout;
let globalKey = '';

const FILTER_IDS = [
  's-date', 's-name', 's-phone', 's-email', 's-status', 's-category', 's-details', 's-text'
];
let notifyFilterChange = () => {};
let filtersExpanded = false;

function hasActiveFilters() {
  return FILTER_IDS.some(id => {
    const el = document.getElementById(id);
    if (!el) return false;
    return Boolean(el.value && el.value.trim());
  });
}

let customerCache = [];
let customerCacheLoaded = false;
let customerFetchPromise = null;

function escapeHTML(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function trimText(str, limit = 40) {
  if (!str) return '';
  const text = String(str);
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}

function updateTypingState() {
  const hasKeyword = Boolean(globalKey);
  document.body.classList.toggle('typing', hasKeyword);
  if (!hasKeyword) {
    const ghost = document.getElementById('ghost-suggestions');
    if (ghost) {
      ghost.innerHTML = '';
      ghost.classList.remove('is-visible', 'is-pending');
    }
  }
}

function renderGhostSuggestions(isPending = false) {
  const ghost = document.getElementById('ghost-suggestions');
  if (!ghost) return;
  if (!globalKey) {
    ghost.innerHTML = '';
    ghost.classList.remove('is-visible', 'is-pending');
    return;
  }

  const suggestions = new Set();
  searchResults.slice(0, 5).forEach(c => {
    if (c.name) suggestions.add(trimText(c.name, 24));
    if (c.details) suggestions.add(trimText(c.details, 24));
  });

  const values = [...suggestions].filter(Boolean).slice(0, 3);
  if (values.length) {
    ghost.innerHTML = values.map(v => `<span>${escapeHTML(v)}</span>`).join('');
    ghost.classList.add('is-visible');
    ghost.classList.remove('is-pending');
  } else {
    ghost.innerHTML = `<span>${isPending ? '候補を探索中...' : '該当する候補が見つかりません'}</span>`;
    ghost.classList.add('is-visible', 'is-pending');
  }
}

function renderSuggestionPanel() {
  const panel = document.getElementById('suggestion-panel');
  if (!panel) return;

  const customerCountEl = document.getElementById('suggest-customer-count');
  const highlightList = document.getElementById('suggest-highlight-list');
  if (customerCountEl) customerCountEl.textContent = `${searchResults.length.toLocaleString('ja-JP')}件`;

  if (highlightList) {
    const highlights = searchResults.slice(0, 5).map(item => {
      const metaParts = [];
      if (item.category || item.type) metaParts.push(item.category || item.type);
      if (item.details) metaParts.push(item.details);
      if (item.status) metaParts.push(`状態: ${item.status}`);
      return {
        title: item.name || '（名称未設定）',
        meta: trimText(metaParts.join('・'), 52) || '詳細メモなし'
      };
    });

    if (highlights.length) {
      highlightList.innerHTML = highlights.map(h => `
        <li class="highlight-item">
          <span class="highlight-type">問い合わせ</span>
          <div class="highlight-main">
            <p class="highlight-title">${escapeHTML(trimText(h.title, 36))}</p>
            <p class="highlight-meta">${escapeHTML(trimText(h.meta, 48))}</p>
          </div>
        </li>`).join('');
    } else {
      highlightList.innerHTML = '<li class="highlight-empty">該当する候補が見つかりません</li>';
    }
  }

  const hasKeyword = Boolean(globalKey);
  panel.classList.toggle('is-active', hasKeyword);
  panel.classList.toggle('has-results', hasKeyword && searchResults.length > 0);
}

function updateFilterState(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const details = input.closest('details');
  if (!details) return;
  const summary = details.querySelector('summary');
  const clear = details.querySelector('.clear-filter');
  const val = input.value.trim();
  if (val) {
    summary.classList.add('active', 'btn-primary');
    summary.classList.remove('btn-outline-secondary');
    if (clear) clear.style.display = '';
  } else {
    summary.classList.remove('active', 'btn-primary');
    summary.classList.add('btn-outline-secondary');
    if (clear) clear.style.display = 'none';
  }
}

function setupFilter(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const details = input.closest('details');
  const clear = details.querySelector('.clear-filter');
  input.addEventListener('input', () => {
    updateFilterState(id);
    notifyFilterChange();
    triggerSearch();
  });
  if (clear) {
    clear.addEventListener('click', () => {
      input.value = '';
      updateFilterState(id);
      notifyFilterChange();
      triggerSearch();
    });
  }
  updateFilterState(id);
  notifyFilterChange();
}

function hasText(customer, keyword) {
  if ((customer.details || '').includes(keyword)) return true;
  if (customer.history) {
    for (const note of Object.values(customer.history)) {
      if (typeof note === 'string' && note.includes(keyword)) return true;
    }
  }
  return false;
}

function matchesGlobalCustomer(c, key) {
  if (!key) return true;
  const props = [c.order_id, c.status, c.email, c.name, c.kana, c.category || c.type, c.details, c.date, c.staff, c.phone, c.phoneNumber];
  for (const p of props) {
    if (p && String(p).includes(key)) return true;
  }
  return hasText(c, key);
}

async function loadCustomers(force = false) {
  if (force) {
    customerCacheLoaded = false;
    customerCache = [];
    customerFetchPromise = null;
  }
  if (customerCacheLoaded) {
    return customerCache;
  }
  if (!customerFetchPromise) {
    customerFetchPromise = (async () => {
      try {
        const res = await fetch(API + '/customers');
        const data = await res.json();
        const items = (data.Items || data || []).filter(c => !c.draft);
        customerCache = items;
        customerCacheLoaded = true;
        return customerCache;
      } catch (err) {
        customerCacheLoaded = false;
        customerCache = [];
        throw err;
      } finally {
        customerFetchPromise = null;
      }
    })().catch(err => {
      console.error('顧客データの取得に失敗しました', err);
      throw err;
    });
  }
  return customerFetchPromise;
}


function triggerSearch() {
  clearTimeout(searchTimeout);
  const spinnerC = document.getElementById('loading-customer');
  if (spinnerC) spinnerC.style.display = 'block';
  renderGhostSuggestions(true);
  searchTimeout = setTimeout(async () => {
    try {
      await searchCustomers(1);
    } finally {
      if (spinnerC) spinnerC.style.display = 'none';
    }
  }, 500);
}

async function searchCustomers(page = 1, options = {}) {
  const { forceRefresh = false } = options;
  if (page === 1 || forceRefresh) {
    const dateInput = document.getElementById('s-date');
    const nameInput = document.getElementById('s-name');
    const phoneInput = document.getElementById('s-phone');
    const emailInput = document.getElementById('s-email');
    const statusInput = document.getElementById('s-status');
    const categoryInput = document.getElementById('s-category');
    const detailsInput = document.getElementById('s-details');
    const textInput = document.getElementById('s-text');

    const dateRaw = dateInput ? dateInput.value.trim() : '';
    const date = dateRaw ? dateRaw.replace(/-/g, '/') : '';
    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const email = emailInput ? emailInput.value.trim() : '';
    const status = statusInput ? statusInput.value.trim() : '';
    const category = categoryInput ? categoryInput.value.trim() : '';
    const details = detailsInput ? detailsInput.value.trim() : '';
    const text = textInput ? textInput.value.trim() : '';

    try {
      const allCustomers = await loadCustomers(forceRefresh);
      const customers = allCustomers.filter(c =>
        (!date || (c.date || '').includes(date)) &&
        (!name || (c.name || '').includes(name) || (c.kana || '').includes(name)) &&
        (!phone || (c.phone || c.phoneNumber || '').includes(phone)) &&
        (!email || (c.email || '').includes(email)) &&
        (!status || (c.status || '') === status) &&
        (!category || (c.category || c.type || '') === category) &&
        (!details || (c.details || '').includes(details)) &&
        (!text || hasText(c, text)) &&
        matchesGlobalCustomer(c, globalKey)
      );

      searchResults = customers;
    } catch (error) {
      console.error('検索結果の取得に失敗しました', error);
      searchResults = [];
    }
  }

  currentPage = page;
  const totalPages = Math.max(1, Math.ceil(searchResults.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const tbody = document.querySelector('#result-table tbody');
  tbody.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const slice = searchResults.slice(start, start + PAGE_SIZE);
  slice.forEach(c => {
    const tr = document.createElement('tr');
    let noteSnippet = '';
    if (c.history) {
      const keys = Object.keys(c.history).sort();
      const last = keys[keys.length - 1];
      if (last) noteSnippet = c.history[last] || '';
    }
    if (noteSnippet.length > 30) noteSnippet = noteSnippet.slice(0, 30) + '…';
    noteSnippet = noteSnippet.replace(/\n/g, '<br>');

    tr.innerHTML = `
      <td><a href="detail.html?id=${c.order_id}">${c.name}</a></td>
      <td>${c.category || c.type || ''}</td>
      <td>${c.details || ''}</td>
      <td>${c.status || ''}</td>
      <td style="white-space: pre-wrap;">${noteSnippet}</td>`;
    tbody.appendChild(tr);
  });

  const info = document.getElementById('page-info');
  if (info) info.textContent = `${currentPage} / ${totalPages}`;
  const prev = document.getElementById('prev-btn');
  const next = document.getElementById('next-btn');
  if (prev) prev.disabled = currentPage === 1;
  if (next) next.disabled = currentPage === totalPages || searchResults.length === 0;
  const ccount = document.getElementById('customer-count');
  if (ccount) ccount.textContent = `【${slice.length}件／${searchResults.length}件中】`;
  renderSuggestionPanel();
  renderGhostSuggestions();
}

function nextPage() {
  searchCustomers(currentPage + 1);
}

function prevPage() {
  searchCustomers(currentPage - 1);
}

function searchAll() {
  triggerSearch();
}

document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('details.static').forEach(d => {
    const s = d.querySelector('summary');
    if (s) s.addEventListener('click', e => e.preventDefault());
    d.open = true;
  });

  const customerForm = document.getElementById('customer-form');
  const toggleBtn = document.getElementById('toggle-filters');
  if (toggleBtn && customerForm) {
    const applyToggleState = () => {
      const hasFilters = hasActiveFilters();
      toggleBtn.setAttribute('aria-expanded', filtersExpanded ? 'true' : 'false');
      toggleBtn.setAttribute(
        'aria-label',
        filtersExpanded
          ? 'フィルターを閉じる'
          : hasFilters
            ? 'フィルター（適用中）を表示'
            : 'フィルターを表示'
      );
      toggleBtn.classList.toggle('is-open', filtersExpanded);
      toggleBtn.classList.toggle('has-active', hasFilters);
      customerForm.classList.toggle('d-none', !filtersExpanded);
      customerForm.setAttribute('aria-hidden', filtersExpanded ? 'false' : 'true');
    };
    toggleBtn.addEventListener('click', () => {
      filtersExpanded = !filtersExpanded;
      applyToggleState();
    });
    notifyFilterChange = applyToggleState;
    applyToggleState();
  }

  FILTER_IDS.forEach(setupFilter);

  const g = document.getElementById('all-key');
  const clearBtn = document.getElementById('clear-global');
  if (g) {
    g.addEventListener('input', () => {
      globalKey = g.value.trim();
      updateTypingState();
      renderGhostSuggestions(true);
      triggerSearch();
    });
    g.addEventListener('focus', () => {
      updateTypingState();
      if (globalKey) renderGhostSuggestions(true);
    });
  }
  if (clearBtn && g) {
    clearBtn.addEventListener('click', () => {
      g.value = '';
      globalKey = '';
      updateTypingState();
      renderGhostSuggestions();
      triggerSearch();
      g.focus();
    });
  }

  const showDetails = document.getElementById('show-details');
  const fullResults = document.getElementById('full-results');
  if (showDetails && fullResults) {
    showDetails.addEventListener('click', () => {
      document.body.classList.add('show-results');
      fullResults.classList.remove('collapsed');
      fullResults.setAttribute('aria-hidden', 'false');
      setTimeout(() => {
        fullResults.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    });
  }

  const collapseBtn = document.getElementById('collapse-results');
  if (collapseBtn && fullResults) {
    collapseBtn.addEventListener('click', () => {
      document.body.classList.remove('show-results');
      fullResults.classList.add('collapsed');
      fullResults.setAttribute('aria-hidden', 'true');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  searchCustomers(1);
  updateTypingState();
});
