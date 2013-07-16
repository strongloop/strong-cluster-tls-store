var NativeStore = require('strong-store-cluster');

module.exports = installSessionHandler;
module.exports.setup = setup;

var collection = NativeStore.collection('strong-cluster-tls-session-store');

function installSessionHandler(tlsServer) {
  tlsServer.on('newSession', onNewSession);
  tlsServer.on('resumeSession', onResumeSession);
}

function onNewSession(sessionId, sessionData) {
  collection.set(encode(sessionId), encode(sessionData));
}

function onResumeSession(sessionId, callback) {
  collection.get(encode(sessionId), handleGetResponse);

  function handleGetResponse(err, value) {
    var sessionData = null;
    if (!err && value != null) {
      sessionData = decode(value);
    }
    callback(null, sessionData);
  }
}

function encode(buffer) {
  return buffer.toString('binary');
}

function decode(string) {
  return new Buffer(string, 'binary');
}

function setup() {
}
