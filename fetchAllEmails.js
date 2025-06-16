require('dotenv').config();
const Imap = require('imap');
const { simpleParser } = require('mailparser');

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

    const update = () => {
      process.stdout.write(
        `\r${frames[frame++ % frames.length]} Fetching emails ${count}/${total}`
      );
    };

    imap.once('ready', () => {
      imap.openBox('INBOX', true, (err, box) => {
        if (err) return reject(err);

        imap.search(['ALL'], (err, results) => {
          if (err) return reject(err);
          if (!results || results.length === 0) {
            return resolve([]);
          }

          total = results.length;
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
            reject(err);
          });

          f.once('end', () => {
            clearInterval(spinnerInterval);
            process.stdout.write(`\rFetched emails ${count}/${total}\n`);
            imap.end();
            resolve(mails);
          });
        });
      });
    });

    imap.once('error', err => {
      clearInterval(spinnerInterval);
      process.stdout.write('\n');
      reject(err);
    });

    imap.connect();
  });
}

fetchAllMails()
  .then(mails => {
    console.log(`Total fetched: ${mails.length}`);
  })
  .catch(err => {
    console.error('Error fetching emails', err);
    process.exit(1);
  });
