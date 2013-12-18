'use strict';

var Mincer = require('mincer'),
    _ = require('underscore'),
    uglifyjs = require('uglify-js'),
    csso = require('csso'),
    fs = require('fs'),
    zlib = require('zlib'),
    async = require('async'),
    wrench = require('wrench'),
    mountPoint = '/assets'
;

// remove existing manifest/assets if it exists
if (fs.existsSync('./public/assets')) {
  wrench.rmdirSyncRecursive('./public/assets');
}

var environment = new Mincer.Environment('./');

environment.registerHelper('version', function() {
  return require(__dirname + '/../../../package.json').version;
});

environment.registerHelper('asset_path', function(name, opts) {
  var asset = environment.findAsset(name, opts);
  if (!asset){
    throw new Error("File [" + name + "] not found");
  }

  return mountPoint + '/' + asset.digestPath;
});

environment.jsCompressor = 'uglify';
environment.cssCompressor = 'csso';

[
  'assets/images',
  'assets/css',
  'assets/js',
  'vendor/css',
  'vendor/js'
].forEach(function(path) {
  environment.appendPath(path);
});

var manifest = new Mincer.Manifest(environment, './public/assets');

console.info('Starting asset compilation');

manifest.compile(['*', '*/**'], function(err, manifestData) {

  if (err) {
    console.error("Failed compile assets: " + (err.message || err.toString()));
    process.exit(128);
  }

  if (!manifestData) {
    console.info('No assets to compile');
  } else {
    var files = _(manifestData.files).keys();

    // gzip each file into a .gz file in the same directory
    async.each(files, function(file, done) {
      var gzip = zlib.createGzip({
        level: 9
      });
      var inp = fs.createReadStream('./public/assets/' + file);
      var out = fs.createWriteStream('./public/assets/' + file + '.gz');
      inp.pipe(gzip).pipe(out).on('close', function() {
        done();
      });
    }, function() {
      console.info('Finished compiling ' + files.length + ' assets');
    });
  }
});

