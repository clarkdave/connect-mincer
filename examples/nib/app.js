'use strict';

var express = require('express'),
    env = process.env.NODE_ENV,
    ConnectMincer = require('../../')
;

var app = express();

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

mincer.Mincer.StylusEngine.configure(function(style) {
  style.use(require('nib')());
});

app.use(mincer.assets());

if (env === 'production' || env === 'staging') {
  app.use(express.static(__dirname + '/public'));
} else {
  // in dev, just use the normal server which recompiles assets as needed
  app.use('/assets', mincer.createServer());
}

app.set('port', process.env.PORT || 9000);
app.set('view engine', 'ejs');

app.get('/', function(req, res) {
  res.render('index.ejs');
});

app.listen(app.get('port'), function() {
  console.info('Express app started on ' + app.get('port'));
});