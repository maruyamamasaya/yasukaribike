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
const OR_SPLIT_REGEX = /[\s\u3000]+/;
let suggestionMinimized = false;
let suggestionPanelRef = null;
let suggestionRestoreRef = null;

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

function parseOrTerms(value) {
  if (!value) return [];
  return value
    .split(OR_SPLIT_REGEX)
    .map(v => v.trim())
    .filter(Boolean);
}

function matchesValuesWithTerms(values, terms) {
  if (!terms || !terms.length) return true;
  return terms.some(term => values.some(val => val && String(val).includes(term)));
}

function openRowUrl(url, options = {}) {
  if (!url) return;
  const { newTab = false } = options;
  if (newTab) {
    window.open(url, '_blank', 'noopener');
  } else {
    window.location.href = url;
  }
}

function attachInteractiveRow(row, url) {
  if (!row || !url) return;
  row.dataset.href = url;
  row.setAttribute('role', 'link');
  row.setAttribute('tabindex', '0');
  row.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    if (typeof event.button === 'number' && event.button !== 0) return;
    event.preventDefault();
    const shouldOpenNewTab = event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
    openRowUrl(url, { newTab: shouldOpenNewTab });
  });
  row.addEventListener('auxclick', event => {
    if (event.button === 1) {
      event.preventDefault();
      openRowUrl(url, { newTab: true });
    }
  });
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openRowUrl(url, { newTab: event.ctrlKey || event.metaKey });
    }
  });
}

function ensureSuggestionRefs() {
  if (!suggestionPanelRef) suggestionPanelRef = document.getElementById('suggestion-panel');
  if (!suggestionRestoreRef) suggestionRestoreRef = document.getElementById('suggestion-restore');
}

