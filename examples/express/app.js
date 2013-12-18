'use strict';

var express = require('express'),
    env = process.env.NODE_ENV,
    ConnectMincer = require('../../'),
    Mincer = require('mincer')
;

var app = express();

// set up connect-mincer middleware
var mincer = new ConnectMincer({
  // you can, optionally, pass in your own required Mincer class, so long as it is >= 0.5.0
  mincer: Mincer,
  root: __dirname,
  production: env === 'production' || env === 'staging',
  // uncomment to have view helpers generate urls of the form: //assets.example.com/assets/...
  // assetHost: '//assets.example.com',
  // you'll probably want to get this from a environment-specific config, e.g:
  // assetHost: config.get('asset_host')
  mountPoint: '/assets',
  manifestFile: __dirname + '/public/assets/manifest.json',
  paths: [
    'assets/images',
    'assets/css',
    'assets/js',
    'vendor/css',
    'vendor/js'
  ],
  // precompiling can take a long time: when testing, you may want to turn it off
  precompile: env !== 'test'
});

mincer.environment.registerHelper('version', function() {
  return require(__dirname + '/../../package.json').version;
});

// the main connectMincer middleware, which sets up a Mincer Environment and provides view helpers
app.use(mincer.assets());

if (env === 'production' || env === 'staging') {
  // in production, use the connect static() middleware to serve resources. In a real deployment
  // you'd probably not want this, and would use nginx (or similar) instead
  app.use(express.static(__dirname + '/public'));
} else {
  // in dev, just use the normal server which recompiles assets as needed
  app.use('/assets', mincer.createServer());
}

app.set('port', process.env.PORT || 5000);
app.set('view engine', 'ejs');

app.get('/', function(req, res) {
  res.render('home.ejs');
});

app.listen(app.get('port'), function() {
  console.info('Express app started on ' + app.get('port'));
});