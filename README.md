# TLS Session Store for Cluster

[![Build Status](https://travis-ci.org/strongloop/strong-cluster-tls-store.png?branch=master)](https://travis-ci.org/strongloop/strong-cluster-tls-store)
[![NPM version](https://badge.fury.io/js/strong-cluster-tls-store.png)](http://badge.fury.io/js/strong-cluster-tls-store)

## Overview

Strong-cluster-tls-store is an implementation of TLS session store
using node's native cluster messaging. It provides an easy solution
for improving performance of node's TLS/HTTPS server running in a cluster.

The performance of your HTTPS/TLS cluster depends on many factors:
* Node.js version (significant improvements were implemented to both TLS and
  cluster modules in v0.11)
* platform (windows/linux/etc.)
* whether your clients support the SessionTicket TLS extension (RFC5077)
* how often the same HTTPS connection is reused for multiple requests

You should therefore monitor the performance of your application and
find out yourself how much extra speed is gained in your specific
scenario (if any at all).
Check out our product [StrongOps](http://nodefly.com) (formerly NodeFly)
if you are looking for a great performance monitoring tool.

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

## Setting up the client

TLS session resumption may not occur without client configuration.
For non-Node clients it is case-by-case. For example, many browsers attempt
session resumption by default.

With the Node.js client, session data from a successful connection must be
explicitly copied to `opts.session` when making a new connection.

```javascript
var tls = require('tls');

var opts = {
  port: 4433,
  host: 'localhost'
};

var initialConnection = tls.connect(opts, function() {
  // save the TLS session
  opts.session = this.getSession();

  // talk to the other side, etc.
});

var resumedConnection = tls.connect(opts, function() {
  // talk to the other side, etc.
});
```

Unfortunately as of Node.js v0.10.15 and v0.11.4, the HTTPS client does
reuse TLS sessions by default and the API does not provide an easy way 
how to enable it manually.