function setSuggestionMinimized(state) {
  suggestionMinimized = Boolean(state);
  ensureSuggestionRefs();
  if (suggestionPanelRef) {
    suggestionPanelRef.classList.toggle('is-minimized', suggestionMinimized);
  }
  document.body.classList.toggle('suggestion-minimized', suggestionMinimized);
  if (suggestionRestoreRef) {
    suggestionRestoreRef.hidden = !suggestionMinimized;
    suggestionRestoreRef.setAttribute('aria-hidden', suggestionMinimized ? 'false' : 'true');
  }
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
  ensureSuggestionRefs();
  const panel = suggestionPanelRef;
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
        meta: trimText(metaParts.join('・'), 52) || '詳細メモなし',
        orderId: item.order_id
      };
    });

    if (highlights.length) {
      highlightList.innerHTML = highlights.map(h => {
        const detailUrl = h.orderId ? `detail.html?id=${encodeURIComponent(h.orderId)}` : '#';
        const linkAttrs = h.orderId ? `href="${detailUrl}"` : 'role="button" aria-disabled="true" tabindex="-1"';
        return `
        <li class="highlight-item">
          <a class="highlight-link" ${linkAttrs}>
            <span class="highlight-type">問い合わせ</span>
            <div class="highlight-main">
              <p class="highlight-title">${escapeHTML(trimText(h.title, 36))}</p>
              <p class="highlight-meta">${escapeHTML(trimText(h.meta, 48))}</p>
            </div>
          </a>
        </li>`;
      }).join('');
    } else {
      highlightList.innerHTML = '<li class="highlight-empty">該当する候補が見つかりません</li>';
    }
  }

  const hasKeyword = Boolean(globalKey);
  panel.classList.toggle('is-active', hasKeyword);
  panel.classList.toggle('has-results', hasKeyword && searchResults.length > 0);
  if (suggestionMinimized && hasKeyword) {
    panel.classList.add('is-minimized');
  }
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
  const terms = parseOrTerms(key);
  if (!terms.length) return true;
  const props = [c.order_id, c.status, c.email, c.name, c.kana, c.category || c.type, c.details, c.date, c.staff, c.phone, c.phoneNumber];
  return terms.some(term => {
    if (hasText(c, term)) return true;
    return props.some(p => p && String(p).includes(term));
  });
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
    const nameRaw = nameInput ? nameInput.value.trim() : '';
    const phoneRaw = phoneInput ? phoneInput.value.trim() : '';
    const emailRaw = emailInput ? emailInput.value.trim() : '';
    const status = statusInput ? statusInput.value.trim() : '';
    const category = categoryInput ? categoryInput.value.trim() : '';
    const detailsRaw = detailsInput ? detailsInput.value.trim() : '';
    const textRaw = textInput ? textInput.value.trim() : '';

    const nameTerms = parseOrTerms(nameRaw);
    const phoneTerms = parseOrTerms(phoneRaw);
    const emailTerms = parseOrTerms(emailRaw);
    const detailsTerms = parseOrTerms(detailsRaw);
    const textTerms = parseOrTerms(textRaw);

    try {
      const allCustomers = await loadCustomers(forceRefresh);
      const customers = allCustomers.filter(c =>
        (!date || (c.date || '').includes(date)) &&
        matchesValuesWithTerms([c.name, c.kana], nameTerms) &&
        matchesValuesWithTerms([c.phone, c.phoneNumber], phoneTerms) &&
        matchesValuesWithTerms([c.email], emailTerms) &&
        (!status || (c.status || '') === status) &&
        (!category || (c.category || c.type || '') === category) &&
        matchesValuesWithTerms([c.details], detailsTerms) &&
        (textTerms.length ? textTerms.some(term => hasText(c, term)) : true) &&
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
  slice.forEach((c, index) => {
    const tr = document.createElement('tr');
    tr.classList.add('result-row');

    let noteSnippet = '';
    if (c.history) {
      const keys = Object.keys(c.history).sort();
      const last = keys[keys.length - 1];
      if (last) noteSnippet = c.history[last] || '';
    }
    if (noteSnippet.length > 1000) noteSnippet = noteSnippet.slice(0, 1000) + '…';
    noteSnippet = noteSnippet.replace(/\n/g, '<br>');

    const detailUrl = c.order_id ? `detail.html?id=${encodeURIComponent(c.order_id)}` : '';
    const safeName = escapeHTML(c.name || '（名称未設定）');
    const tags = [c.category || c.type, c.status, c.date]
      .filter(Boolean)
      .map(tag => `<span class="result-tag">${escapeHTML(tag)}</span>`)
      .join('');
    const tagList = tags ? `<div class="result-tag-list" aria-hidden="true">${tags}</div>` : '';
    const guidance = detailUrl
      ? 'クリックまたはEnterキーで詳細を開きます'
      : '詳細画面が存在しません';
    const noteHtml = noteSnippet || '<span class="text-muted">本文の記録はまだありません</span>';

    tr.innerHTML = `
      <td class="result-name-cell">
        <div class="result-row-head">
          <span class="result-name-text">${safeName}</span>
          <span class="result-chevron" aria-hidden="true"></span>
        </div>
        ${tagList}
        <div class="result-row-meta">${guidance}</div>
      </td>
      <td class="result-note-cell">${noteHtml}</td>`;

    if (detailUrl) {
      attachInteractiveRow(tr, detailUrl);
      const ariaParts = [c.name || '（名称未設定）'];
      if (c.category || c.type) ariaParts.push(c.category || c.type);
      if (c.status) ariaParts.push(`状態 ${c.status}`);
      tr.setAttribute('aria-label', `${ariaParts.join(' / ')} の詳細を開く`);
    } else {
      tr.classList.add('is-disabled');
      tr.setAttribute('aria-disabled', 'true');
    }

    tbody.appendChild(tr);
    requestAnimationFrame(() => {
      tr.style.setProperty('--result-row-index', index);
      tr.classList.add('is-appearing');
      setTimeout(() => {
        tr.classList.remove('is-appearing');
        tr.style.removeProperty('--result-row-index');
      }, 900 + index * 40);
    });
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
  ensureSuggestionRefs();
  const suggestionClose = document.getElementById('suggestion-close');
  const suggestionRestore = suggestionRestoreRef;
  if (g) {
    g.addEventListener('input', () => {
      globalKey = g.value.trim();
      if (suggestionMinimized && globalKey) {
        setSuggestionMinimized(false);
      }
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
      if (suggestionMinimized) {
        setSuggestionMinimized(false);
      }
      updateTypingState();
      renderGhostSuggestions();
      triggerSearch();
      g.focus();
    });
  }

  if (suggestionClose) {
    suggestionClose.addEventListener('click', () => {
      setSuggestionMinimized(true);
    });
  }

  if (suggestionRestore) {
    suggestionRestore.hidden = true;
    suggestionRestore.addEventListener('click', () => {
      setSuggestionMinimized(false);
      updateTypingState();
      if (globalKey) {
        renderSuggestionPanel();
      }
    });
  }

  const showDetails = document.getElementById('show-details');
  const fullResults = document.getElementById('full-results');
  if (showDetails && fullResults) {
    showDetails.addEventListener('click', () => {
      setSuggestionMinimized(true);
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
  setSuggestionMinimized(false);
});
