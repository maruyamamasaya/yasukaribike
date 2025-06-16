require('dotenv').config();
const express = require('express');
const path = require('path');
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const AWS = require('aws-sdk');
const {
  DynamoDBClient
} = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.TABLE_NAME || 'kokyakukanri_TBL';

const region = process.env.AWS_REGION || 'ap-northeast-1';
const client = new DynamoDBClient({ region });
const ddb = DynamoDBDocumentClient.from(client);
AWS.config.update({ region });
const dynamo = new AWS.DynamoDB.DocumentClient();
const GOOBIKE_TABLE = process.env.GOOBIKE_TABLE || 'Rebikele_goobikemail03_TBL';

function respondError(res, status, label, err) {
  console.error(err);
  const body = { error: label };
  if (process.env.NODE_ENV !== 'production' && err) {
    body.message = err.message || String(err);
  }
  res.status(status).json(body);
}

function verifyEmailConfig() {
  const required = ['EMAIL_USER', 'EMAIL_PASS', 'IMAP_HOST'];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing ${key}`);
      throw new Error(`Missing ${key}`);
    }
  }
}

const app = express();
verifyEmailConfig();

// Basic Authentication middleware
const AUTH_USER = process.env.BASIC_USER || 'user';
const AUTH_PASS = process.env.BASIC_PASS || '0000';
app.use((req, res, next) => {
  const header = req.headers['authorization'];
  if (!header) {
    res.set('WWW-Authenticate', 'Basic realm="Restricted"');
    return res.status(401).send('Authentication required');
  }
  const [scheme, encoded] = header.split(' ');
  if (scheme !== 'Basic' || !encoded) {
    res.set('WWW-Authenticate', 'Basic realm="Restricted"');
    return res.status(401).send('Invalid authorization header');
  }
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const [user, pass] = decoded.split(':');
  if (user === AUTH_USER && pass === AUTH_PASS) {
    return next();
  }
  res.set('WWW-Authenticate', 'Basic realm="Restricted"');
  res.status(401).send('Access denied');
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

function extractGoobikeSections(rawText) {
  const key = '様からのご返信内容：';
  const start = rawText.indexOf(key);
  if (start === -1) return { body: '', info: {} };
  const normalized = rawText.slice(start + key.length).replace(/\r\n/g, '\n');

  const endMarkers = ['差出人', 'お客様のメールアドレスは'];
  let end = normalized.length;
  for (const m of endMarkers) {
    const idx = normalized.indexOf(m);
    if (idx !== -1 && idx < end) end = idx;
  }

  const bodyPart = normalized.slice(0, end).trim();
  const body = bodyPart
    .split('\n')
    .filter(l => l.trim() !== '')
    .join('\n');

  const tail = normalized.slice(end);
  const info = {};
  const emailMatch = tail.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  if (emailMatch) info.customer_email = emailMatch[0];
  const methodMatch = tail.match(/問合せ方法：(.+)/);
  if (methodMatch) info.inquiry_method = methodMatch[1].trim();
  const contentMatch = tail.match(/問合せ内容：(.+)/);
  if (contentMatch) info.inquiry_content = contentMatch[1].trim();
  const carMatch = tail.match(/依頼車種：(.+)/);
  if (carMatch) info.request_car = carMatch[1].trim();

  return { body, info };
}

function getImapConfig() {
  return {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993'),
    tls: true
  };
}

function getDateKey(item) {
  if (item.date) return item.date.replace(/\//g, '');
  if (item.order_id) return item.order_id.slice(0, 8);
  return '';
}

// 注文IDを生成する関数（日時＋ランダム文字列）
function genOrderId() {
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const ymdhms = now.toISOString().replace(/[-T:Z.]/g, '').slice(0, 14);
  const rand = Math.random().toString(36).substring(2, 6);
  return `${ymdhms}-${rand}`;
}

// 顧客一覧を取得
app.get('/customers', async (req, res) => {
  try {
    const data = await ddb.send(new ScanCommand({ TableName: TABLE }));
    res.json(data.Items || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// 条件に一致する顧客を検索
app.get('/customers/search', async (req, res) => {
  const { name, phone, email, id } = req.query;
  if (!name && !phone && !email && !id) {
    return res.status(400).json({ error: 'Missing query' });
  }
  try {
    let base = { name, phone, email };
    if (id && (!name || !phone || !email)) {
      const cur = await ddb.send(new GetCommand({ TableName: TABLE, Key: { order_id: id } }));
      if (cur.Item) {
        if (!base.name) base.name = cur.Item.name;
        if (!base.phone) base.phone = cur.Item.phone || cur.Item.phoneNumber;
        if (!base.email) base.email = cur.Item.email;
      }
    }

    const values = {};
    const conditions = [];

    if (base.name) {
      conditions.push('#n = :name');
      values[':name'] = base.name;
    }
    if (base.phone) {
      conditions.push('(phone = :phone OR phoneNumber = :phone)');
      values[':phone'] = base.phone;
    }
    if (base.email) {
      conditions.push('email = :email');
      values[':email'] = base.email;
    }

    let filterExpression = conditions.length ? conditions.join(' OR ') : '';
    if (id) {
      values[':id'] = id;
      filterExpression = filterExpression
        ? `(${filterExpression}) AND order_id <> :id`
        : 'order_id <> :id';
    }

    const params = {
      TableName: TABLE,
      FilterExpression: filterExpression,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: { '#n': 'name' }
    };

    const data = await ddb.send(new ScanCommand(params));
    const items = (data.Items || []).sort((a, b) =>
      getDateKey(b).localeCompare(getDateKey(a))
    );
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// 本日の未済タスクを要約
app.get('/summary', async (req, res) => {
  try {
    const data = await ddb.send(new ScanCommand({ TableName: TABLE }));
    const items = data.Items || [];
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '/');
    const tasks = items.filter(
      t => (t.date === today || t.order_id?.startsWith(today.replace(/\//g, '')))
        && (t.status || '') === '未済'
    );
    const lines = tasks.map(t => `${t.name || '不明'}さん: ${t.details || ''}`);
    const baseSummary = lines.join('\n');

    const key = process.env.OPENAI_API_KEY;
    if (!key) {
      return res.json({ summary: baseSummary });
    }

    const prompt = `以下は本日未完了のタスク一覧です。箇条書きの内容を要約してください。\n${baseSummary}`;
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo-0125',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    });
    const json = await response.json();
    const summary =
      json.choices && json.choices[0] && json.choices[0].message.content;
    res.json({ summary: summary || baseSummary });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to summarize' });
  }
});

// 顧客を新規追加
app.post('/customers', async (req, res) => {
  const item = {
    order_id: genOrderId(),
    status: req.body.status || '未済',
    email: req.body.email || '',
    name: req.body.name || '',
    kana: req.body.kana || '',
    type: req.body.category || req.body.type || '',
    details: req.body.details || '',
    date: req.body.date || new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().split('T')[0].replace(/-/g, '/'),
    staff: req.body.staff || '',
    phone: req.body.phoneNumber || req.body.phone || '',
    history: req.body.history || {},
    draft: !!req.body.draft
  };
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.status(201).json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create' });
  }
});

// 特定顧客を取得
app.get('/customers/:id', async (req, res) => {
  try {
    const data = await ddb.send(new GetCommand({
      TableName: TABLE,
      Key: { order_id: req.params.id }
    }));
    if (!data.Item) return res.sendStatus(404);
    res.json(data.Item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch' });
  }
});

// 顧客を更新
app.put('/customers/:id', async (req, res) => {
  const fields = {
    status: req.body.status,
    email: req.body.email,
    name: req.body.name,
    kana: req.body.kana,
    type: req.body.category || req.body.type,
    details: req.body.details,
    date: req.body.date,
    staff: req.body.staff,
    phone: req.body.phoneNumber || req.body.phone,
    history: req.body.history,
    draft: req.body.draft
  };

  const sets = [];
  const values = {};
  const names = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) {
      names[`#${key}`] = key;
      values[`:${key}`] = value;
      sets.push(`#${key} = :${key}`);
    }
  }

  if (!sets.length) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  const params = {
    TableName: TABLE,
    Key: { order_id: req.params.id },
    UpdateExpression: 'SET ' + sets.join(', '),
    ExpressionAttributeNames: names,
    ExpressionAttributeValues: values,
    ReturnValues: 'ALL_NEW'
  };

  try {
    const result = await ddb.send(new UpdateCommand(params));
    res.json(result.Attributes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update' });
  }
});

