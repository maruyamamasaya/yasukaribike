require('dotenv').config();
const fs = require('fs');
const Imap = require('imap');
const AWS = require('aws-sdk');
const { simpleParser } = require('mailparser');

const logStream = fs.createWriteStream('fetchAllEmails.log', { flags: 'a' });
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  logStream.write(line + '\n');
}

const region = process.env.AWS_REGION || 'ap-northeast-1';
AWS.config.update({ region });
const dynamo = new AWS.DynamoDB.DocumentClient();
const MAIL_TABLE = process.env.MAIL_TABLE || 'Rebikele_goobikemail01_TBL';

function getImapConfig() {
  return {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    tls: true,
  };
}

const FOLDERS = [
  'INBOX',
  'グーバイク/予約報告',
  'グーバイク/仮予約受付',
  'グーバイク/回答依頼',
  'グーバイク/見送りのお知らせ',
  'グーバイク/追加連絡',
];

async function saveMail(uid, parsed) {
  const item = {
    unique_id: String(uid),
    to: parsed.to ? parsed.to.text : '',
    date: parsed.date ? parsed.date.toISOString() : null,
    body: parsed.text || '',
  };
  await dynamo.put({ TableName: MAIL_TABLE, Item: item }).promise();
}

function processFolder(name) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());

    imap.once('ready', () => {
      log(`Opening folder: ${name}`);
      imap.openBox(name, true, (err, box) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        imap.search(['ALL'], (err, results) => {
          if (err) {
            imap.end();
            return reject(err);
          }

          if (!results || !results.length) {
            log(`No emails in ${name}`);
            imap.end();
            return resolve();
          }

          log(`Fetching ${results.length} emails from ${name}`);
          const f = imap.fetch(results, { bodies: '' });

          f.on('message', msg => {
            let raw = '';
            let uid;
            msg.once('attributes', attrs => {
              uid = attrs.uid;
            });
            msg.on('body', stream => {
              stream.on('data', chunk => {
                raw += chunk.toString('utf8');
              });
            });
            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(raw);
                await saveMail(uid, parsed);
                log(`Saved mail UID ${uid} from ${name}`);
              } catch (e) {
                log(`Error processing UID ${uid}: ${e.message}`);
              }
            });
          });

          f.once('error', err => {
            imap.end();
            reject(err);
          });

          f.once('end', () => {
            imap.end();
            resolve();
          });
        });
      });
    });

    imap.once('error', err => {
      reject(err);
    });

    imap.connect();
  });
}

async function fetchAllEmails() {
  for (const folder of FOLDERS) {
    try {
      await processFolder(folder);
    } catch (e) {
      log(`Error fetching folder ${folder}: ${e.message}`);
    }
  }
  log('All folders processed');
}

if (require.main === module) {
  fetchAllEmails().catch(err => {
    log(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { fetchAllEmails };
