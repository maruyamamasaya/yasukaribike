require('dotenv').config();
const fs = require('fs');
const Imap = require('imap');
const { simpleParser } = require('mailparser');

const FROM_ADDRESS = 'goobike_reserve@goobike.com';

const logStream = fs.createWriteStream('fetchAllEmails.log', { flags: 'a' });
function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  logStream.write(line + '\n');
}

function getImapConfig() {
  return {
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASS,
    host: process.env.IMAP_HOST,
    port: parseInt(process.env.IMAP_PORT || '993', 10),
    tls: true,
  };
}

function fetchAllMails() {
  return new Promise((resolve, reject) => {
    const imap = new Imap(getImapConfig());
    const mails = [];
    let count = 0;
    let total = 0;
    let spinnerInterval;
    const frames = ['|', '/', '-', '\\'];
    let frame = 0;

    log('Connecting to IMAP server');

    const update = () => {
      process.stdout.write(
        `\r${frames[frame++ % frames.length]} Fetching emails ${count}/${total}`
      );
    };

    imap.once('ready', () => {
    log('IMAP connection ready, opening INBOX');
    imap.openBox('INBOX', true, (err, box) => {
      if (err) return reject(err);

        log(`Searching for messages from ${FROM_ADDRESS}`);
        imap.search(['ALL', ['FROM', FROM_ADDRESS]], (err, results) => {
          if (err) return reject(err);
          if (!results || results.length === 0) {
            log('No emails found');
            imap.end();
            return resolve([]);
          }

          total = results.length;
          log(`Fetching ${total} emails`);
          spinnerInterval = setInterval(update, 100);
          update();

          const f = imap.fetch(results, { bodies: '' });

          f.on('message', msg => {
            let raw = '';
            msg.on('body', stream => {
              stream.on('data', chunk => {
                raw += chunk.toString('utf8');
              });
            });
            msg.once('end', async () => {
              count += 1;
              log(`Fetched message ${count} of ${total}`);
              try {
                const parsed = await simpleParser(raw);
                mails.push(parsed);
              } catch (e) {
                mails.push({ error: e.message, raw });
              }
            });
          });

          f.once('error', err => {
            clearInterval(spinnerInterval);
            process.stdout.write('\n');
            log(`Fetch error: ${err.message}`);
            reject(err);
          });

          f.once('end', () => {
            clearInterval(spinnerInterval);
            process.stdout.write(`\rFetched emails ${count}/${total}\n`);
            log(`Finished fetching ${count} emails`);
            imap.end();
            resolve(mails);
          });
        });
      });
    });

    imap.once('error', err => {
      clearInterval(spinnerInterval);
      process.stdout.write('\n');
      log(`Connection error: ${err.message}`);
      reject(err);
    });

    imap.connect();
  });
}

fetchAllMails()
  .then(mails => {
    log(`Total fetched: ${mails.length}`);
  })
  .catch(err => {
    log(`Error fetching emails: ${err.message}`);
    process.exit(1);
  });
