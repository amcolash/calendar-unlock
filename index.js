const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const extractZip = require('extract-zip');
const fs = require('fs');
const path = require('path');
const spawn = require('await-spawn');

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
      await fs.promises.copyFile(calFile, calFile.replace('.ics', '_orig.ics'));
      await fs.promises.rename(calFile, path.join(public, 'in.ics'));

      try {
        // Run python script to filter out old events
        const python = await spawn('python3', [path.join(__dirname, 'icalfilter.py')]);
        console.log(python.toString());

        // Remove temp file and rename output back to original name
        await fs.promises.unlink(path.join(public, 'in.ics'));
        await fs.promises.rename(path.join(public, 'out.ics'), calFile);
      } catch (e) {
        // If things fail, just rename the original file back
        console.log('Error in ical processing, exit:', e.code, '\n', e.stdout.toString(), e.stderr.toString());
        await fs.promises.rename(path.join(public, 'in.ics'), calFile);
      }
    }

    // Remove temp file
    await fs.promises.unlink(file);

    console.log(`${new Date().toLocaleString()}: Calendar file updated`);

    res.sendStatus(200);
  } catch (err) {
    console.error(`${new Date().toLocaleString()}: ${err}`);
    res.sendStatus(500);
  }
});

app.get('/', (req, res) => {
  res.send('Please POST to the /cal endpoint to update and GET from /filename.ical');
});
