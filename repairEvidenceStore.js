const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'repair_evidence.json');

async function ensureDataFile() {
  await fsPromises.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsPromises.access(DATA_FILE, fs.constants.F_OK);
  } catch (err) {
    const initial = { photos: [] };
    await fsPromises.writeFile(DATA_FILE, JSON.stringify(initial, null, 2));
  }
}

async function readStore() {
  await ensureDataFile();
  const raw = await fsPromises.readFile(DATA_FILE, 'utf-8');
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data.photos)) {
      return { photos: [] };
    }
    return { photos: data.photos };
  } catch (err) {
    return { photos: [] };
  }
}

async function writeStore(store) {
  await fsPromises.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
}

function toYmd(dateLike) {
  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

function sortPhotosDesc(photos) {
  return [...photos].sort((a, b) => {
    const aTime = new Date(a.shotDate || a.createdAt || 0).getTime();
    const bTime = new Date(b.shotDate || b.createdAt || 0).getTime();
    if (Number.isNaN(aTime) && Number.isNaN(bTime)) return 0;
    if (Number.isNaN(aTime)) return 1;
    if (Number.isNaN(bTime)) return -1;
    return bTime - aTime;
  });
}

async function listPhotoGroups({ limit = 5, cursor = null } = {}) {
  const store = await readStore();
  const sorted = sortPhotosDesc(store.photos);
  const groupsMap = new Map();
  for (const photo of sorted) {
    const key = photo.ymd || toYmd(photo.shotDate) || toYmd(photo.createdAt);
    if (!key) continue;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key).push(photo);
  }
  const keys = Array.from(groupsMap.keys());
  keys.sort((a, b) => (a === b ? 0 : a > b ? -1 : 1));
  let startIndex = 0;
  if (cursor) {
    const cursorIndex = keys.indexOf(cursor);
    if (cursorIndex >= 0) {
      startIndex = cursorIndex + 1;
    }
  }
  const slice = keys.slice(startIndex, startIndex + limit);
  const groups = slice.map(key => ({
    date: key,
    items: groupsMap.get(key).map(photo => ({ ...photo }))
  }));
  const nextCursor = startIndex + slice.length < keys.length ? slice[slice.length - 1] : null;
  return { groups, nextCursor };
}

async function savePhoto(photo) {
  const store = await readStore();
  const index = store.photos.findIndex(item => item.id === photo.id);
  if (index >= 0) {
    store.photos[index] = photo;
  } else {
    store.photos.push(photo);
  }
  await writeStore(store);
}

async function getPhotoById(id) {
  if (!id) return null;
  const store = await readStore();
  return store.photos.find(item => item.id === id) || null;
}

async function updatePhoto(id, updates) {
  const store = await readStore();
  const index = store.photos.findIndex(item => item.id === id);
  if (index === -1) return null;
  const updated = { ...store.photos[index], ...updates };
  if (updates.shotDate) {
    const ymd = toYmd(updates.shotDate);
    if (ymd) {
      updated.ymd = ymd;
    }
  }
  store.photos[index] = updated;
  await writeStore(store);
  return updated;
}

async function deletePhoto(id) {
  const store = await readStore();
  const index = store.photos.findIndex(item => item.id === id);
  if (index === -1) return false;
  store.photos.splice(index, 1);
  await writeStore(store);
  return true;
}

module.exports = {
  listPhotoGroups,
  savePhoto,
  getPhotoById,
  updatePhoto,
  deletePhoto,
  toYmd
};

