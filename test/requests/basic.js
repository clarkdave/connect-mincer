var async = require('async'),
    should = require('should'),
    sinon = require('sinon'),
    cheerio = require('cheerio'),
    supertest = require('supertest'),
    ConnectMincer = require('../../lib/connect_mincer')
;

describe('Basic app', function() {

  var app = require('../apps/basic'), request;

  describe('with default ConnectMincer options', function() {

    before(function() {
      

      request = supertest(app);
    });

    it('should have correct tags in output', function(done) {

      request
        .get('/')
        .expect(200)
        .end(function(err, res) {
          should.not.exist(err);

          var $ = cheerio.load(res.text);

          var link = $('link').first();
          link.attr('type').should.eql('text/css');
          link.attr('href').should.eql('/assets/layout.css?body=1');
          link.attr('rel').should.eql('stylesheet');
          link.attr('media').should.eql('screen');

          var scripts = $('script');
          scripts.length.should.eql(4);

          scripts.eq(0).attr('src').should.eql('/assets/underscore.js?body=1');
          scripts.eq(1).attr('src').should.eql('/assets/jquery.js?body=1');
          scripts.eq(2).attr('src').should.eql('/assets/libs.js?body=1');
          scripts.eq(3).attr('src').should.eql('/assets/app.js?body=1');

          done();
        });
    });

    it('should render assets', function(done) {

      request
        .get('/assets/layout.css?body=1')
        .expect(200)
        .end(function(err, res) {
          should.not.exist(err);

          // verify type is OK and the asset_path helper is working as it should
          res.type.should.equal('text/css');
          res.text.should.match(/url\(\/assets\/background\.png\)/);

          done();
        });
    });
  });
});