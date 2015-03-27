var path = require('path');
var fs = require('fs');
var request = require('request');
var assert = require('chai').assert;
var Host = require('../lib/Host');
var Service = require('../lib/Service');

var echo = require('./test_services/echo');
var echoAsync = require('./test_services/echo_async');

describe('Host', function() {
  describe('constructor', function() {
    it('should be a function', function() {
      assert.isFunction(Host);
    });
    it('should instantiate with properties set correctly', function() {
      var host = new Host();
      assert.isObject(host.config);
      assert.notStrictEqual(host.config, host.defaultConfig);
      assert.deepEqual(host.config, host.defaultConfig);
      assert.isObject(host.services);
      assert.deepEqual(host.services, Object.create(null));
    });
    it('the constructor should accept a config', function() {
      var config = {};
      var host = new Host(config);
      assert.notStrictEqual(host.config, host.defaultConfig);
      assert.strictEqual(host.config, config);
      assert.deepEqual(host.config, host.defaultConfig);
    });
  });
  describe('#addService()', function() {
    it('should accept an object', function() {
      var host = new Host();
      var service = {
        name: 'test',
        handler: function() {}
      };
      host.addService(service);
      assert.isDefined(host.services.test);
      assert.instanceOf(host.services.test, Service);
      assert.equal(host.services.test.name, 'test');
      assert.strictEqual(host.services.test.handler, service.handler);
    });
    it('can be called multiple times', function() {
      var host = new Host();
      host.addService({
        name: 'test1',
        handler: function() {
        }
      });
      host.addService({
        name: 'test2',
        handler: function() {
        }
      });
      assert.isDefined(host.services.test1);
      assert.isDefined(host.services.test2);
      assert.instanceOf(host.services.test1, Service);
      assert.instanceOf(host.services.test2, Service);
      assert.equal(host.services.test1.name, 'test1');
      assert.equal(host.services.test2.name, 'test2');
      assert.isFunction(host.services.test1.handler);
      assert.isFunction(host.services.test2.handler);
    });
    it('throws an error if a service is added with a conflicting name', function() {
      var host = new Host();
      host.addService({
        name: 'test',
        handler: function() {
        }
      });
      assert.throws(
        function() {
          host.addService({
            name: 'test',
            handler: function() {
            }
          });
        },
        'A service has already been defined with the name "test"'
      );
    });
  });
  describe('#getUrl()', function() {
    it('should respect the defaults', function() {
      assert.equal(new Host().getUrl(), 'http://127.0.0.1:63578');
    });
    it('should respect the config', function() {
      assert.equal(new Host({address: 'foo', port: 'bar'}).getUrl(), 'http://foo:bar');
    });
  });
  describe('#callService()', function() {
    it('can call a service with a callback', function(done) {
      var host = new Host();
      host.addService({
        name: 'test',
        handler: function(data, done) {
          assert.isObject(data);
          assert.isFunction(done);
          done(null, 'success');
        }
      });
      host.callService('test', function(err, output) {
        assert.isNull(err);
        assert.equal(output, 'success');
        done();
      });
    });
    it('can optionally pass data to a service', function(done) {
      var host = new Host();
      var dataProvided = {test: 'foo'};
      host.addService({
        name: 'test',
        handler: function(data, done) {
          assert.strictEqual(data, dataProvided);
          done(null, data.test);
        }
      });
      host.callService('test', dataProvided, function(err, output) {
        assert.isNull(err);
        assert.equal(output, 'foo');
        done();
      });
    });
    it('services can complete asynchronously', function(done) {
      var host = new Host();
      host.addService({
        name: 'test',
        handler: function(data, done) {
          setTimeout(function() {
            done(null, 'delayed success');
          }, 10);
        }
      });
      host.callService('test', function(err, output) {
        assert.isNull(err);
        assert.equal(output, 'delayed success');
        done();
      });
    });
  });
  describe('#listen()', function() {
    it('can start the listenerServer', function(done) {
      var host = new Host({
        outputOnListen: false
      });
      host.listen(function() {
        host.stopListening();
        done();
      });
    });
  });
  describe('#router()', function() {
    it('requests can be routed to a service', function(done) {
      var host = new Host({
        outputOnListen: false,
        silent: true
      });

      host.addService({
        name: 'service1',
        handler: function(data, done) {
          done(null, 'in handler1');
        }
      });
      host.addService({
        name: 'service2',
        handler: function(data, done) {
          done(null, 'in handler2');
        }
      });

      host.listen(function() {
        request.post(host.getUrl(), function(err, res, body) {
          assert.equal(res.statusCode, '404');
          assert.equal(body, 'Not found');
          request.post({url: host.getUrl(), headers: {'X-Service': 'service1'}}, function(err, res, body) {
            assert.equal(body, 'in handler1');
            request.post({url: host.getUrl(), headers: {'X-Service': 'service2'}}, function(err, res, body) {
              assert.equal(body, 'in handler2');
              request.post({url: host.getUrl(), headers: {'X-Service': 'service3'}}, function(err, res, body) {
                assert.equal(res.statusCode, '404');
                assert.equal(body, 'Not found');
                host.stopListening();
                done();
              });
            });
          });
        });
      });
    });
    it('services can receive and send large data sets', function(done) {
      // A 2.5mb text file
      var testTextFile = path.join(__dirname, 'test_data', 'test.txt');
      var text = fs.readFileSync(testTextFile).toString('utf-8');

      var host = new Host({
        outputOnListen: false,
        silent: true
      });

      host.addService({
        name: 'text-test',
        handler: function(data, done) {
          if (data.text !== text) {
            return done('data.text does not match');
          }
          done(null, 'success: ' + data.text);
        }
      });

      host.listen(function() {
        request.post({url: host.getUrl(), headers: {'X-Service': 'text-test'}, json: true, body: { text: text }}, function(err, res, body) {
          assert.equal(body, 'success: ' + text);
          host.stopListening();
          done();
        });
      });
    });
    it('a service\'s `done` callback can only be called once', function(done) {
      var host = new Host({
        outputOnListen: false,
        silent: true
      });

      host.addService({
        name: 'done-x1',
        handler: function(data, done) {
          done(null, 'some success');
        }
      });
      host.addService({
        name: 'done-x2',
        handler: function(data, done) {
          done('x2');
          done(null, 'some success x2');
        }
      });
      host.addService({
        name: 'done-x3',
        handler: function(data, done) {
          done(null, 'some success x3');
          done('x3');
          done(null, 'some other success x3');
        }
      });

      host.listen(function() {
        request.post({url: host.getUrl(), headers: {'X-Service': 'done-x1'}}, function(err, res, body) {
          assert.equal(res.statusCode, 200);
          assert.include(body, 'some success');
          request.post({url: host.getUrl(), headers: {'X-Service': 'done-x2'}}, function(err, res, body) {
            assert.equal(res.statusCode, 500);
            assert.include(body, 'x2');
            request.post({url: host.getUrl(), headers: {'X-Service': 'done-x3'}}, function(err, res, body) {
              assert.equal(res.statusCode, 200);
              assert.include(body, 'some success x3');
              host.stopListening();
              done();
            });
          });
        });
      });
    });
    it('a service\'s output can be cached via a `X-Cache-Key` header', function(done) {
      var host = new Host({
        outputOnListen: false,
        silent: true
      });

      var cachedCount = 0;
      host.addService({
        name: 'cached-count',
        handler: function(data, done) {
          cachedCount++;
          done(null, cachedCount);
        }
      });

      var count = 0;
      host.addService({
        name: 'count',
        handler: function(data, done) {
          count++;
          done(null, count);
        }
      });

      var cachedCountOptions1 = {
        url: host.getUrl(),
        headers: {
          'X-Service': 'cached-count',
          'X-Cache-Key': 'test-key-1'
        }
      };

      var cachedCountOptions2 = {
        url: host.getUrl(),
        headers: {
          'X-Service': 'cached-count',
          'X-Cache-Key': 'test-key-2'
        }
      };

      host.listen(function() {
        request.post(cachedCountOptions1, function(err, res, body) {
          assert.equal(body, '1');
          request.post(cachedCountOptions1, function(err, res, body) {
            assert.equal(body, '1');
            request.post({url: host.getUrl(), headers: {'X-Service': 'count'}}, function(err, res, body) {
              assert.equal(body, '1');
              request.post({url: host.getUrl(), headers: {'X-Service': 'count'}}, function(err, res, body) {
                assert.equal(body, '2');
                request.post({url: host.getUrl(), headers: {'X-Service': 'count'}}, function(err, res, body) {
                  assert.equal(body, '3');
                  request.post(cachedCountOptions2, function(err, res, body) {
                    assert.equal(body, '2');
                    request.post(cachedCountOptions1, function(err, res, body) {
                      assert.equal(body, '1');
                      request.post(cachedCountOptions2, function(err, res, body) {
                        assert.equal(body, '2');
                        host.stopListening();
                        done();
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
  describe('#authMiddleware', function() {
    it('can authorize incoming requests via a `X-Auth-Token` header', function(done) {
      var host = new Host({
        outputOnListen: false,
        silent: true,
        authToken: 'test-token'
      });

      host.addService({
        name: 'test',
        handler: function(data, done) {
          done(null, 'success');
        }
      });

      host.listen(function() {
        request.post({url: host.getUrl(), headers: {'X-Service': 'test'}}, function(err, res, body) {
          assert.equal(res.statusCode, 401);
          assert.equal(body, 'Unauthorized');
          request.post({url: host.getUrl(), headers: {'X-Service': 'test', 'X-Auth-Token': 'wrong-token'}}, function(err, res, body) {
            assert.equal(res.statusCode, 401);
            assert.equal(body, 'Unauthorized');
            request.post({url: host.getUrl(), headers: {'X-Service': 'test', 'X-Auth-Token': 'test-token'}}, function(err, res, body) {
              assert.equal(res.statusCode, 200);
              assert.equal(body, 'success');
              host.stopListening();
              done();
            });
          });
        });
      });
    });
  });
  describe('#serviceCacheTimeout', function() {
    it('can be used to set the default cache timeout of all services', function(done) {
      var host = new Host({
        outputOnListen: false,
        silent: true,
        serviceCacheTimeout: 20
      });

      var count = 0;
      host.addService({
        name: 'test',
        handler: function(data, done) {
          count++;
          done(null, count);
        }
      });

      var requestOptions = {url: host.getUrl(), headers: {'X-Service': 'test', 'X-Cache-Key': 'test-key'}};

      host.listen(function() {
        request.post(requestOptions, function(err, res, body) {
          assert.equal(body, '1');
          request.post(requestOptions, function(err, res, body) {
            assert.equal(body, '1');
            setTimeout(function() {
              request.post(requestOptions, function(err, res, body) {
                assert.equal(body, '2');
                host.stopListening();
                done();
              });
            }, 20);
          });
        });
      });
    });
  });
});