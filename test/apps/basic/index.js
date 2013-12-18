'use strict';

var express = require('express'),
    ConnectMincer = require('../../../')
;

var app = express();

var mincer = new ConnectMincer({
  root: __dirname,
  paths: [
    'assets/img',
    'assets/css',
    'assets/js',
    'vendor/css',
    'vendor/js'
  ],
});

app.use(mincer.assets());
app.use('/assets', mincer.createServer());

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

app.get('/', function(req, res) {
  res.render('index.ejs');
});

app.use(function(err, req, res, next) {
  console.error(err);
  next();
});


module.exports = app;