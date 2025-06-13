const express = require('express');
const path = require('path');
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

const app = express();

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
        model: 'gpt-3.5-turbo',
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
    history: req.body.history || {}
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
    history: req.body.history
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

module.exports = app;
