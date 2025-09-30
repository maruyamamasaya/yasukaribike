const express = require('express');
const crypto = require('crypto');
const path = require('path');
const AWS = require('aws-sdk');

const {
  listPhotoGroups,
  savePhoto,
  getPhotoById,
  updatePhoto,
  deletePhoto,
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

const region = process.env.AWS_REGION || 'ap-northeast-1';
const bucket = process.env.REPAIR_EVIDENCE_BUCKET || process.env.S3_BUCKET || 'rebikele-file';
const prefixEnv = process.env.REPAIR_EVIDENCE_PREFIX || 'kokyaku_kanri/repair_evidence';
const normalizedPrefix = prefixEnv.replace(/^\/+|\/+$/g, '');
const publicBase =
  process.env.REPAIR_EVIDENCE_PUBLIC_BASE ||
  process.env.PUBLIC_BASE_URL ||
  `https://${bucket}.s3.${region}.amazonaws.com`;

const s3 = new AWS.S3({ region, signatureVersion: 'v4' });

const pendingUploads = new Map();

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function buildObjectKey(id, ext) {
  const baseName = sanitizeFilename(`${id}${ext}`);
  if (!normalizedPrefix) return baseName;
  return `${normalizedPrefix}/${baseName}`;
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

  const ext = (path.extname(filename) || '.bin').toLowerCase();
  const id = crypto.randomUUID();
  const objectKey = buildObjectKey(id, ext);
  const publicUrl = `${publicBase}/${objectKey}`;

  const uploadUrl = await s3.getSignedUrlPromise('putObject', {
    Bucket: bucket,
    Key: objectKey,
    Expires: 300,
    ContentType: mime
  });

  pendingUploads.set(id, {
    filename,
    mime,
    size,
    sha256: sha256 || null,
    ext,
    bucket,
    objectKey,
    publicUrl
  });

  res.json({
    key: id,
    bucket,
    objectKey,
    uploadUrl,
    publicUrl,
    headers: {}
  });
});

router.post('/upload/complete', async (req, res) => {
  const {
    key,
    bucket: requestBucket,
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
  if (!pending) {
    return res.status(404).json({ error: 'upload_not_found' });
  }

  if (requestBucket && requestBucket !== pending.bucket) {
    return res.status(400).json({ error: 'invalid_bucket' });
  }

  let head = null;
  try {
    head = await s3
      .headObject({
        Bucket: pending.bucket,
        Key: pending.objectKey
      })
      .promise();
  } catch (err) {
    if (err && err.code === 'NotFound') {
      return res.status(404).json({ error: 'upload_not_found' });
    }
    console.error('Failed to verify uploaded object', err);
    return res.status(500).json({ error: 'verification_failed' });
  }

  const createdAt = new Date().toISOString();
  const photoShotDate = shotDate || createdAt;
  const ymd = toYmd(photoShotDate) || toYmd(createdAt);

  let resolvedSize = Number.isFinite(size) ? size : pending.size;
  if (!Number.isFinite(resolvedSize) && head && Number.isFinite(head.ContentLength)) {
    resolvedSize = head.ContentLength;
  }

  let resolvedMime = mime || pending.mime;
  if (!resolvedMime && head && head.ContentType) {
    resolvedMime = head.ContentType;
  }

  const photo = {
    id: key,
    bucket: pending.bucket,
    objectKey: pending.objectKey,
    filename: pending.filename,
    mime: resolvedMime,
    size: resolvedSize,
    width: Number.isFinite(width) ? width : null,
    height: Number.isFinite(height) ? height : null,
    orientation: Number.isFinite(orientation) ? orientation : null,
    hash: hash || pending.sha256 || null,
    exifPresent: Boolean(exifPresent),
    shotDate: photoShotDate,
    createdAt,
    ymd,
    url: pending.publicUrl,
    thumbUrl: pending.publicUrl
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

router.delete('/photos/:id', async (req, res) => {
  const removed = await deletePhoto(req.params.id);
  if (!removed) {
    return res.status(404).json({ error: 'not_found' });
  }
  res.status(204).send();
});

module.exports = router;

