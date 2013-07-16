var NativeStore = require('strong-store-cluster');

module.exports = installSessionHandler;
module.exports.setup = setup;

var collection = NativeStore.collection('strong-cluster-tls-session-store');
collection.configure({
  expireKeys: 300 // 300 seconds is the default value used by openssl
});

/**
 * Enable TLS session resumption by installing listeners
 * for events related to TLS sessions.
 * @param tlsServer {tls.Server} Instance of node's TLS server,
 *   e.g. `https.Server`.
 */
function installSessionHandler(tlsServer) {
  tlsServer.on('newSession', onNewSession);
  tlsServer.on('resumeSession', onResumeSession);
}

/**
 * Save a new session into the store.
 * @param sessionId {Buffer}
 * @param sessionData {Buffer}
 */
function onNewSession(sessionId, sessionData) {
  collection.set(encode(sessionId), encode(sessionData));
}

/**
 * Try to resume a session if it exists.
 * @param sessionId {Buffer}
 * @param callback {function(Error, Buffer)}
 */
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

/**
 * Encode a Buffer into a value acceptable by NativeStore.
 * @param buffer
 * @returns {string}
 */
function encode(buffer) {
  return buffer.toString('binary');
}

/**
 * Decode a value created by `encode` into a Buffer.
 * @param string {string}
 * @returns {Buffer}
 */
function decode(string) {
  return new Buffer(string, 'binary');
}

/**
 * Documentation marker for explicit setup of the shared-state server
 * in the master process. The initialization happens when this module
 * is required, thus calling this function is entirely optional.
 */
function setup() {
}
