'use strict';

var Mincer = require('mincer'),
    fs = require('fs')
;

var ConnectMincer = (function() {

  function ConnectMincer(opts) {
    this.production = opts.production === true ? true : false;
    this.options = opts;

    this._setMountPoint(opts.mountPoint);
    this._createEnvironment(opts.root, opts.paths);

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

    var environment = new Mincer.Environment(root);
    paths.forEach(function(path) {
      environment.appendPath(path);
    });

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

    if (this.production) {
      // in production, return the asset with its digest path
      paths.push(this._toAssetUrl(asset.digestPath));
    } else if (asset.isCompiled) {
      asset.toArray().forEach(function(a) {
        paths.push(self._toAssetUrl(a.logicalPath) + '?body=1');
      });
    }

    return paths;
  };

  ConnectMincer.prototype._toAssetUrl = function(source) {
    return this.mountPoint + '/' + source;
  };

  ConnectMincer.prototype.getHelper = function(name) {
    var self = this;

    var createTag = function(type, path, attributes) {
      var tag;

      switch (type) {
        case 'js':
          tag = "<script src='" + path + "'";
          break;
        case 'css':
          tag = "<link rel='stylesheet' href='" + path + "'";
      }

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
   * The asset middleware.
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
  ConnectMincer.prototype.assets = function() {

    var self = this;

    if (this.production) {
      // if we're running in production, we will now update the environment to its index, which
      // will speed up subsequent calls to it. This effectively makes the environment read-only
      // once the assets() middleware is used, so helpers must be added before.
      this.environment = this.environment.index;
    }

    return function(req, res, next) {

      // add helper methods to locals so they're available in views
      res.locals.js = self.getHelper('js');
      res.locals.css = self.getHelper('css');
      res.locals.asset_path = self.getHelper('asset_path');

      if (!self.production) {
        // if we're not in production, we should make sure all assets are precompiled
        // on a request as they won't exist otherwise. Rather than specify a list, we're
        // just precompiling all the things, though we could have the app give us a list
        // of specific things to precompile if this is too slow or whatever
        self.environment.precompile(['*', '*/**'], function(err) {
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
    var server = new Mincer.Server(this.environment, this.manifest);

    return function(req, res) {
      return server.handle(req, res);
    };
  };

  return ConnectMincer;

})();

module.exports = ConnectMincer;