// 顧客を削除
app.delete('/customers/:id', async (req, res) => {
  try {
    await ddb.send(new DeleteCommand({
      TableName: TABLE,
      Key: { order_id: req.params.id }
    }));
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// グーバイク追加連絡メールを取得して保存
app.get('/api/fetch-email', async (req, res) => {
  const imap = new Imap(getImapConfig());
  const targetSubject = '【グーバイク】追加のご連絡';

  imap.once('ready', () => {
    imap.openBox('INBOX', false, (err, box) => {
      if (err) {
        imap.end();
        return respondError(res, 500, 'Failed to open mailbox', err);
      }
      imap.search([['HEADER', 'SUBJECT', targetSubject]], (err, results) => {
        if (err) {
          imap.end();
          return respondError(res, 500, 'Failed to search mailbox', err);
        }
        if (!results.length) {
          imap.end();
          return res.json({ message: 'No matching emails.' });
        }
        const f = imap.fetch(results.slice(-1), { bodies: '' });
        f.on('message', msg => {
          msg.on('body', stream => {
            simpleParser(stream, async (err, mail) => {
              if (err) {
                imap.end();
                return respondError(res, 500, 'Failed to parse email', err);
              }

              const match = mail.subject.match(/\[(UB\d+)\]/);
              const inquiryId = match ? match[1] : 'UNKNOWN';
              const customerEmail =
                mail.from && mail.from.value && mail.from.value[0]
                  ? mail.from.value[0].address
                  : '';
              const nameMatch = mail.subject.match(/([^\s]+)\s*様/);
              const customerName = nameMatch ? nameMatch[1] : 'UNKNOWN';
              const { body: cleanBody, info } = extractGoobikeSections(mail.text || '');

              const item = {
                inquiry_id: inquiryId,
                name: customerName,
                email: info.customer_email || customerEmail,
                from_email: customerEmail,
                body: cleanBody,
                inquiry_method: info.inquiry_method,
                inquiry_content: info.inquiry_content,
                request_car: info.request_car,
                createdAt: new Date().toISOString()
              };

              try {
                await dynamo
                  .put({
                    TableName: GOOBIKE_TABLE,
                    Item: item,
                    ConditionExpression: 'attribute_not_exists(inquiry_id)'
                  })
                  .promise();
                res.json({ status: 'saved', item });
              } catch (e) {
                if (e.code === 'ConditionalCheckFailedException') {
                  res.json({ status: 'duplicate', inquiryId });
                } else {
                  respondError(
                    res,
                    500,
                    'Failed to save email to DynamoDB',
                    e
                  );
                }
              } finally {
                imap.end();
              }
            });
          });
        });
      });
    });
  });

  imap.once('error', err => {
    respondError(res, 500, 'IMAP connection error', err);
  });

  imap.connect();
});

// グーバイク追加連絡データ取得
app.get('/goobike-emails', async (req, res) => {
  try {
    const data = await dynamo
      .scan({ TableName: GOOBIKE_TABLE })
      .promise();
    const items = (data.Items || []).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    res.json(items);
  } catch (err) {
    respondError(res, 500, 'Failed to fetch emails from DynamoDB', err);
  }
});

module.exports = app;
