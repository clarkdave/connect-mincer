# connect-assets Express example

This is an example Express v3 app using connect-mincer. It demonstrates compiling LESS and CoffeeScript with bundles.

## Trying it

    $ git clone git@github.com:clarkdave/connect-mincer.git
    $ cd connect-mincer
    $ npm install
    $ cd examples/express
    $ node app

Now visit `http://localhost:5000` and you'll see the home page which links to the compiled LESS and CoffeeScript files.

## Precompiling for production

This example contains a script `bin/precompile_assets` which will:

- Precompile everything in the asset directories
- Run JS and CSS compression
- GZIP all assets and create .gz files (just like Rails)

To do this, run:

    node bin/precompile_assets

when it finishes you'll find the compiled assets in `public/assets`, along with a manifest file. Now run the app in production mode:

    NODE_ENV=production node app

The example app uses the Mincer server in production mode and will pass the manifest file to it. If you refresh your browser you'll see that assets are now linked to with an MD5 digest and also have their cache headers set to maximum when served.

In a production environment, you'd probably want to disable the connectMincer.createServer() middleware from running in production, and instead have nginx serve all requests to `/assets`. This would look something like:

    upstream app_server {
      server 127.0.0.1:5000;
    }

    server {
      listen 80;
      server_name _;
      root /deployed/app/location/public;

      location ~ ^/assets/ {
        gzip_static on;
        expires 1y;
      }

      location / {
        try_files $uri @app;
      }

      location @app {
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $http_host;
        proxy_redirect off;
        proxy_max_temp_file_size 0;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_pass http://app_server;
      }
    }

This is a basic example but should give you a good idea. If nginx is compiled with the `HttpGzipStaticModule` it will serve the `.gz` files from the compiled asset directory.

If you want to serve assets from a different domain (like a CDN), you should pass the `assetHost` option:

``` javascript
assetHost: '//assets.example.com'
```

Now the view helpers will output URLs like: `//assets.example.com/assets/account/home.css`