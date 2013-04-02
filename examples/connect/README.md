# connect-assets Connect example

This is an example Connect app using connect-mincer. It's much simpler than the Express example, but should show how you can use connect-mincer without Express.

## Trying it

    $ git clone git@github.com:clarkdave/connect-mincer.git
    $ cd connect-mincer
    $ npm install
    $ cd examples/connect
    $ node app

Now visit `http://localhost:5000` and you'll see the home page which links to a compiled LESS file.

## Using the view helpers

You can still access the view helpers when using connect with the `getHelper()` method. You can use this with your own view engine (or directly in your middleware if needed). You can also use the `getHelpers()` method, which will return an object with all helpers in it. For example:

``` javascript
var app = connect();
var mincer = new ConnectMincer({...});
var helpers = mincer.getHelpers();

app.use('/home', function(req, res) {
  var css = helpers.css('home.css');
  var js = helpers.js('home.js');
  // this could also be:
  js = mincer.getHelper('js')('home.js');
  res.end('...');
});
```

## Precompiling for production

Precompiling works the same as in the [Express example](https://github.com/clarkdave/connect-mincer/tree/master/examples/express)).