require('dotenv').config();
const Imap = require('imap');
const { simpleParser } = require('mailparser');
const AWS = require('aws-sdk');

const TABLE = process.env.MAIL_TABLE || 'Rebikele_goobikemail01_TBL';
const REGION = process.env.AWS_REGION || 'ap-northeast-1';
const dynamo = new AWS.DynamoDB.DocumentClient({ region: REGION });

function imapConfig() {
  return {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.IMAP_HOST,
    port: Number(process.env.IMAP_PORT || 993),
    tls: true,
  };
}

const FOLDER_CATEGORIES = {
  INBOX: 'inbox',
  'グーバイク': 'goobike',
};

function categorize(folder, mail) {
  if (FOLDER_CATEGORIES[folder]) return FOLDER_CATEGORIES[folder];
  if ((mail.subject || '').includes('回答依頼')) return 'answer_request';
  return folder;
}

async function save(uid, mail, folder) {
  const item = {
    unique_id: String(uid),
    folder,
    category: categorize(folder, mail),
    subject: mail.subject || '',
    from: mail.from ? mail.from.text : '',
    to: mail.to ? mail.to.text : '',
    date: mail.date ? mail.date.toISOString() : null,
    body: mail.text || '',
  };
  await dynamo.put({ TableName: TABLE, Item: item }).promise();
}

function fetchFolder(folder) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig());
    imap.once('ready', () => {
      imap.openBox(folder, true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }
        imap.search(['ALL'], (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }
          if (!results.length) {
            imap.end();
            return resolve();
          }
          const f = imap.fetch(results, { bodies: '' });
          f.on('message', msg => {
            let raw = '';
            let uid;
            msg.once('attributes', attrs => { uid = attrs.uid; });
            msg.on('body', stream => {
              stream.on('data', chunk => { raw += chunk.toString('utf8'); });
            });
            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(raw);
                await save(uid, parsed, folder);
              } catch (e) {
                console.error('Parse error', e.message);
              }
            });
          });
          f.once('end', () => { imap.end(); resolve(); });
        });
      });
    });
    imap.once('error', err => reject(err));
    imap.connect();
  });
}

async function listCategories() {
  const data = await dynamo.scan({
    TableName: TABLE,
    ProjectionExpression: '#c',
    ExpressionAttributeNames: { '#c': 'category' },
  }).promise();
  const counts = {};
  for (const item of data.Items || []) {
    const cat = item.category || 'none';
    counts[cat] = (counts[cat] || 0) + 1;
  }
  console.log(counts);
}

async function main() {
  const arg = process.argv[2];
  if (arg === 'categories') return listCategories();
  const folders = ['INBOX', 'グーバイク'];
  for (const f of folders) {
    await fetchFolder(f).catch(e => console.error('Fetch error', e.message));
  }
  console.log('done');
}

if (require.main === module) {
  main().catch(err => {
    console.error('Fatal', err);
    process.exit(1);
  });
}
