const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

let customers = [
  {
    id: '1',
    name: 'Yamada Taro',
    email: 'taro@example.com',
    category: '一般',
    phoneNumber: '090-1234-5678',
    status: '未済',
    history: {}
  },
  {
    id: '2',
    name: 'Suzuki Hanako',
    email: 'hanako@example.com',
    category: 'VIP',
    phoneNumber: '090-9876-5432',
    status: '対応済',
    history: { '2023-01-01': '登録' }
  }
];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

app.get('/customers', (req, res) => {
  res.json(customers);
});

app.post('/customers', (req, res) => {
  const item = req.body;
  item.id = Date.now().toString();
  customers.push(item);
  res.status(201).json(item);
});

app.get('/customers/:id', (req, res) => {
  const item = customers.find(r => r.id === req.params.id);
  if (!item) return res.sendStatus(404);
  res.json(item);
});

app.put('/customers/:id', (req, res) => {
  const index = customers.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.sendStatus(404);
  customers[index] = { ...customers[index], ...req.body, id: req.params.id };
  res.json(customers[index]);
});

app.delete('/customers/:id', (req, res) => {
  const index = customers.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.sendStatus(404);
  const item = customers.splice(index, 1)[0];
  res.json(item);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
