# TLS Session Store for Cluster

[![Build Status](https://travis-ci.org/strongloop/strong-cluster-tls-store.png?branch=master)](https://travis-ci.org/strongloop/strong-cluster-tls-store)
[![NPM version](https://badge.fury.io/js/strong-cluster-tls-store.png)](http://badge.fury.io/js/strong-cluster-tls-store)

## Overview

Strong-cluster-tls-store is an implementation of TLS session store
using node's native cluster messaging. It provides an easy solution
for improving performance of node's TLS/HTTPS server running in a cluster.

### Features

- No dependencies on external services.
- Speeds up the TLS handshake by 15% to 55% on Unix systems.

## Usage

### Installation

```Shell
$ npm install strong-cluster-tls-store
```

### Configuration - TLS server

```javascript
var shareTlsSessions = require('strong-cluster-tls-store');

if (cluster.isMaster) {
  // Setup your master and fork workers.
} else {
  // Start a TLS server, configure it to share TLS sessions.
  var tlsOpts = { /* configure certificates, etc. */ }
  var server = tls.createServer(tlsOpts, connectionHandler);
  shareTlsSessions(server);
  server.listen(port);
  // etc.
}
```

### Configuration - HTTPS server

`https.Server` implements the interface of `tls.Server`,
the code to configure session sharing is the same.

```javascript
var shareTlsSessions = require('strong-cluster-tls-store');

if (cluster.isMaster) {
  // Setup your master and fork workers.
} else {
  // Start a TLS server, configure it to share TLS sessions.
  var httpsOpts = { /* configure certificates, etc. */ }
  var server = https.createServer(httpsOpts, requestHandler);
  shareTlsSessions(server);
  server.listen(port);
  // etc.
}
```

#### Connect and Express

Both connect and express require that a https server is created by the caller.
Setting up of TLS session sharing follows the same pattern as for a plain HTTPS
server.

```javascript
var express = require('express');
var shareTlsSessions = require('strong-cluster-tls-store');

if (cluster.isMaster) {
  // Setup your master and fork workers.
} else {
  // Start the server and configure it to share TLS sessions.

  var app = express();
  // configure the app

  var httpsOpts = { /* configure certificates, etc. */ }
  var server = https.createServer(httpsOpts, app);
  shareTlsSessions(server);

  server.listen(port);
  // etc.
}
```

### Multiple servers

To configure session sharing for multiple TLS/HTTPS servers, you have to
assign a unique namespace to each server.

```javascript
shareTlsSessions(server1, 'server1');
shareTlsSessions(server2, 'server2');
```

### Setting up the master process

The store requires that a shared-state server is running in the master process.
The server is initialized automatically when you require() this module
from the master. In the case that your master and workers have separate source
files, you must explicitly require this module in your master source file.
Optionally, you can call `setup()` to make it more obvious why you are loading
a module that is not used anywhere else.

```javascript
// master.js

var cluster = require('cluster');
// etc.

require('strong-cluster-tls-store').setup();

// configure your cluster
// fork the workers
// etc.
```

## Benchmarking

The module comes with a simple benchmark that measures how many TLS connections
can be opened per second.

### Running the benchmark
```Shell
$ npm run benchmark
```

### Understanding the results

The benchmark runs multiple time with different configuration.

* concurrency: number of TLS connections to run in parallel.
* reuse: whether session sharing is enabled.
* dur: number of seconds to run the test.

The result is the average number of connections opened per second. The higher
number is better.

Example output:
```
tls-connect.js concurrency=1 reuse=false dur=5: 562.43
tls-connect.js concurrency=1 reuse=true dur=5: 874.12
tls-connect.js concurrency=10 reuse=false dur=5: 1020.8
tls-connect.js concurrency=10 reuse=true dur=5: 1186.9
```
