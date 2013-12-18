var async = require('async'),
    should = require('should'),
    sinon = require('sinon'),
    ConnectMincer = require('../../lib/connect_mincer')
;

describe('ConnectMincer', function() {

  describe('instantiating', function() {

    it('should allow passing a custom Mincer object', function() {
      var Mincer = require('Mincer');

      var cm = new ConnectMincer({
        mincer: Mincer,
        root: __dirname,
        paths: ['assets/css']
      });

      // verify that our Mincer is the one being used ...
      should.exist(cm.Mincer);
      cm.Mincer.should.equal(Mincer);
    });

    it('should error if required properties are missing', function() {
      (function() {
        new ConnectMincer({});
      }).should.throwError(/root/);

      (function() {
        new ConnectMincer({
          root: __dirname,
        });
      }).should.throwError(/paths/);
    });

    it('should set the asset host', function() {
      new ConnectMincer({
        root: __dirname,
        paths: ['assets/css'],
        assetHost: '//cdn.example.com'
      }).assetHost.should.eql('//cdn.example.com');
    });

    it('should set the mount point', function() {
      new ConnectMincer({
        root: __dirname,
        paths: ['assets/css']
      }).mountPoint.should.eql('/assets');

      new ConnectMincer({
        root: __dirname,
        paths: ['assets/css'],
        mountPoint: '/static'
      }).mountPoint.should.eql('/static');

      new ConnectMincer({
        root: __dirname,
        paths: ['assets/css'],
        mountPoint: 'static'
      }).mountPoint.should.eql('/static');

      new ConnectMincer({
        root: __dirname,
        paths: ['assets/css'],
        mountPoint: '/assets/'
      }).mountPoint.should.eql('/assets');
    });
  });

  it('should make the environment accessible', function() {
    var cm = new ConnectMincer({
      root: __dirname,
      paths: ['assets/css']
    });

    should.exist(cm.environment);
  });
});