const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'sample.csv');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

function parseCSV(data) {
  const lines = data.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = values[i] || '';
    });
    return obj;
  });
}

function stringifyCSV(records) {
  if (!records.length) return '';
  const headers = Object.keys(records[0]);
  const lines = [headers.join(',')];
  for (const r of records) {
    const line = headers.map(h => r[h] || '').join(',');
    lines.push(line);
  }
  return lines.join('\n');
}

function readData() {
  if (!fs.existsSync(DATA_FILE)) return [];
  const input = fs.readFileSync(DATA_FILE, 'utf8');
  return parseCSV(input);
}

function writeData(records) {
  const csv = stringifyCSV(records);
  fs.writeFileSync(DATA_FILE, csv);
}

app.get('/customers', (req, res) => {
  const records = readData();
  res.json(records);
});

app.post('/customers', (req, res) => {
  const records = readData();
  const item = req.body;
  item.id = Date.now().toString();
  records.push(item);
  writeData(records);
  res.status(201).json(item);
});

app.get('/customers/:id', (req, res) => {
  const records = readData();
  const item = records.find(r => r.id === req.params.id);
  if (!item) return res.sendStatus(404);
  res.json(item);
});

app.put('/customers/:id', (req, res) => {
  const records = readData();
  const index = records.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.sendStatus(404);
  records[index] = { ...records[index], ...req.body, id: req.params.id };
  writeData(records);
  res.json(records[index]);
});

app.delete('/customers/:id', (req, res) => {
  let records = readData();
  const index = records.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.sendStatus(404);
  const item = records.splice(index, 1)[0];
  writeData(records);
  res.json(item);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
