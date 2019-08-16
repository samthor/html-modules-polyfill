#!/usr/bin/env node

const fs = require('fs');
const polka = require('polka');
const dhost = require('dhost');
const rewrite = require('../rewrite.js');

polka()
  .get('/module', async (req, res) => {

    try {
      const data = fs.readFileSync('module.html', 'utf8');

      const start = process.hrtime();

      const parsed = await rewrite(data);

      const duration = process.hrtime(start);
      const ms = ((duration[0] + (duration[1] / 1e9)) * 1e3).toFixed(3);
      console.debug('rewrite of module.html tool', ms + 'ms');

      res.writeHead(200, {'Content-Type': 'application/javascript'});
      res.end(parsed);
    } catch (e) {
      console.warn(e);
      res.writeHead(500);
      res.end();
    }
  })
  .use(dhost())
  .listen(3000, (err) => {
    if (err) {
      throw err;
    }
    console.log(`> Running on localhost:3000`);
  });