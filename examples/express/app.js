'use strict';

var express = require('express'),
    env = process.env.NODE_ENV,
    ConnectMincer = require('../../')
;

var app = express();

// set up connect-mincer middleware
var mincer = new ConnectMincer({
  root: __dirname,
  production: env === 'production' || env === 'staging',
  mountPoint: '/assets',
  manifestFile: __dirname + '/public/assets/manifest.json',
  paths: [
    'assets/images',
    'assets/css',
    'assets/js',
    'vendor/css',
    'vendor/js'
  ]
});

// the main connectMincer middleware, which sets up a Mincer Environment and provides view helpers
app.use(mincer.assets());

// this will set up a Mincer server listening on /assets, which will serve the compiled
// version of assets. If the production flag is set on connectMincer, this server will
// only serve assets that can be found in the manifestFile - so it is suitable for
// production use and is similar to the connect.static() middleware
// 
// even so, it is generally recommended to *not* run this server in production, and instead
// have a web-server like nginx serve all requests for things in the /public directory
app.use('/assets', mincer.createServer());

// you can get the mincer environment directly, so you could add your own helpers to it
var mincerEnv = mincer.environment;

app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');

app.get('/', function(req, res) {
  res.render('home.ejs');
});

app.listen(app.get('port'));
console.info('Express app started on ' + app.get('port'));