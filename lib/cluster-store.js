var NativeStore = require('strong-store-cluster');

module.exports = installSessionHandler;
module.exports.setup = setup;

var collection = NativeStore.collection('strong-cluster-tls-session-store');
collection.configure({
  expireKeys: 300 // 300 seconds is the default value used by openssl
});

var namespaceRegistry = {};

/**
 * Enable TLS session resumption by installing listeners
 * for events related to TLS sessions.
 * @param tlsServer {tls.Server} Instance of node's TLS server,
 *   e.g. `https.Server`.
 * @param namespace {string|undefined} Optional namespace to distinguish
 *  between multiple TLS servers.  The namespace must be unique within
 *  the application and same across all worker processes.
 */
function installSessionHandler(tlsServer, namespace) {
  if (namespace == null) namespace = '';
  if (namespaceRegistry[namespace]) {
    throw new Error('Cannot share TLS sessions between multiple servers. ' +
      'Set a unique namespace in the session-sharing initialization.');
  }

  tlsServer.on('newSession', function(sessionId, sessionData) {
    onNewSession(namespace, sessionId, sessionData);
  });

  tlsServer.on('resumeSession', function(sessionId, callback) {
    onResumeSession(namespace, sessionId, callback);
  });

  namespaceRegistry[namespace] = true;
}

/**
 * Save a new session into the store.
 * @param namespace {string}
 * @param sessionId {Buffer}
 * @param sessionData {Buffer}
 */
function onNewSession(namespace, sessionId, sessionData) {
  collection.set(createKey(namespace, sessionId), encode(sessionData));
}

/**
 * Try to resume a session if it exists.
 * @param namespace {string}
 * @param sessionId {Buffer}
 * @param callback {function(Error, Buffer)}
 */
function onResumeSession(namespace, sessionId, callback) {
  collection.get(createKey(namespace, sessionId), handleGetResponse);

  function handleGetResponse(err, value) {
    var sessionData = null;
    if (!err && value != null) {
      sessionData = decode(value);
    }
    callback(null, sessionData);
  }
}

/**
 * Create a key for a given sessionId.
 * @param namespace {string}
 * @param sessionId {Buffer}
 */
function createKey(namespace, sessionId) {
  return namespace + '.' + encode(sessionId);
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
