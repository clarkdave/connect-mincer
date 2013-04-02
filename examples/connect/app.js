'use strict';

var connect = require('connect'),
    env = process.env.NODE_ENV,
    ConnectMincer = require('../../')
;

var app = connect();

var mincer = new ConnectMincer({
  root: __dirname,
  production: env === 'production' || env === 'staging',
  mountPoint: '/assets',
  manifestFile: __dirname + '/public/assets/manifest.json',
  paths: [
    'assets/css'
  ]
});

app.use(mincer.assets());

if (env === 'production' || env === 'staging') {
  // in production, use the connect static() middleware to serve resources. In a real deployment
  // you'd probably not want this, and would use nginx (or similar) instead
  app.use(connect.static(__dirname + '/public'));
} else {
  // in dev, just use the normal server which recompiles assets as needed
  app.use('/assets', mincer.createServer());
}

// To use the view helpers, get them from the ConnectMincer instance directly, using the
// getHelper() method:

var helpers = mincer.getHelpers();

app.use(function(req, res) {
  var out = "<!doctype><html><head>" +
    helpers.css('all.css') +
    "</head><body>" +
    "<h1>This is an app</h1>" +
    "<p>Hello</p>" +
    "</body></html>";

  res.writeHead(200, { 'Content-Type': 'text/html'});
  res.end(out);
});

app.listen(process.env.PORT || 5000, function() {
  console.log('Connect app started');
});