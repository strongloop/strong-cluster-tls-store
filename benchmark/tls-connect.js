// Copyright IBM Corp. 2013. All Rights Reserved.
// Node module: strong-cluster-tls-store
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

// based on node's benchmark/tls/tls-connect.js

var fork = require('child_process').fork;
var fs = require('fs');
var path = require('path');
var tls = require('tls');
var os = require('os');

var debug = require('debug')('benchmark');

var common = require('./common.js');
var bench = common.createBenchmark(main, {
  cluster: [os.cpus().length-1], // use false to disable cluster
  concurrency: [10],
  proto: ['default', 'SSLv3_method' ],
  ciphers: ['default'],
  share: [false, true],
  dur: [30],
  run: [1, 2, 3] // repeat to visualise volatility
});

var certDir = path.resolve(__dirname, '../test/cert');

var clientConn = 0;
var workerConn = [];
var running = true;
var server;
var port;

function main(conf) {
  var args = [];
  if (conf.cluster !== 'false') args.push('-cluster=' + conf.cluster);
  if (conf.share === 'true') args.push('-share');
  if (conf.ciphers !== 'default') args.push('-ciphers=' + conf.ciphers);

  debug('forking server', args);
  server = fork('server.js', args);
  server.on('message', function(msg) {
    debug('message from server', msg);
    if (msg.event == 'LISTENING') {
      port = msg.port;
      onServerListening();
    }
  });

  function onServerListening() {
    debug('server is listening on port %d', port);
    debug('starting the benchmark...');
    setTimeout(stop, conf.dur * 1000);
    bench.start();

    for (var i = 0; i < conf.concurrency; i++)
      makeConnection(conf);
  }

  function makeConnection(conf, session) {
    var opts = { port: port,
      ca: [ fs.readFileSync(certDir + '/test_ca.pem') ],
      session: session
    };

    if (conf.proto !== 'default') {
      opts.secureProtocol = conf.proto;
    }

    if (conf.ciphers !== 'default') opts.ciphers = conf.ciphers;
    var conn = tls.connect(opts, function() {
      clientConn++;
      conn.end('GET / HTTP/1.0\r\n\r\n', function() {
        if (running) makeConnection(conf, conn.getSession());
        else debug('session was reused', conn.isSessionReused());
      });
    });

    conn.on('error', function(er) {
      console.error('client error', er);
      if (er.syscall != 'connect') conn.end();
      if (running) makeConnection(conf, session);
    });
  }

  function stop() {
    debug('... the benchmark is over');
    running = false;

    server.on('message', onMessage);
    server.send({ cmd: 'REPORT' });

    function onMessage(data) {
      if (data.cmd !== 'REPORT') return;
      workerConn = data.workerConn;
      serverConn = data.serverConn;
      done();
    }
  }

  function done() {
    // it's only an established connection if they both saw it.
    // because we destroy the server somewhat abruptly, these
    // don't always match.  Generally, serverConn will be
    // the smaller number, but take the min just to be sure.
    debug('Connection distribution per workers:', workerConn);
    bench.end(Math.min(serverConn, clientConn));
    server.kill();
  }
}
