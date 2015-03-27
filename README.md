service-host
============

[![Build Status](https://travis-ci.org/markfinger/service-host.svg?branch=master)](https://travis-ci.org/markfinger/service-host)

Installation
------------

```
npm install service-host
```

Programmatic usage
------------------

```javascript
var Host = require('service-host');

var host = new Host({
  debug: true,
  port: 9000,
});

host.addService({
  name: 'foo',
  handler: function(data, done) {
    // ...
    if (someError) {
      done(someError);
    } else {
      done(null, output);
    }
  }
});

// Call a service
host.callService(
  // The name of the service to call
  'foo',
  // An optional data set to pass to the service
  {},
  // An optional cache key to cache the output of the service
  'some-cache-key',
  // A callback which is provided with the resulting error and output
  function(err, output) {}
);

// Start a process which listens at the configured
// address and port
host.listen();
```


CLI usage
---------

```bash
# Spin up a service host
node bin/start.js --config path/to/config.js

# Spin up a service host managed by PM2
node bin/start_managed.js --name "My service host" --config path/to/config.js

# Stop a service host managed by PM2
node bin/stop_managed.js --name "My service host"
```

Config files should export a config object.

Communicating with the host
---------------------------

### Headers

- `X-Service`: the name of the service that you want to call.
- `X-Cache-Key`: a token used to cache the output of the request,
  all concurrent or subsequent requests will resolve to the same
  output until it expires.
- `X-Auth-Token`: an optional token used to verify incoming requests.

### Sending data

Set the request's content-type to `application/json` and pass the data in 
as the request's body. It will be deserialised and passed to the service.


Configuring the host
--------------------

```javascript
// Default config

var host = new Host({
  // The address that will be listened at
  address: '127.0.0.1',
  // The port that will be  listened at
  port: '63578',
  // A string that can be used to authenticate incoming requests
  authToken: null,
  // If true, some additional helpers will be activated, suffice 
  // to say, do not set this to true if your host is open to 
  // external connections
  debug: false,
  // Suppresses console output from the internal loggers
  silent: false,
  // If true, the host will write to stdout once it is listening 
  // and open to connections
  outputOnListen: true,
  // The maximum size of an incoming request's body
  requestDataLimit: '10mb',
  // The time between a cache key/value being set and its expiry
  serviceCacheTimeout: 24 * 60 * 60 * 1000, // 24 hours
  // An optional array of services to load during the host's 
  // initialization. Services should objects with `name` and 
  // either `file` or `handler` properties. The `file` prop
  // should be a path to a file which exports a handler.
  services: null
});
```
