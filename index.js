const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const extractZip = require('extract-zip');
const fs = require('fs').promises;
const path = require('path');

const port = 8002;
const app = express();

app.use(bodyParser.raw({ type: 'application/zip' }));
app.use(cors());
app.use(express.static('public'));

app.post('/cal', async (req, res) => {
  try {
    // Write temp calendar zip file from request body
    const file = path.join(__dirname, 'cal.zip');
    await fs.writeFile(file, req.body, 'binary');

    // Extract calendar from zip
    await extractZip(file, { dir: path.join(__dirname, 'public') });

    // Remove temp file
    await fs.unlink(file);

    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(500);
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});
