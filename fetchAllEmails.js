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

// Only fetch messages received on or after this date
const SINCE_DATE = new Date('2025-06-01');

// Folders to completely skip when scanning
const EXCLUDED_FOLDERS = ['INBOX.Junk', 'INBOX.Trash'];

function getImapConfig() {
  return {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    tls: true,
  };
}

const FOLDER_CATEGORIES = {
  INBOX: 'inbox',
  'グーバイク': 'goobike',
  'グーバイク/予約報告': 'reserve_notice',
  'グーバイク/仮予約受付': 'tentative',
  'グーバイク/回答依頼': 'answer_request',
  'グーバイク/見送りのお知らせ': 'skip',
  'グーバイク/追加連絡': 'additional',
};


function getAllFolders() {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());

    imap.once('ready', () => {
      imap.getBoxes((err, boxes) => {
        if (err) {
          imap.end();
          return reject(err);
        }

        const folders = [];
        function traverse(prefix, tree) {
          for (const [name, info] of Object.entries(tree)) {
            const path = prefix ? `${prefix}${info.delimiter}${name}` : name;
            folders.push(path);
            if (info.children) {
              traverse(path, info.children);
            }
          }
        }
        traverse('', boxes);
        imap.end();
        resolve(folders);
      });
    });

    imap.once('error', err => {
      reject(err);
    });

    imap.connect();
  });
}

function deriveCategory(folder) {
  if (FOLDER_CATEGORIES[folder]) return FOLDER_CATEGORIES[folder];

  const alt = folder.replace(/\./g, '/');
  if (FOLDER_CATEGORIES[alt]) return FOLDER_CATEGORIES[alt];

  const parts = alt.split('/');
  for (let i = 1; i < parts.length; i++) {
    const sub = parts.slice(i).join('/');
    if (FOLDER_CATEGORIES[sub]) return FOLDER_CATEGORIES[sub];
  }

  return parts[parts.length - 1] || null;
}

async function saveMail(uid, parsed, folder) {
  const category = deriveCategory(folder);
  const item = {
    unique_id: String(uid),
    folder,
    category,
    subject: parsed.subject || '',
    from: parsed.from ? parsed.from.text : '',
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

        imap.search([['SINCE', SINCE_DATE]], (err, results) => {
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
                await saveMail(uid, parsed, name);
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
  const folders = (await getAllFolders()).filter(
    f => !EXCLUDED_FOLDERS.includes(f)
  );
  for (const folder of folders) {
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

module.exports = { fetchAllEmails, saveMail, deriveCategory };
