var cluster = require('cluster');
var fs = require('fs');
var net = require('net');
var tls = require('tls');
var EventEmmiter = require('events').EventEmitter;
var exec = require('child_process').exec;
var expect = require('chai').expect;
var shareTlsSessions = require('..');

var workerPort;

// verify we can call setup in master and workers
shareTlsSessions.setup();

if (cluster.isWorker) {
  startTlsServer();
  return;
}

describe('clustered TLS server', function() {
  before(setupWorkers);
  after(stopWorkers);

  it('shares sessions between workers', function(done) {
    var TEST_COMMAND = 'openssl s_client' +
      ' -connect localhost:' + workerPort  +
      ' -reconnect -no_ticket';
      // Disable session tickets to force the server to find the session by id

    exec(TEST_COMMAND, function(err, stdout, stderr) {
      if (err) done(err);
      var sessions = stdout
        .split(/[\n\r]/)
        .filter(function(l) { return (/^New|Reused/).test(l); })
        .map(function(l) { return l.replace(/,.*$/, ''); });

      expect(sessions).to.eql([
        'New',
        'Reused', 'Reused', 'Reused', 'Reused', 'Reused'
      ]);
      done();
    });
  });
});

describe('ClusterStore', function() {
  var tls1, tls2;
  var ID = new Buffer('id', 'binary');
  var DATA = new Buffer('data', 'binary');

  before(createTlsMocks);

  it('creates an unique store per TLS server', function(done) {
    shareTlsSessions(tls1, 'a-first-namespace');
    shareTlsSessions(tls2, 'a-second-namespace');

    tls1.emit('newSession', ID, DATA);
    tls2.emit('resumeSession', ID, function(err, data) {
      expect(err, 'err').to.equal(null);
      expect(data, 'data').to.equal(null);
      done();
    });
  });

  it('throws when two servers share the same default namespace', function(done) {
    shareTlsSessions(tls1);
    expect(shareTlsSessions.bind(null, tls2)).to.throw();
    done();
  });

  it('throws when two servers share the same explicit namespace', function(done) {
    shareTlsSessions(tls1, 'a-namespace');
    expect(shareTlsSessions.bind(null, tls2, 'a-namespace')).to.throw();
    done();
  });

  function createTlsMocks() {
    tls1 = new EventEmmiter();
    tls2 = new EventEmmiter();
  }
});

var WORKER_COUNT = 2;

function getNumberOfWorkers() {
  return Object.keys(cluster.workers).length;
}

function setupWorkers(done) {
  if (getNumberOfWorkers() > 0) {
    var msg = 'Cannot setup workers: there are already other workers running.';
    return done(new Error(msg));
  }

  cluster.setupMaster({ exec: __filename });

  var workersListening = 0;
  cluster.on('listening', function(w, addr) {
    if (!workerPort) workerPort = addr.port;

    workersListening++;
    if (workersListening == WORKER_COUNT) {
      done();
    }
  });

  for (var i = 0; i < WORKER_COUNT; i++) {
    cluster.fork();
  }
}

function stopWorkers(done) {
  cluster.disconnect(done);
}

function startTlsServer() {
  var PORT = 0; // Let the OS pick any available port
  var options = {
    cert: fs.readFileSync(require.resolve('./cert/test_cert.pem')),
    key: fs.readFileSync(require.resolve('./cert/test_key.pem')),
    ca: [fs.readFileSync(require.resolve('./cert/test_ca.pem'))]
  };
  var server = tls.createServer(options, function(cleartextStream) {
    cleartextStream.on('error', function(err) { /* ignore errors */ });
    cleartextStream.setEncoding('utf8');
    cleartextStream.write('hello\n');
    cleartextStream.end();
  });
  shareTlsSessions(server);
  server.listen(PORT);
}
