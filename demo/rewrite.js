#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const rewrite = require('../rewrite.js');

const p = path.join(__dirname, 'module.html');

rewrite(fs.readFileSync(p)).then(console.info)
