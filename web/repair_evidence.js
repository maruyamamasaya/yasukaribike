(() => {
  'use strict';

  const MAX_PARALLEL_UPLOAD = 5;
  const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // 10MB
  const GROUP_PAGE_SIZE = 20;
  const SUPPORTED_MIME = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ]);

  const state = {
    queue: new Map(),
    pendingIds: [],
    activeUploads: 0,
    history: new Map(),
    historyOrder: [],
    cursor: null,
    loadingHistory: false,
    hasMoreHistory: false,
    selectedPhoto: null,
    visibleCounts: new Map()
  };

  const els = {
    backBtn: document.getElementById('back-btn'),
    cameraLaunch: document.getElementById('camera-launch'),
    libraryLaunch: document.getElementById('library-launch'),
    cameraInput: document.getElementById('camera-input'),
    fileInput: document.getElementById('file-input'),
    queueCounter: document.getElementById('queue-counter'),
    queueList: document.getElementById('queue-list'),
    emptyQueue: document.getElementById('empty-queue'),
    queueTemplate: document.getElementById('queue-item-template'),
    progressAnnouncer: document.getElementById('progress-announcer'),
    historyGroups: document.getElementById('history-groups'),
    historyGroupTemplate: document.getElementById('history-group-template'),
    historyItemTemplate: document.getElementById('history-item-template'),
    loadMore: document.getElementById('load-more'),
    refreshHistory: document.getElementById('refresh-history'),
    photoModal: document.getElementById('photo-modal'),
    photoModalClose: document.getElementById('photo-modal-close'),
    photoModalImage: document.getElementById('photo-modal-image'),
    photoModalShotDate: document.getElementById('photo-modal-shot-date'),
    photoModalDimensions: document.getElementById('photo-modal-dimensions'),
    photoModalSize: document.getElementById('photo-modal-size'),
    shotDateInput: document.getElementById('shot-date-input'),
    shotDateSave: document.getElementById('shot-date-save'),
    photoDelete: document.getElementById('photo-delete')
  };

  const formatters = {
    dateTime: new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  };

  function formatBytes(size) {
    if (!Number.isFinite(size)) return '-';
    const units = ['B', 'KB', 'MB', 'GB'];
    let idx = 0;
    let value = size;
    while (value >= 1024 && idx < units.length - 1) {
      value /= 1024;
      idx += 1;
    }
    return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)}${units[idx]}`;
  }

  function formatYmd(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  function toIsoJst(date) {
    const tzOffset = -9 * 60; // JST offset from UTC in minutes (-540)
    const utc = date.getTime() - date.getTimezoneOffset() * 60000;
    const jst = new Date(utc + tzOffset * 60000);
    return jst.toISOString().replace('Z', '+09:00');
  }

  function clampShotDate(date) {
    if (!date) return null;
    const now = new Date();
    if (date.getTime() > now.getTime()) {
      return now;
    }
    return date;
  }

  async function computeSha256(file) {
    const data = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(digest));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function extractMetadata(file) {
    let exif = null;
    if (typeof exifr !== 'undefined') {
      try {
        exif = await exifr.parse(file, { pick: [
          'DateTimeOriginal',
          'CreateDate',
          'ModifyDate',
          'ImageWidth',
          'ImageHeight',
          'Orientation'
        ] });
      } catch (err) {
        console.warn('EXIF parse error', err);
      }
    }
    const dateCandidates = [
      exif?.DateTimeOriginal,
      exif?.CreateDate,
      exif?.ModifyDate
    ].filter(Boolean);
    let shotDate = null;
    for (const cand of dateCandidates) {
      const parsed = new Date(cand);
      if (!Number.isNaN(parsed.getTime())) {
        shotDate = parsed;
        break;
      }
    }
    if (!shotDate && Number.isFinite(file.lastModified)) {
      shotDate = new Date(file.lastModified);
    }
    if (!shotDate) {
      shotDate = new Date();
    }
    shotDate = clampShotDate(shotDate);

    const dimensions = await getImageDimensions(file);

    return {
      shotDate,
      width: dimensions?.width ?? exif?.ImageWidth ?? null,
      height: dimensions?.height ?? exif?.ImageHeight ?? null,
      orientation: exif?.Orientation ?? null,
      exifPresent: Boolean(exif)
    };
  }

  function getImageDimensions(file) {
    return new Promise(resolve => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const result = { width: img.naturalWidth, height: img.naturalHeight };
        URL.revokeObjectURL(url);
        resolve(result);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }

  async function createPreview(file) {
    if (!file.type.startsWith('image/')) return null;
    const url = URL.createObjectURL(file);
    return url;
  }

  function announce(message) {
    if (!els.progressAnnouncer) return;
    els.progressAnnouncer.textContent = message;
  }

  function renderQueueItem(item) {
    const node = els.queueTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = item.id;
    const thumb = node.querySelector('.queue-thumb');
    const img = document.createElement('img');
    if (item.previewUrl) {
      img.src = item.previewUrl;
      img.alt = `${item.file.name} のプレビュー`;
      thumb.appendChild(img);
    } else {
      thumb.textContent = '画像';
    }
    node.querySelector('.queue-file-name').textContent = item.file.name;
    node.querySelector('.queue-shot-date').textContent = formatters.dateTime.format(
      item.metadata.shotDate
    );
    els.queueList.appendChild(node);
    els.emptyQueue.classList.add('d-none');
    return node;
  }

  function updateQueueItem(item) {
    const node = item.element;
    if (!node) return;
    const statusEl = node.querySelector('.queue-status');
    statusEl.textContent = item.statusLabel;
    statusEl.dataset.status = item.status;
    const bar = node.querySelector('.progress-bar');
    if (bar) {
      bar.style.width = `${Math.max(0, Math.min(100, item.progress))}%`;
      bar.setAttribute('aria-valuenow', String(Math.round(item.progress)));
    }
    const errorEl = node.querySelector('.queue-error');
    if (item.error) {
      errorEl.textContent = item.error;
      errorEl.classList.remove('d-none');
    } else {
      errorEl.classList.add('d-none');
    }
  }

  function updateQueueCounter() {
    const active = Array.from(state.queue.values()).filter(
      item => item.status !== 'success' && item.status !== 'error'
    ).length;
    els.queueCounter.textContent = String(active);
    if (els.queueList.children.length === 0) {
      els.emptyQueue.classList.remove('d-none');
    }
  }

  function addHistoryGroup(dateKey) {
    const section = els.historyGroupTemplate.content.firstElementChild.cloneNode(true);
    const labelDate = dateKey.slice(0, 4) + '/' + dateKey.slice(4, 6) + '/' + dateKey.slice(6, 8);
    section.querySelector('.history-group-title').textContent = `${labelDate}`;
    const counter = section.querySelector('.history-group-count');
    counter.textContent = '0枚';
    counter.dataset.count = '0';
    section.dataset.dateKey = dateKey;
    const moreBtn = section.querySelector('.history-group-more');
    if (moreBtn) {
      moreBtn.addEventListener('click', () => showMoreInGroup(dateKey));
    }

    let inserted = false;
    const groups = Array.from(els.historyGroups.querySelectorAll('.history-group'));
    for (const existing of groups) {
      if (existing.dataset.dateKey < dateKey) {
        els.historyGroups.insertBefore(section, existing);
        inserted = true;
        break;
      }
    }
    if (!inserted) {
      els.historyGroups.appendChild(section);
    }
    return section;
  }

  function upsertHistory(photo) {
    const { ymd } = photo;
    if (!state.history.has(ymd)) {
      state.history.set(ymd, []);
      state.historyOrder.push(ymd);
      state.historyOrder.sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));
      state.visibleCounts.set(ymd, Math.min(GROUP_PAGE_SIZE, 0));
    }
    const group = state.history.get(ymd);
    const existingIndex = group.findIndex(item => item.id === photo.id);
    if (existingIndex >= 0) {
      group[existingIndex] = photo;
    } else {
      const targetTime = photo.shotDate instanceof Date ? photo.shotDate.getTime() : 0;
      let inserted = false;
      for (let i = 0; i < group.length; i += 1) {
        const current = group[i].shotDate instanceof Date ? group[i].shotDate.getTime() : 0;
        if (targetTime >= current) {
          group.splice(i, 0, photo);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        group.push(photo);
      }
    }
    const previousVisible = state.visibleCounts.get(ymd) ?? GROUP_PAGE_SIZE;
    const desiredVisible = Math.min(
      Math.max(previousVisible, Math.min(GROUP_PAGE_SIZE, group.length)),
      group.length
    );
    state.visibleCounts.set(ymd, desiredVisible);
    renderHistoryGroup(ymd);
  }

  function rebuildHistory(groups) {
    els.historyGroups.innerHTML = '';
    state.history.clear();
    state.historyOrder = [];
    state.visibleCounts = new Map();
    for (const group of groups) {
      const rawDate =
        group.date || group.ymd || group.shotDate || group.shot_date || formatYmd(new Date());
      const dateKey = String(rawDate).replaceAll('-', '').slice(0, 8);
      const normalizedItems = group.items.map(item => (item.raw ? item : normalizePhoto(item)));
      state.history.set(dateKey, normalizedItems);
      state.historyOrder.push(dateKey);
      state.visibleCounts.set(dateKey, Math.min(GROUP_PAGE_SIZE, normalizedItems.length));
      renderHistoryGroup(dateKey);
    }
  }

  function renderHistoryGroup(dateKey) {
    let section = els.historyGroups.querySelector(`.history-group[data-date-key="${dateKey}"]`);
    if (!section) {
      section = addHistoryGroup(dateKey);
    }
    const items = state.history.get(dateKey) || [];
    const total = items.length;
    let visible = state.visibleCounts.get(dateKey);
    if (!Number.isFinite(visible)) {
      visible = Math.min(GROUP_PAGE_SIZE, total);
      state.visibleCounts.set(dateKey, visible);
    }
    visible = Math.min(visible, total);
    state.visibleCounts.set(dateKey, visible);

    const grid = section.querySelector('.history-grid');
    grid.innerHTML = '';
    for (const photo of items.slice(0, visible)) {
      const node = els.historyItemTemplate.content.firstElementChild.cloneNode(true);
      node.dataset.photoId = photo.id;
      const button = node.querySelector('.history-item');
      const img = node.querySelector('img');
      img.src = photo.thumbUrl || photo.url;
      img.dataset.fullUrl = photo.url;
      img.alt = `${photo.displayDate} のエビデンス`;
      button.dataset.photoId = photo.id;
      button.addEventListener('click', () => openPhotoModal(photo));
      grid.appendChild(node);
    }

    const counter = section.querySelector('.history-group-count');
    if (counter) {
      counter.dataset.count = String(total);
      counter.textContent = `${total}枚`;
    }
    const moreBtn = section.querySelector('.history-group-more');
    if (moreBtn) {
      const hasMore = visible < total;
      moreBtn.classList.toggle('d-none', !hasMore);
      moreBtn.disabled = !hasMore;
    }
  }

  function showMoreInGroup(dateKey) {
    const items = state.history.get(dateKey) || [];
    if (!items.length) return;
    const current = state.visibleCounts.get(dateKey) ?? GROUP_PAGE_SIZE;
    const next = Math.min(current + GROUP_PAGE_SIZE, items.length);
    state.visibleCounts.set(dateKey, next);
    renderHistoryGroup(dateKey);
  }

  function normalizePhoto(photo) {
    const shotDate = photo.shotDate || photo.shotDateJst || photo.shot_date || photo.shot_date_jst;
    const dateObj = shotDate ? new Date(shotDate) : new Date();
    const ymd = formatYmd(dateObj);
    const displayDate = formatters.dateTime.format(dateObj);
    return {
      id: photo.id || photo.photoId || photo.key || photo.s3Key || crypto.randomUUID(),
      url: photo.url || photo.originalUrl || photo.publicUrl || '',
      thumbUrl: photo.thumbUrl || photo.thumbnailUrl || null,
      width: photo.width || null,
      height: photo.height || null,
      size: photo.size || photo.bytes || null,
      ymd,
      displayDate,
      shotDate: dateObj,
      raw: photo
    };
  }

  async function fetchHistory({ reset = false } = {}) {
    if (state.loadingHistory) return;
    state.loadingHistory = true;
    try {
      if (reset) {
        state.cursor = null;
      }
      const params = new URLSearchParams();
      params.set('limit', '5');
      if (state.cursor) params.set('cursor', state.cursor);
      const res = await fetch(`/api/photos?${params.toString()}`);
      if (!res.ok) throw new Error(`一覧の取得に失敗しました (${res.status})`);
      const payload = await res.json();
      const groups = payload.groups || payload.items || [];
      const normalizedGroups = groups.map(group => ({
        date: group.date || group.ymd || group.shotDate,
        items: (group.items || group.photos || []).map(normalizePhoto)
      }));
      if (reset) {
        rebuildHistory(normalizedGroups);
      } else {
        for (const group of normalizedGroups) {
          const fallbackDate = group.items[0]?.ymd || formatYmd(new Date());
          const dateKey = String(group.date || fallbackDate).replaceAll('-', '').slice(0, 8);
          if (!state.history.has(dateKey)) {
            state.history.set(dateKey, []);
            state.historyOrder.push(dateKey);
            state.historyOrder.sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));
            state.visibleCounts.set(dateKey, Math.min(GROUP_PAGE_SIZE, 0));
          }
          for (const photo of group.items) {
            upsertHistory(photo);
          }
        }
      }
      state.cursor = payload.nextCursor || payload.cursor || null;
      state.hasMoreHistory = Boolean(state.cursor);
      els.loadMore.classList.toggle('d-none', !state.hasMoreHistory);
    } catch (err) {
      console.warn(err);
      if (reset && els.historyGroups.childElementCount === 0) {
        const alert = document.createElement('div');
        alert.className = 'alert alert-warning';
        alert.textContent = '過去のエビデンスを取得できませんでした。後でもう一度お試しください。';
        els.historyGroups.appendChild(alert);
      }
    } finally {
      state.loadingHistory = false;
    }
  }

  async function requestPresign(item) {
    const body = {
      filename: item.file.name,
      mime: item.file.type,
      size: item.file.size,
      sha256: item.hash
    };
    const res = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      throw new Error('アップロードURLの取得に失敗しました');
    }
    return res.json();
  }

  function uploadWithProgress(url, file, onProgress, headers = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', url, true);
      Object.entries(headers || {}).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100;
          onProgress(percent);
        }
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`アップロードに失敗しました (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('ネットワークエラーが発生しました'));
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.send(file);
    });
  }

  async function completeUpload(item, presignResponse) {
    const payload = {
      key: presignResponse.key || presignResponse.objectKey,
      bucket: presignResponse.bucket || presignResponse.Bucket,
      shotDate: toIsoJst(item.metadata.shotDate),
      width: item.metadata.width,
      height: item.metadata.height,
      orientation: item.metadata.orientation,
      size: item.file.size,
      mime: item.file.type,
      hash: item.hash,
      exifPresent: item.metadata.exifPresent
    };
    const res = await fetch('/api/upload/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('アップロード完了処理に失敗しました');
    const data = await res.json().catch(() => ({}));
    return data;
  }

  function processQueue() {
    if (state.activeUploads >= MAX_PARALLEL_UPLOAD) return;
    const nextId = state.pendingIds.shift();
    if (!nextId) return;
    const item = state.queue.get(nextId);
    if (!item) {
      processQueue();
      return;
    }
    state.activeUploads += 1;
    runUpload(item)
      .catch(err => {
        console.error(err);
      })
      .finally(() => {
        state.activeUploads -= 1;
        processQueue();
      });
  }

  async function runUpload(item) {
    if (item.file.size > 20 * 1024 * 1024) {
      item.status = 'error';
      item.statusLabel = 'サイズ超過';
      item.error = '20MBを超えるファイルはアップロードできません。';
      updateQueueItem(item);
      return;
    }
    if (item.file.size > MULTIPART_THRESHOLD) {
      item.status = 'error';
      item.statusLabel = '未対応';
      item.error = '10MB超のマルチパートアップロードは現在準備中です。';
      updateQueueItem(item);
      return;
    }
    item.status = 'uploading';
    item.statusLabel = 'アップロード中';
    item.progress = 0;
    updateQueueItem(item);
    try {
      const presign = await requestPresign(item);
      const uploadUrl = presign.uploadUrl || presign.url;
      if (!uploadUrl) {
        throw new Error('アップロードURLが取得できませんでした');
      }
      announce(`${item.file.name} のアップロードを開始します`);
      await uploadWithProgress(uploadUrl, item.file, percent => {
        item.progress = percent;
        updateQueueItem(item);
      }, presign.headers);
      item.progress = 100;
      updateQueueItem(item);
      const completeRes = await completeUpload(item, presign);
      item.status = 'success';
      item.statusLabel = '完了';
      updateQueueItem(item);
      updateQueueCounter();
      announce(`${item.file.name} のアップロードが完了しました`);
      const normalized = normalizePhoto({
        ...(completeRes.photo || {}),
        url: completeRes.photo?.url || presign.publicUrl,
        thumbUrl: completeRes.photo?.thumbUrl || presign.thumbUrl,
        shotDate: item.metadata.shotDate,
        width: item.metadata.width,
        height: item.metadata.height,
        size: item.file.size
      });
      normalized.ymd = formatYmd(item.metadata.shotDate);
      normalized.displayDate = formatters.dateTime.format(item.metadata.shotDate);
      upsertHistory(normalized);
    } catch (err) {
      item.status = 'error';
      item.statusLabel = '失敗';
      item.error = err.message;
      updateQueueItem(item);
      updateQueueCounter();
      announce(`${item.file.name} のアップロードに失敗しました`);
    }
  }

  function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    files.forEach(file => {
      if (!SUPPORTED_MIME.has(file.type)) {
        const toast = document.createElement('div');
        toast.className = 'alert alert-warning';
        toast.textContent = `${file.name} はサポートされていない形式です。`;
        els.queueList.prepend(toast);
        setTimeout(() => toast.remove(), 5000);
        return;
      }
      const id = crypto.randomUUID();
      const item = {
        id,
        file,
        status: 'pending',
        statusLabel: '準備中',
        progress: 0,
        metadata: null,
        element: null,
        error: null,
        previewUrl: null,
        hash: null
      };
      state.queue.set(id, item);
      prepareQueueItem(item)
        .then(() => {
          state.pendingIds.push(id);
          processQueue();
        })
        .catch(err => {
          console.error(err);
          item.status = 'error';
          item.statusLabel = '準備失敗';
          item.error = err.message;
          updateQueueItem(item);
          updateQueueCounter();
        });
    });
    updateQueueCounter();
  }

  async function prepareQueueItem(item) {
    item.previewUrl = await createPreview(item.file);
    item.metadata = await extractMetadata(item.file);
    item.hash = await computeSha256(item.file);
    item.element = renderQueueItem(item);
    updateQueueItem(item);
  }

  function setupInputs() {
    if (els.backBtn) {
      els.backBtn.addEventListener('click', () => {
        if (typeof goBack === 'function') {
          goBack();
        } else {
          window.history.back();
        }
      });
    }
    if (els.cameraLaunch && els.cameraInput) {
      els.cameraLaunch.addEventListener('click', () => {
        els.cameraInput.click();
      });
      els.cameraInput.addEventListener('change', event => {
        handleFiles(event.target.files);
        event.target.value = '';
      });
    }
    if (els.libraryLaunch && els.fileInput) {
      els.libraryLaunch.addEventListener('click', () => {
        els.fileInput.click();
      });
      els.fileInput.addEventListener('change', event => {
        handleFiles(event.target.files);
        event.target.value = '';
      });
    }
  }

  function setupHistoryControls() {
    if (els.loadMore) {
      els.loadMore.addEventListener('click', () => {
        fetchHistory();
      });
    }
    if (els.refreshHistory) {
      els.refreshHistory.addEventListener('click', () => {
        fetchHistory({ reset: true });
      });
    }
  }

  function openPhotoModal(photo) {
    state.selectedPhoto = photo;
    els.photoModalImage.src = photo.url;
    els.photoModalShotDate.textContent = formatters.dateTime.format(photo.shotDate);
    if (photo.width && photo.height) {
      els.photoModalDimensions.textContent = `${photo.width} × ${photo.height}`;
    } else {
      els.photoModalDimensions.textContent = '-';
    }
    els.photoModalSize.textContent = formatBytes(photo.size);
    els.shotDateInput.value = formatYmd(photo.shotDate);
    els.photoModal.classList.remove('d-none');
  }

  function closePhotoModal() {
    els.photoModal.classList.add('d-none');
    state.selectedPhoto = null;
  }

  async function saveShotDate() {
    if (!state.selectedPhoto) return;
    const value = els.shotDateInput.value;
    if (!value) return;
    const newDate = new Date(`${value}T00:00:00+09:00`);
    state.selectedPhoto.shotDate = newDate;
    state.selectedPhoto.displayDate = formatters.dateTime.format(newDate);
    els.photoModalShotDate.textContent = state.selectedPhoto.displayDate;
    const payload = {
      shotDate: `${value}T00:00:00+09:00`
    };
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(state.selectedPhoto.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('撮影日の更新に失敗しました');
      announce('撮影日を更新しました');
      fetchHistory({ reset: true });
    } catch (err) {
      console.error(err);
      announce('撮影日の更新に失敗しました');
    }
  }

  function setupModal() {
    if (!els.photoModal) return;
    if (els.photoModalClose) {
      els.photoModalClose.addEventListener('click', closePhotoModal);
    }
    els.photoModal.addEventListener('click', event => {
      if (event.target === els.photoModal) {
        closePhotoModal();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !els.photoModal.classList.contains('d-none')) {
        closePhotoModal();
      }
    });
    if (els.shotDateSave) {
      els.shotDateSave.addEventListener('click', saveShotDate);
    }
    if (els.photoDelete) {
      els.photoDelete.addEventListener('click', deleteSelectedPhoto);
    }
  }

  async function deleteSelectedPhoto() {
    if (!state.selectedPhoto) return;
    const confirmed = window.confirm('選択した写真を削除しますか？');
    if (!confirmed) return;
    const target = state.selectedPhoto;
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(target.id)}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('削除に失敗しました');
      removePhotoFromState(target.id);
      announce('写真を削除しました');
      closePhotoModal();
    } catch (err) {
      console.error(err);
      announce('写真の削除に失敗しました');
    }
  }

  function removePhotoFromState(id) {
    for (const [dateKey, items] of state.history.entries()) {
      const index = items.findIndex(item => item.id === id);
      if (index === -1) continue;
      items.splice(index, 1);
      if (items.length === 0) {
        state.history.delete(dateKey);
        state.visibleCounts.delete(dateKey);
        state.historyOrder = state.historyOrder.filter(key => key !== dateKey);
        const section = els.historyGroups.querySelector(`.history-group[data-date-key="${dateKey}"]`);
        if (section) {
          section.remove();
        }
      } else {
        const currentVisible = state.visibleCounts.get(dateKey) ?? GROUP_PAGE_SIZE;
        const nextVisible = Math.min(currentVisible, items.length);
        state.visibleCounts.set(dateKey, nextVisible);
        renderHistoryGroup(dateKey);
      }
      break;
    }
  }

  function init() {
    setupInputs();
    setupHistoryControls();
    setupModal();
    fetchHistory({ reset: true });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
