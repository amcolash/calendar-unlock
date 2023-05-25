const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const extractZip = require('extract-zip');
const fs = require('fs');
const path = require('path');
const ICAL = require('ical.js');

const PORT = 8002;
const app = express();

// Make public dir if it doesn't exist
if (!fs.existsSync('public')) fs.mkdirSync('public');

// Set up express server
app.use(bodyParser.raw({ type: 'application/zip', limit: '50mb' }));
app.use(cors());
app.use(express.static('public'));

// HTTPS setup
const credentials = {};
if (fs.existsSync('./.cert/RSA-privkey.pem')) credentials.key = fs.readFileSync('./.cert/RSA-privkey.pem');
else if (fs.existsSync('./.cert/privkey.pem')) credentials.key = fs.readFileSync('./.cert/privkey.pem');

// Try to fix let's encrypt stuff based on this post
// https://community.letsencrypt.org/t/facebook-dev-error-curl-error-60-ssl-cacert/72782
if (fs.existsSync('./.cert/RSA-fullchain.pem')) {
  credentials.cert = fs.readFileSync('./.cert/RSA-fullchain.pem');
} else if (fs.existsSync('./.cert/RSA-cert.pem')) {
  credentials.cert = fs.readFileSync('./.cert/RSA-cert.pem');
} else if (fs.existsSync('./.cert/cert.pem')) {
  credentials.cert = fs.readFileSync('./.cert/cert.pem');
}

// Make the server
if (credentials.cert && credentials.key) {
  const server = require('https').createServer(credentials, app);
  server.listen(PORT, '0.0.0.0');
  console.log(`Server running on port ${PORT} (HTTPS)`);
} else {
  console.error("Couldn't find TLS certs, this server expects to run on HTTPS");
  process.exit(1);
}

app.post('/cal', async (req, res) => {
  try {
    // Write temp calendar zip file from request body
    const file = path.join(__dirname, 'cal.zip');
    await fs.promises.writeFile(file, req.body, 'binary');

    const public = path.join(__dirname, 'public');

    // Extract calendar from zip
    const files = [];
    await extractZip(file, {
      dir: public,
      onEntry: (entry, zipfile) => {
        files.push(entry.fileName);
      },
    });

    // There should only ever be one file in the zip, so this shouldn't be a concurrency issue (assuming just me using it)
    for (const f of files) {
      const calFile = path.join(public, f);

      // Copy original file and rename original to use with python script
      const backup = calFile.replace('.ics', '_orig.ics');
      await fs.promises.copyFile(calFile, backup);

      try {
        await filterIcal(calFile);
      } catch (e) {
        // If things fail, just rename the original file back
        console.log('Error in ical processing, exit:', e, e.stack);
        await fs.promises.rename(backup, calFile);
      } finally {
        await fs.promises.rm(backup);
      }
    }

    // Remove temp file
    await fs.promises.unlink(file);

    console.log(`${new Date().toLocaleString()}: Calendar file updated`);

    res.sendStatus(200);
  } catch (err) {
    console.error(`${new Date().toLocaleString()}: ${err}\n${err.stack}`);
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.send('Please POST to the /cal endpoint to update and GET from /filename.ical');
});

/** Filtering code */

const user = 'amcolash@salesforce.com';
const filter = ['Lunch'];

async function filterIcal(file) {
  const data = fs.readFileSync(file, 'utf8');

  const ical = ICAL.parse(data);

  console.log(`${new Date().toLocaleString()}: Events before filtering: ${ical[2].length}`);

  ical[2] = ical[2].filter((event, i) => {
    if (event[0] === 'vevent') {
      const attendees = event[1].filter((e) => e[0] === 'attendee');

      const me = attendees.find((a) => a[1].cn === user);
      if (me && me[1].partstat === 'DECLINED') return false;

      const summarySection = event[1].find((e) => e[0] === 'summary');

      if (summarySection) {
        const summary = summarySection[3];
        for (const f of filter) {
          if (summary.toLowerCase().includes(f.toLowerCase())) {
            return false;
          }
        }
      }
    }

    return true;
  });

  const comp = new ICAL.Component(ical);
  await fs.promises.writeFile(file, comp.toString(), 'utf8');

  console.log(`${new Date().toLocaleString()}: Events after filtering: ${ical[2].length}`);
}
