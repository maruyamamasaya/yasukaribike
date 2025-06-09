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
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

const TABLE = process.env.TABLE_NAME || 'kokyakukanri_TBL';

const client = new DynamoDBClient({});
const ddb = DynamoDBDocumentClient.from(client);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

function getDateKey(item) {
  if (item.date) return item.date.replace(/\//g, '');
  if (item.order_id) return item.order_id.slice(0, 8);
  return '';
}

// 注文IDを生成する関数（日時＋ランダム文字列）
function genOrderId() {
  const now = new Date();
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
    const data = await ddb.send(new ScanCommand({ TableName: TABLE }));
    let items = data.Items || [];
    items = items.filter(c =>
      (base.name && c.name === base.name) ||
      (base.phone && (c.phone === base.phone || c.phoneNumber === base.phone)) ||
      (base.email && c.email === base.email)
    );
    if (id) items = items.filter(c => c.order_id !== id);
    items.sort((a, b) => getDateKey(b).localeCompare(getDateKey(a)));
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// 顧客を新規追加
app.post('/customers', async (req, res) => {
  const item = {
    order_id: genOrderId(),
    status: req.body.status || '未済',
    email: req.body.email || '',
    name: req.body.name || '',
    type: req.body.category || req.body.type || '',
    details: req.body.details || '',
    date: req.body.date || new Date().toISOString().split('T')[0].replace(/-/g, '/'),
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
  const item = {
    order_id: req.params.id,
    status: req.body.status || '未済',
    email: req.body.email || '',
    name: req.body.name || '',
    type: req.body.category || req.body.type || '',
    details: req.body.details || '',
    date: req.body.date || '',
    staff: req.body.staff || '',
    phone: req.body.phoneNumber || req.body.phone || '',
    history: req.body.history || {}
  };
  try {
    await ddb.send(new PutCommand({ TableName: TABLE, Item: item }));
    res.json(item);
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
