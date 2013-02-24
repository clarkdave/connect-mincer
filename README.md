# connect-mincer

This is an Express-compatible, connect middleware for [Mincer](https://github.com/nodeca/mincer).

## What is Mincer and why do I want this?

Mincer is an excellent port of Sprockets, which means it is a robust and featured asset manager for your Node app. However, Mincer makes no assumptions about your application so by default it requires some work to get going with a typical Express app.

Using connect-mincer, you can:

* Write and serve CoffeeScript, LESS, Stylus, etc
* Serve files with an MD5 digest (for caching)
* Precompile all your assets and have your Connect app read from the manifest

## Let's go!

    npm install git://github.com/clarkdave/connect-mincer

Now, in your connect app:

    var connectMincer = require('connect-mincer')({
      root: __dirname,
      production: process.env.NODE_ENV === 'production',
      assetUrl: '/assets',
      manifestFile: __dirname + '/public/assets/manifest.json',
      paths: [
        'assets/css',
        'assets/js',
        'vendor/js'
      ]
    });

    app.use(connectMincer.assets());

    if (process.env.NODE_ENV !== 'production')
      app.use('/assets', connectMincer.createServer());

The connectMincer.assets() middleware will:

* Provide js(), css() and asset_path() helpers for your views
* In development, ensure that assets are recompiled on every request

Now, in your views, you can do this:

    <head>
      <%- css('main.css') %>
      <%- js('application.js') %>
    </head>

These helpers will output something like: `<script src='/assets/application.js'></script>`.

The second piece of middleware, `connectMincer.createServer()`, sets up a Mincer server which will send the compiled version of the asset. This is great for development, though in production you'll probably want to have these files served by nginx or from a cloud host (see more about 'in production' below).

## In more detail

Mincer and this middleware are unopinionated about where your keep your assets. When you initialise connect-mincer you pass in several options:

- **root**: this is usually the root of your app. Asset paths are relative to this.
- **production**: set to true if the app is running in production mode.
- **assetUrl**: this is what the js, css and asset_path helpers use to create the URL for each asset.
- **paths**: a list of directories where your assets are located.

A typical app folder structure might be this:

    app/
      assets/
        js/
          application.js
        css/
          main.less
          blog/
            more.css
        images/
          logo.png
      lib/
      public/
      vendor/
        js/
          jquery.js
      app.js

With this, a suitable path list would be:

    ['assets/js', 'assets/css', 'assets/images', 'vendor/js']

Now anything within these paths can be referenced in your views with the helpers like so:

    css('main.css')
    css('blog/more.css')
    js('jquery.js')

Which would become:

    <link href='/assets/main.css' />
    <link href='/assets/blog/more.css' />
    <script src='/assets/jquery.js' />

## In production

For production use, connect-mincer let's you pass in a Mincer manifest file and will use this to generate correct asset paths (with MD5 digests). Precompiling is easy, using Mincer.Manifest, and there's an example of this below. For now, let's assume you have precompiled your assets to the `/public/assets` directory. This directory will contain a `manifest.json` file which links asset filenames to their digest format.

If you pass the manifest file to connect-mincer, e.g:

    manifestFile: __dirname + '/public/assets/manifest.json',

When the helpers (js, css, asset_path) are called in your views, connect-mincer will look up the compiled name in the manifest and use that, leading to an output like this:

    <script src='/assets/application-4b02e3a0746a47886505c9acf5f8c655.js'></script>

which will correspond to the file `/public/assets/application-4b02e3a0746a47886505c9acf5f8c655.js`. Now you can set nginx up to intercept requests to `/assets` and serve the static file in `/public/assets` instead. Thanks to the MD5 digest, you can set the cache headers to maximum. The next time you deploy and precompile the digests will change, and your app will adjust its `<script>` and `<link>` tags accordingly.

