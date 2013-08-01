// A configurable TLS server for benchmark
// based on node's benchmark/tls/tls-connect.js
// command-line arguments:
//   -cluster       run a cluster of workers
//   -share         share tls sessions via newSession/resumeSession
//   -proto=STR     use protocol STR (e.g. SSLv3_method)
//   -ciphers=STR   force server's cipher config

var cluster = require('cluster');
var fs = require('fs');
var path = require('path');
var tls = require('tls');

var debug = require('debug')('tls-server');

var shareTlsSessions = require('..');

var certDir = path.resolve(__dirname, '../test/cert');
var serverConn = 0;

var conf = parseArgs();

if (cluster.isMaster && conf.cluster) {
  master();
} else {
  worker();
}

function parseArgs() {
  var options = {
    share: false,
    cluster: false,
    ciphers: undefined
  };

  process.argv.slice(2).forEach(function(a) {
    var match;
    if (a == '-share') {
      options.share = true;
    } else if ((match = a.match(/^-cluster=(.*)/))) {
      options.cluster = +match[1];
    } else if ((match = a.match(/^-ciphers=(.*)/))) {
      options.ciphers = match[1];
    } else if ((match = a.match(/^-proto=(.*)/))) {
      options.proto = match[1];
    } else {
      console.error('Unknown argument %s', a);
    }
  });

  return options;
}

function master() {
  var WORKER_COUNT = conf.cluster;
  var port;
  var workersListening = 0;

  process.on('message', function(msg) {
    if (msg.cmd === 'REPORT')
      report();
  });

  cluster.on('listening', onWorkerListening);
  for (var i = 0; i < WORKER_COUNT; i++)
    cluster.fork();

  cluster.on('exit', function(worker, code, signal) {
    var exitCode = worker.process.exitCode;
    debug('worker ' + worker.id + ' died ('+exitCode+').');
  });

  function onWorkerListening(w, addr) {
    workersListening++;
    if (workersListening < WORKER_COUNT) return;

    reportListening(addr);
  }


  function report() {
    var workerConn = [];
    var serverConn = 0;

    for (var id in cluster.workers) {
      var w = cluster.workers[id];
      w.on('message', onMessage);
      w.send({ cmd: 'REPORT' });
    }

    function onMessage(data) {
      if (data.cmd !== 'REPORT') return;
      workerConn.push(data.serverConn);
      serverConn += data.serverConn;
      if (workerConn.length == WORKER_COUNT) {
        process.send({
          cmd: 'REPORT',
          serverConn: serverConn,
          workerConn: workerConn
        });
        setTimeout(process.exit.bind(process), 200);
      }
    }
  }
}

function worker() {
  var server;
  var serverConn = 0;

  function onConnection(conn) {
    serverConn++;
    debug('session reused:', conn.isSessionReused());
    conn.on('error', function(err) { console.error('conn error', err); });
    conn.end('200 OK HTTP/1.0\r\n\r\n');
  }

  function report() {
    process.send({ cmd: 'REPORT', serverConn: serverConn });
    server.close();
    server.on('close', function() { process.exit(); });
  }

  process.on('message', function(data) {
    if (data.cmd === 'REPORT') report();
  });

  var options = {
    key: fs.readFileSync(certDir + '/test_key.pem'),
    cert: fs.readFileSync(certDir + '/test_cert.pem'),
    ca: [ fs.readFileSync(certDir + '/test_ca.pem') ],
    ciphers: conf.ciphers,
    honorCipherOrder: conf.ciphers !== undefined
  };

  server = tls.createServer(options, onConnection);
  if (conf.share) {
    shareTlsSessions(server);
  }
  server.on('listening', function() {
    reportListening(server.address());
  });

  server.on('error', function(err) {
    console.error('server error', err);
  });

  debug('worker ciphers: %s share: %s', conf.ciphers, conf.share);

  server.listen(0);
}

function reportListening(addr) {
  if (process.send)
    process.send({ event: 'LISTENING', port: addr.port });
  else
    console.log('server is listening on port ', addr.port);
}
