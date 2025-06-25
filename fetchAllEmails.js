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

function getImapConfig(index = 1) {
  const suffix = index === 1 ? '' : String(index);
  const user =
    process.env[`EMAIL_USER${suffix}`] ||
    (index === 1 ? process.env.EMAIL_USER : undefined);
  const pass =
    process.env[`EMAIL_PASS${suffix}`] ||
    (index === 1 ? process.env.EMAIL_PASS : undefined);
  const host =
    process.env[`IMAP_HOST${suffix}`] ||
    (index === 1 ? process.env.IMAP_HOST : undefined);
  const port = parseInt(
    process.env[`IMAP_PORT${suffix}`] ||
      (index === 1 ? process.env.IMAP_PORT : '993') ||
      '993',
    10,
  );
  if (!user || !pass || !host) {
    throw new Error(`Missing IMAP config for account ${index}`);
  }
  return { user, password: pass, host, port, tls: true };
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


function getAllFolders(index = 1) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig(index));

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

async function saveMail(uid, parsed, folder, account) {
  let category = FOLDER_CATEGORIES[folder] || null;

  if (!category) {
    // Try matching by converting the delimiter (e.g. '.' <-> '/')
    if (folder.includes('/') && FOLDER_CATEGORIES[folder.replace(/\//g, '.')]) {
      category = FOLDER_CATEGORIES[folder.replace(/\//g, '.')];
    } else if (
      folder.includes('.') &&
      FOLDER_CATEGORIES[folder.replace(/\./g, '/')]
    ) {
      category = FOLDER_CATEGORIES[folder.replace(/\./g, '/')];
    }
  }

  if (!category) {
    const delimiter = folder.includes('/')
      ? '/'
      : folder.includes('.')
      ? '.'
      : null;
    if (delimiter) {
      const parts = folder.split(delimiter);
      category = parts[parts.length - 1];
    }
  }
  const uniqueId = `${account}/${folder}:${uid}`;
  const item = {
    unique_id: uniqueId,
    account,
    folder,
    category,
    subject: parsed.subject || '',
    from: parsed.from ? parsed.from.text : '',
    to: parsed.to ? parsed.to.text : '',
    date: parsed.date ? parsed.date.toISOString() : null,
    body: parsed.text || '',
  };
  try {
    await dynamo
      .put({
        TableName: MAIL_TABLE,
        Item: item,
        ConditionExpression: 'attribute_not_exists(unique_id)',
      })
      .promise();
  } catch (e) {
    if (e.code !== 'ConditionalCheckFailedException') throw e;
    // Existing record is kept as-is to preserve flags
  }
}

function processFolder(name, accountIndex) {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig(accountIndex));

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
                await saveMail(uid, parsed, name, accountIndex);
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

function getAccountIndices() {
  const indices = [];
  for (let i = 1; i <= 5; i++) {
    const suffix = i === 1 ? '' : String(i);
    const user =
      process.env[`EMAIL_USER${suffix}`] || (i === 1 ? process.env.EMAIL_USER : undefined);
    const pass =
      process.env[`EMAIL_PASS${suffix}`] || (i === 1 ? process.env.EMAIL_PASS : undefined);
    const host =
      process.env[`IMAP_HOST${suffix}`] || (i === 1 ? process.env.IMAP_HOST : undefined);
    if (user && pass && host) indices.push(i);
  }
  return indices;
}

async function fetchAllEmails(accountIndex) {
  const targets = accountIndex ? [accountIndex] : getAccountIndices();
  for (const idx of targets) {
    log(`Processing account ${idx}`);
    const folders = (await getAllFolders(idx)).filter(
      f => !EXCLUDED_FOLDERS.includes(f)
    );
    for (const folder of folders) {
      try {
        await processFolder(folder, idx);
      } catch (e) {
        log(`Error fetching folder ${folder} (account ${idx}): ${e.message}`);
      }
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
