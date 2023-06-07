#!/usr/bin/env node
const { register } = require('ts-node');
register({swc: true, compilerOptions: {module: 'CommonJS'}});
require('./src').run();
