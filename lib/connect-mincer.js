'use strict';

var Mincer = require('mincer'),
    fs = require('fs')
;

var middleware = {};

/**
 * This is the connectMincer module which exposes a few methods to be used by the
 * individual middlewares.
 */
var connectMincer = (function() {

  var options = {},
      assetUrl,
      environment,
      manifest,
      production = false;

  /**
   * Initialize connectMincer with app options
   * 
   * @param  {[type]} opts [description]
   * @return {[type]}      [description]
   */
  var configure = function(opts) {
    options = opts;

    production = opts.production === true ? true : false;

    if (!options.assetUrl) {
      assetUrl = '/assets';
    } else {
      assetUrl = options.assetUrl;
      if (assetUrl.substr(0, 1) !== '/') {
        assetUrl = '/' + assetUrl;
      }
      if (assetUrl.substr(-1) === '/') {
        assetUrl = assetUrl.substr(0, assetUrl.length - 1);
      }
    }

    environment = new Mincer.Environment(options.root);
    
    options.paths.forEach(function(path) {
      environment.appendPath(path);
    });

    // add some helpers
    environment.registerHelper('asset_path', function(name, opts) {
      var asset = environment.findAsset(name, opts);
      if (!asset) throw new Error("File [" + name + "] not found");
      if (production) {
        return toAssetUrl(asset.digestPath);
      } else {
        return toAssetUrl(asset.logicalPath);
      }
    });

    if (production) {
      // in production we use environment.index so any future calls
      // to environment will be cached
      environment = environment.index;

      // in production, we look up assets in the supplied manifest, so let's load that now
      if (fs.existsSync(options.manifestFile)) {
        manifest = require(options.manifestFile);
        if (!manifest.assets) manifest = null;
      }
    }
  };

  var toAssetUrl = function(source) {
    return options.assetUrl + '/' + source;
  };

  var findAssetPaths = function(logicalPath, ext) {
    
    if (production) {
      // we're in production, and have a valid manifest, so instead of using the environment
      // we will get the digestPath directly from the manifest
      // 
      var digestPath;
      if (manifest)
        digestPath = manifest.assets[logicalPath];

      if (!digestPath) {
        // this is bad, and probably means someone forgot to do compile assets before running
        // in production.
        throw new Error("Asset [" + logicalPath + "] has not been compiled");
      }

      return [toAssetUrl(digestPath)];
    }

    // if we're in normal development mode, we should look for the asset in our current environment
    // and return it. It should already be compiled because we force a precompile in dev mode on
    // every request.

    var asset = environment.findAsset(logicalPath),
        paths = []
    ;
    
    if (!asset) return null;

    if (options.production) {
      // in production, return the asset with its digest path
      paths.push(toAssetUrl(asset.digestPath));
    } else if (asset.isCompiled) {
      asset.toArray().forEach(function(a) {
        paths.push(toAssetUrl(a.logicalPath) + '?body=1');
      });
    }

    return paths;
  };

  var helpers = {
    js: function(path) {
      var paths = findAssetPaths(path);

      if (!paths) throw new Error('Javascript asset [' + path + '] not found');

      var tags = paths.map(function(path) {
        return "<script src='" + path + "'></script>";
      });

      return tags.join("\n");
    },

    css: function(path) {
      var paths = findAssetPaths(path);

      if (!paths) throw new Error('CSS asset [' + path + '] not found');

      var tags = paths.map(function(path) {
        return "<link rel='stylesheet' href='" + path + "' />";
      });

      return tags.join("\n");
    },

    asset_path: function(path) {
      var paths = findAssetPaths(path);

      if (!paths) return '';

      // if this returns more than 1 thing just return the first
      return paths[0];
    }
  };

  return {
    configure: configure,
    helpers: helpers,
    getEnvironment: function() { return environment; },
    getManifest: function() { return manifest; },
    isProduction: function() { return production; }
  };

})();

/**
 * Set up the asset middleware.
 * 
 * The asset middleware adds view helpers for loading js and css, and if in development mode
 * will also ensure assets are precompiled and route the mincer assetServer to /assetUrl
 *
 * The following helpers will be available in all views:
 *
 * - js()
 *   Accepts an asset name (e.g. 'app.js') and if found, outputs an appropriate <script> tag
 *
 * - css()
 *   Accepts an asset name (e.g. 'app.css') and if found, outputs an appropriate <link> tag
 *
 * - asset_path()
 *   Accepts an asset name (e.g. 'app.js') and returns the path to the asset. In production, this
 *   path will include the digest.
 * 
 * @return {[type]} Connect middleware which will provide view helpers and precompile on requests in development
 */
middleware.assets = function() {

  if (!connectMincer) throw new Error('Please initialise connect-mincer first!');

  return function(req, res, next) {

    // add helper methods to locals so they're available in views
    res.locals.js = connectMincer.helpers.js;
    res.locals.css = connectMincer.helpers.css;
    res.locals.asset_path = connectMincer.helpers.asset_path;

    if (!connectMincer.isProduction()) {
      // if we're not in production, we should make sure all assets are precompiled
      // on a request as they won't exist otherwise. Rather than specify a list, we're
      // just precompiling all the things, though we could have the app give us a list
      // of specific things to precompile if this is too slow or whatever
      connectMincer.getEnvironment().precompile(['*', '*/**'], function(err) {
        if (err) {
          throw new Error("Something went wrong during asset precompile: " + err);
        }
        next();
      });
      
    } else {
      next();
    }
  };
};

/**
 * Create a Mincer.Server designed for serving assets.
 *
 * This is just an ordinary Mincer.Server, configured with the connect-mincer environment, and by
 * default is suitable for development use.
 *
 * If connect-mincer is in production mode, and a manifestFile has been provided, the server will
 * be passed the manifest data and will run in production mode (i.e. it will never compile assets,
 * and will only serve what it can find in the compiled manifest directory)
 * 
 * @return {[type]}          Connect middleware which will compile and dispatch assets
 */
middleware.createServer = function() {

  if (!connectMincer) throw new Error('Please initialise connect-mincer first!');

  if (connectMincer.isProduction()) {
    // run the server in production mode by providing it with the manifest data - this will ensure
    // it never tries to compile assets
    var manifest = connectMincer.getManifest();

    if (!manifest) {
      throw new Error('Cannot run a Mincer.Server in production mode without a manifest -- please precompile assets first');
    }

    var server = new Mincer.Server(connectMincer.getEnvironment(), manifest);
  } else {
    // otherwise a normal dev server is used, which will recompile files on a request if necessary
    var server = new Mincer.Server(connectMincer.getEnvironment());
  }

  return function(req, res) {
    return server.handle(req, res);
  };
};

module.exports = function(options) {
  connectMincer.configure(options);
  return middleware;
};