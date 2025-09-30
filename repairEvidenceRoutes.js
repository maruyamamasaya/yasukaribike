const express = require('express');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const {
  listPhotoGroups,
  savePhoto,
  getPhotoById,
  updatePhoto,
  toYmd
} = require('./repairEvidenceStore');

const router = express.Router();

const SUPPORTED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif'
]);

const UPLOAD_DIR = path.join(__dirname, 'web', 'uploads', 'repair_evidence');
const PUBLIC_PREFIX = '/uploads/repair_evidence';

const pendingUploads = new Map();

async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

router.post('/upload/presign', async (req, res) => {
  const { filename, mime, size, sha256 } = req.body || {};
  if (!filename || !mime || !Number.isFinite(size)) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  if (!SUPPORTED_MIME.has(mime)) {
    return res.status(415).json({ error: 'unsupported_type' });
  }
  if (size > 20 * 1024 * 1024) {
    return res.status(413).json({ error: 'file_too_large' });
  }

  const ext = path.extname(filename) || '.bin';
  const id = crypto.randomUUID();
  pendingUploads.set(id, {
    filename,
    mime,
    size,
    sha256: sha256 || null,
    ext: ext.toLowerCase()
  });

  res.json({
    key: id,
    uploadUrl: `/api/upload/file/${id}`,
    headers: {}
  });
});

router.put(
  '/upload/file/:id',
  express.raw({ type: '*/*', limit: '25mb' }),
  async (req, res) => {
    const { id } = req.params;
    const pending = pendingUploads.get(id);
    if (!pending) {
      return res.status(404).json({ error: 'upload_not_found' });
    }
    await ensureUploadDir();
    const base = sanitizeFilename(`${id}${pending.ext}`);
    const filePath = path.join(UPLOAD_DIR, base);
    await fs.writeFile(filePath, req.body);
    const hash = crypto.createHash('sha256').update(req.body).digest('hex');
    pending.uploaded = true;
    pending.filePath = filePath;
    pending.publicPath = `${PUBLIC_PREFIX}/${base}`;
    pending.computedHash = hash;
    res.status(204).end();
  }
);

router.post('/upload/complete', async (req, res) => {
  const {
    key,
    bucket,
    shotDate,
    width,
    height,
    orientation,
    size,
    mime,
    hash,
    exifPresent
  } = req.body || {};
  if (!key) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  const pending = pendingUploads.get(key);
  if (!pending || !pending.uploaded) {
    return res.status(404).json({ error: 'upload_not_found' });
  }

  const createdAt = new Date().toISOString();
  const photoShotDate = shotDate || createdAt;
  const ymd = toYmd(photoShotDate) || toYmd(createdAt);

  const photo = {
    id: key,
    bucket: bucket || null,
    filename: pending.filename,
    mime: mime || pending.mime,
    size: Number.isFinite(size) ? size : pending.size,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    orientation: Number.isFinite(orientation) ? orientation : null,
    hash: hash || pending.sha256 || pending.computedHash || null,
    exifPresent: Boolean(exifPresent),
    shotDate: photoShotDate,
    createdAt,
    ymd,
    url: pending.publicPath,
    thumbUrl: pending.publicPath
  };

  await savePhoto(photo);
  pendingUploads.delete(key);

  res.json({ photo });
});

router.get('/photos', async (req, res) => {
  const limit = Number.parseInt(req.query.limit, 10);
  const cursor = req.query.cursor ? String(req.query.cursor) : null;
  const result = await listPhotoGroups({
    limit: Number.isFinite(limit) && limit > 0 ? limit : 5,
    cursor
  });
  res.json(result);
});

router.get('/photos/:id', async (req, res) => {
  const photo = await getPhotoById(req.params.id);
  if (!photo) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json({ photo });
});

router.patch('/photos/:id', async (req, res) => {
  const { shotDate } = req.body || {};
  if (!shotDate) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  const updated = await updatePhoto(req.params.id, { shotDate });
  if (!updated) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.json({ photo: updated });
});

module.exports = router;

