// based on node's benchmark/tls/tls-connect.js

var assert = require('assert');
var execFile = require('child_process').execFile;
var cluster = require('cluster');
var fs = require('fs');
var os = require('os');
var path = require('path');
var tls = require('tls');
var ClusterStore = require('..');

var certDir = path.resolve(__dirname, '../test/cert');
var serverConn = 0;

if (cluster.isMaster) {
  master();
} else {
  worker();
}

function master() {
  var common = require('./common.js');
  var bench = common.createBenchmark(main, {
    concurrency: [1, 10],
    reuse: [false, true],
    dur: [5]
  });

  var WORKER_COUNT = os.cpus().length;
  var clientConn = 0;
  var workerConn = [];
  var port;
  var dur;
  var concurrency;
  var running = true;
  var workersListening = 0;

  function main(conf) {
    dur = +conf.dur;
    concurrency = +conf.concurrency;

    cluster.on('listening', onWorkerListening);
    for (var i = 0; i < WORKER_COUNT; i++)
      cluster.fork({ REUSE_SESSIONS: conf.reuse });
  }

  function onWorkerListening(w, addr) {
    workersListening++;
    if (workersListening < WORKER_COUNT) return;

    port = addr.port;
    setTimeout(stop, dur * 1000);
    bench.start();
    for (var i = 0; i < concurrency; i++)
      makeConnection();
  }

  function makeConnection(session) {
    var opts = {
      port: port,
      ca: [ fs.readFileSync(certDir + '/test_ca.pem') ],
      // NOTE: The default protocol (TLSv1) does not reuse sessions
      secureProtocol: 'SSLv3_method',
      session: session
    };
    var conn = tls.connect(opts, function() {
      clientConn++;
      conn.on('error', function(er) {
        console.error('client error', er);
        throw er;
      });
      conn.end();
      if (running) makeConnection(conn.getSession());
    });
  }

  function stop() {
    running = false;

    for (var id in cluster.workers) {
      var w = cluster.workers[id];
      w.on('message', onMessage);
      w.send({ cmd: 'REPORT' });
    }

    function onMessage(data) {
      if (data.cmd !== 'REPORT') return;
      workerConn.push(data.serverConn);
      serverConn += data.serverConn;
      if (workerConn.length == WORKER_COUNT)
        done();
    }
  }

  function done() {
    // it's only an established connection if they both saw it.
    // because we destroy the server somewhat abruptly, these
    // don't always match.  Generally, serverConn will be
    // the smaller number, but take the min just to be sure.
    bench.end(Math.min(serverConn, clientConn));
    // console.log('Connection distribution per workers:', workerConn);
  }
}

function worker() {
  function onConnection(conn) {
    serverConn++;
    conn.end();
  }

  function report() {
    process.send({ cmd: 'REPORT', serverConn: serverConn });
  }

  process.on('message', function(data) {
    if (data.cmd === 'REPORT') report();
  });

  var options = {
    key: fs.readFileSync(certDir + '/test_key.pem'),
    cert: fs.readFileSync(certDir + '/test_cert.pem'),
    ca: [ fs.readFileSync(certDir + '/test_ca.pem') ]
  };

  server = tls.createServer(options, onConnection);
  if (process.env.REUSE_SESSIONS === 'true') {
    new ClusterStore().intercept(server);
  }
  server.listen(0);
}
