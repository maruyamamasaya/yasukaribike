require('dotenv').config();
const fs = require('fs');
const Imap = require('imap');
const AWS = require('aws-sdk');
const { simpleParser } = require('mailparser');

function htmlToText(html) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const logStream = fs.createWriteStream('fetchAllEmails.log', { flags: 'a' });
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  logStream.write(line + '\n');
}

const region = process.env.AWS_REGION || 'ap-northeast-1';
AWS.config.update({ region });
const dynamo = new AWS.DynamoDB.DocumentClient();

function getMailTable(index = 1) {
  const suffix = index === 1 ? '1' : String(index);
  return (
    process.env[`MAIL_TABLE${suffix}`] ||
    process.env.MAIL_TABLE ||
    process.env.GOOBIKE_TABLE ||
    'Rebikele_goobikemail01_TBL'
  );
}

// Only fetch messages received on or after this date
const SINCE_DATE = new Date('2025-05-01');

// Folders to completely skip when scanning
const EXCLUDED_FOLDERS = ['INBOX.Junk', 'INBOX.Trash'];

function getAccountEnv(prefix, index) {
  if (index === 1) {
    return process.env[`${prefix}1`] || process.env[prefix];
  }
  return process.env[`${prefix}${index}`];
}

function getImapConfig(index = 1) {
  const user = getAccountEnv('EMAIL_USER', index);
  const pass = getAccountEnv('EMAIL_PASS', index);
  const host = getAccountEnv('IMAP_HOST', index);
  const port = parseInt(getAccountEnv('IMAP_PORT', index) || '993', 10);
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

async function saveMail(uid, parsed, body, folder, account) {
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
    body,
  };
  try {
    await dynamo
      .put({
        TableName: getMailTable(account),
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
          const f = imap.fetch(results, { bodies: ['BODY[]'] });

          f.on('message', msg => {
            const chunks = [];
            let uid;
            msg.once('attributes', attrs => {
              uid = attrs.uid;
            });
            msg.on('body', stream => {
              stream.on('data', chunk => {
                chunks.push(chunk);
              });
            });
            msg.once('end', async () => {
              try {
                const parsed = await simpleParser(Buffer.concat(chunks));
                let body = parsed.text || '';
                if (!body && parsed.html) {
                  body = htmlToText(parsed.html);
                }
                if (!body) {
                  log(`No body content for UID ${uid} in ${name}`);
                  if (parsed.headerLines) {
                    log(`Headers: ${JSON.stringify(parsed.headerLines)}`);
                  }
                  if (parsed.attachments && parsed.attachments.length) {
                    log(`Attachments: ${parsed.attachments.length}`);
                  }
                }
                await saveMail(uid, parsed, body, name, accountIndex);
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
    const user = getAccountEnv('EMAIL_USER', i);
    const pass = getAccountEnv('EMAIL_PASS', i);
    const host = getAccountEnv('IMAP_HOST', i);
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

module.exports = { fetchAllEmails, getAccountEnv };
