'use strict';

var fs = require('fs'),
    _ = require('underscore')
;

var ConnectMincer = (function() {

  function ConnectMincer(opts) {
    opts = opts || {};

    this._setMincer(opts.mincer);
    
    this.production = opts.production === true ? true : false;
    this.options = opts;

    this._setAssetHost(opts.assetHost);
    this._setMountPoint(opts.mountPoint);
    this._createEnvironment(opts.root, opts.paths);

    if (this.options.precompile !== false) {
      // if precompile has not explicitly been set to false, default it to true
      this.options.precompile = true;
    }

    if (this.production) {
      // in production, we look up assets in the supplied manifest, so let's load that now and error
      // if it's not present, because in production mode we never compile assets on the fly
      if (fs.existsSync(opts.manifestFile)) {
        this.manifest = require(opts.manifestFile);
        if (!this.manifest || !this.manifest.assets) {
          throw new Error("Running in production but manifest file [" + opts.manifestFile + "] is not a valid manifest file");
        }
      } else {
        throw new Error("Running in production but manifest file [" + opts.manifestFile + "] not found");
      }
    }
  }

  /**
   * Set the Mincer class we'll use.
   *
   * If not provided, the bundled Mincer object will be used. It should be safe to pass in any version of Mincer
   * unless there has been a major update and the public API has changed.
   *
   * Versions < 0.5.x of Mincer are not supported and will generate an error
   * 
   * @param {[type]} Mincer [description]
   */
  ConnectMincer.prototype._setMincer = function(Mincer) {

    // if no Mincer was provided, we'll require our own bundled one
    this.Mincer = Mincer || require('mincer');

    // check the version of the passed in Mincer. We no longer support versions < 0.5 because of API changes
    var version = this.Mincer.VERSION;

    if (!version) throw new Error("Mincer class should be a valid Mincer object, e.g. require('mincer')");
    
    var major = parseInt(version.split('.')[0], 10),
        minor = parseInt(version.split('.')[1], 10);

    if (major === 0 && minor < 5) throw new Error("provided Mincer class must be >= 0.5.x (you provided " + version + ")");
  };

  /**
   * Sanitize and set the mount point. If no mount point was provided, it will default
   * to /assets. 
   * 
   * @acccess private
   * @param {[type]} mountPoint [description]
   */
  ConnectMincer.prototype._setMountPoint = function(mountPoint) {

    if (!mountPoint) {
      mountPoint = '/assets';
    } else {
      if (mountPoint.substr(0, 1) !== '/') {
        mountPoint = '/' + mountPoint;
      }
      if (mountPoint.substr(-1) === '/') {
        mountPoint = mountPoint.substr(0, mountPoint.length - 1);
      }
    }

    this.mountPoint = mountPoint;
  };

  /**
   * Set the asset host if the provided assetHost is not null or an empty string.
   * 
   * @param {[type]} assetHost [description]
   */
  ConnectMincer.prototype._setAssetHost = function(assetHost) {

    this.assetHost = null;

    if (assetHost && assetHost.length > 0) {
      this.assetHost = assetHost;

      // if (assetHost.substr(0, 2) !== '//' && assetHost.substr(0, 7) !== 'http://' && assetHost.substr(0, 8) !== 'https://') {
      //   throw new Error("Asset host must start with '//', 'http://' or 'https://");
      // }
    }
  };

  /**
   * Create a new Mincer Environment with the provided root and paths. If the root does
   * not exist an error will be thrown. In production, this will create a cached version
   * of the environment.
   *
   * This also attaches various helpers to the environment which can be used in assets.
   *
   * @access private
   * @param  {[type]} root  [description]
   * @param  {[type]} paths [description]
   * @return {[type]}       [description]
   */
  ConnectMincer.prototype._createEnvironment = function(root, paths) {
    var self = this;

    if (!fs.existsSync(root)) {
      throw new Error("Asset root [" + root + "] does not exist");
    }

    if (!Array.isArray(paths) || !paths.length) {
      throw new Error("Asset paths are missing, e.g. ['assets/css', 'assets/js']");
    }

    var environment = new this.Mincer.Environment(root);
    paths.forEach(function(path) {
      environment.appendPath(path);
    });

    // implement the `asset_path` helper for assets. this is not set by default because Mincer doesn't
    // know what the final path should be, but we do so we're implementing it here
    //
    // this can then be used in assets thusly: <%= asset_path('logo.png') %>
    
    environment.registerHelper('asset_path', function(name, opts) {
      var asset = environment.findAsset(name, opts);
      if (!asset) throw new Error("File [" + name + "] not found");
      if (self.production) {
        return self._toAssetUrl(asset.digestPath);
      } else {
        return self._toAssetUrl(asset.logicalPath);
      }
    });

    this.environment = environment;
  };

  /**
   * Find all the asset paths for the provided logicalPath and returns them.
   *
   * If the logicalPath is a bundle, and the app is not in production mode, multiple paths
   * will be returned (one for each asset referenced in the bundle).
   *
   * @access private
   * @param  {[type]} logicalPath [description]
   * @param  {[type]} ext         [description]
   * @return {[type]}             [description]
   */
  ConnectMincer.prototype._findAssetPaths = function(logicalPath, ext) {
    var self = this;

    if (this.production) {
      // we're in production, and have a valid manifest, so instead of using the environment
      // we will get the digestPath directly from the manifest
      
      var digestPath = this.manifest.assets[logicalPath];

      if (!digestPath) {
        // this is bad, and probably means someone forgot to do compile assets before running
        // in production.
        throw new Error("Asset [" + logicalPath + "] has not been compiled");
      }

      return [this._toAssetUrl(digestPath)];
    }

    // if we're in normal development mode, we should look for the asset in our current environment
    // and return it. It should already be compiled because we force a precompile in dev mode on
    // every request.

    var asset = this.environment.findAsset(logicalPath),
        paths = []
    ;
    
    if (!asset) return null;

    // precompiling/compiling is no longer supported in Mincer 5.x which simplifies things for us - the
    // asset itself will be compiled on the fly when a request for it comes in (except for in prod, but
    // that's handled above and requires a manifest and compiled assets anyway)
    
    asset.toArray().forEach(function(a) {
      // iterate this asset (there could be multiple if it's a bundle) and add 
      // each as a logical path (no digest), with ?body=1 as per sprockets
      paths.push(self._toAssetUrl(a.logicalPath) + '?body=1');
    });

    return paths;
  };

  ConnectMincer.prototype._toAssetUrl = function(source) {
    return (this.assetHost ? this.assetHost : '') + this.mountPoint + '/' + source;
  };

  /**
   * Get the helper function matching the given name, which should be one of:
   * - js
   * - css
   * - asset_path
   * 
   * @param  {[type]} name Helper name
   * @return {[type]}      The helper function
   */
  ConnectMincer.prototype.getHelper = function(name) {
    var self = this;

    var createTag = function(type, path, attributes) {
      var tag, base_attributes = {};

      switch (type) {
        case 'js':
          tag = "<script src='" + path + "'";
          break;
        case 'css':
          tag = "<link type='text/css' href='" + path + "'";
          base_attributes = {
            rel: 'stylesheet',
            media: 'screen'
          };
      }

      attributes = _.extend(base_attributes, attributes || {});

      for (var attr in attributes) {
        tag += " " + attr + "='" + attributes[attr] + "'";
      }

      switch (type) {
        case 'js':
          return tag + '></script>';
        case 'css':
          return tag + '>';
      }
    };

    switch (name) {

      case 'js':
        return function(path, attributes) {
          var paths = self._findAssetPaths(path);
          if (!paths) throw new Error('Javascript asset [' + path + '] not found');

          var tags = paths.map(function(path) {
            return createTag('js', path, attributes);
          });

          return tags.join("\n");
        };

      case 'css':
        return function(path, attributes) {
          var paths = self._findAssetPaths(path);
          if (!paths) throw new Error('CSS asset [' + path + '] not found');

          var tags = paths.map(function(path) {
            return createTag('css', path, attributes);
          });

          return tags.join("\n");
        };

      case 'asset_path':
        return function(path) {
          var paths = self._findAssetPaths(path);

          if (!paths) return '';

          if (paths.length === 1) {
            return paths[0];
          } else {
            return paths;
          }
        };
    }

    return null;
  };

  /**
   * Get an object containing all helper functions
   * 
   * @return {[type]} Object with all helper functions
   */
  ConnectMincer.prototype.getHelpers = function() {
    return {
      js: this.getHelper('js'),
      css: this.getHelper('css'),
      asset_path: this.getHelper('asset_path')
    };
  };

  /**
   * The asset middleware.
   * 
   * The asset middleware adds view helpers for loading js and css, and if in development mode
   * will also ensure assets are precompiled and route the mincer assetServer to /assetUrl
   *
   * The following helpers will be available in all views, if Express is used:
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
  ConnectMincer.prototype.assets = function() {

    var self = this;

    if (this.production) {
      // if we're running in production, we will now update the environment to its index, which
      // will speed up subsequent calls to it. This effectively makes the environment read-only
      // once the assets() middleware is used, so helpers must be added before.
      this.environment = this.environment.index;
    }

    return function(req, res, next) {

      // add helper methods to locals so they're available in views - this is only supported for Express,
      // which adds the res.locals object. Standard Connect apps will need to use ConnectMincer.getHelper()
      if (res.locals) {
        res.locals.js = self.getHelper('js');
        res.locals.css = self.getHelper('css');
        res.locals.asset_path = self.getHelper('asset_path');
      }

      // we have nothing else to do here, because precompiling has been removed in Mincer 5.x and asset
      // paths are available immediately before being compiled (they get compiled properly when requested)
      next();
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
  ConnectMincer.prototype.createServer = function() {

    if (this.production) {
      // run the server in production mode by providing it with the manifest data - this will ensure
      // it never tries to compile assets
      console.warn('Running the Mincer server in production is not recommended. Precompile assets first and then use the connect.static middleware (or a web server)');
      if (!this.manifest) {
        throw new Error('Cannot run a Mincer.Server in production mode without a manifest -- please precompile assets first');
      }
    }

    // otherwise a normal dev server is used, which will recompile files on a request if necessary
    var server = new this.Mincer.Server(this.environment, this.manifest);

    return function(req, res) {
      return server.handle(req, res);
    };
  };

  return ConnectMincer;

})();

module.exports = ConnectMincer;
