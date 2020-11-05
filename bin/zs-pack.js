#! /usr/bin/env node

let path = require('path');
let Compiler = require('../lib/Compiler.js');

let config = require(path.resolve('webpack.config.js'));
let compiler = new Compiler(config);
compiler.run();