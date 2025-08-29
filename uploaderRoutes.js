const express = require('express');
const AWS = require('aws-sdk');

const router = express.Router();

const region = process.env.AWS_REGION || 'ap-northeast-1';
const bucket = process.env.S3_BUCKET || 'rebikele-file';
const publicBase = process.env.PUBLIC_BASE_URL || `https://${bucket}.s3.${region}.amazonaws.com`;

const s3 = new AWS.S3({ region, signatureVersion: 'v4' });

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const MAX_SLOT = 50;

function pad(num) {
  return String(num).padStart(3, '0');
}

async function listFiles(key) {
  const prefix = `keys/${key}/`;
  const data = await s3.listObjectsV2({ Bucket: bucket, Prefix: prefix }).promise();
  const files = [];
  for (const obj of data.Contents || []) {
    const name = obj.Key.slice(prefix.length);
    if (name && name !== 'meta.json') files.push(name);
  }
  return files;
}

async function getMeta(key) {
  const metaKey = `keys/${key}/meta.json`;
  try {
    const data = await s3.getObject({ Bucket: bucket, Key: metaKey }).promise();
    return JSON.parse(data.Body.toString('utf-8'));
  } catch (err) {
    return { thumbnail: null };
  }
}

async function saveMeta(key, meta) {
  const metaKey = `keys/${key}/meta.json`;
  await s3
    .putObject({
      Bucket: bucket,
      Key: metaKey,
      Body: JSON.stringify(meta),
      ContentType: 'application/json'
    })
    .promise();
}

router.post('/upload-url', async (req, res) => {
  const { key, ext } = req.body || {};
  if (!key || !ext || !ALLOWED_EXTS.has(ext.toLowerCase())) {
    return res.status(400).json({ error: 'invalid_request' });
  }
  const files = await listFiles(key);
  let slot = null;
  for (let i = 1; i <= MAX_SLOT; i++) {
    const base = pad(i);
    if (!files.some(f => f.startsWith(base))) {
      slot = base;
      break;
    }
  }
  if (!slot) return res.status(422).json({ error: 'no_slot_available' });

  const filename = `${slot}${ext}`;
  const objectKey = `keys/${key}/${filename}`;

  const presignedUrl = await s3.getSignedUrlPromise('putObject', {
    Bucket: bucket,
    Key: objectKey,
    Expires: 60
  });

  const publicUrl = `${publicBase}/keys/${key}/${filename}`;

  res.json({ filename, objectKey, presignedUrl, publicUrl });
});

router.get('/images/:key', async (req, res) => {
  const key = req.params.key;
  const format = req.query.format === 'csv' ? 'csv' : 'json';
  const files = (await listFiles(key)).sort();
  const meta = await getMeta(key);
  if (format === 'csv') {
    res.type('text/plain').send(files.join(', '));
  } else {
    const fileUrls = files.map(f => `${publicBase}/keys/${key}/${f}`);
    const thumbUrl = meta.thumbnail
      ? `${publicBase}/keys/${key}/${meta.thumbnail}`
      : null;
    res.json({ files: fileUrls, thumbnail: thumbUrl });
  }
});

router.delete('/images/:key/:filename', async (req, res) => {
  const { key, filename } = req.params;
  const objectKey = `keys/${key}/${filename}`;
  await s3.deleteObject({ Bucket: bucket, Key: objectKey }).promise();
  const meta = await getMeta(key);
  if (meta.thumbnail === filename) {
    meta.thumbnail = null;
    await saveMeta(key, meta);
  }
  res.status(204).end();
});

router.post('/thumbnail', async (req, res) => {
  const { key, filename } = req.body || {};
  if (!key || !filename) return res.status(400).json({ error: 'invalid_request' });
  await saveMeta(key, { thumbnail: filename });
  res.status(204).end();
});

router.get('/thumbnail/:key', async (req, res) => {
  const key = req.params.key;
  const meta = await getMeta(key);
  const thumbUrl = meta.thumbnail
    ? `${publicBase}/keys/${key}/${meta.thumbnail}`
    : null;
  res.json({ thumbnail: thumbUrl });
});

module.exports = router;
