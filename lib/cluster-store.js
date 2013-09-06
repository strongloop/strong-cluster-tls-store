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
 * @param {tls.Server} tlsServer Instance of node's TLS server,
 *   e.g. `https.Server`.
 * @param {String} namespace Optional namespace to distinguish between multiple TLS servers. The namespace must be unique within the application and same across all worker processes.
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
 * @param {String} namespace The namespace used to store the session data.
 * @param {Buffer} sessionId The id used to identify the session.
 * @param {Buffer} sessionData The data describing the session state.
 * @private
 */
function onNewSession(namespace, sessionId, sessionData) {
  collection.set(createKey(namespace, sessionId), encode(sessionData));
}

/**
 * Try to resume a session if it exists.
 * @param {String} namespace The namespace where the session data exists.
 * @param {Buffer} sessionId The id of the session.
 * @param {Function} callback A callback of type function(Error, Buffer)
 * @private
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
 * Creates a key for a given sessionId and namespace.
 * @param {String} namespace The namespace where the session resides.
 * @param {Buffer} sessionId The id used to refer to the session.
 * @return {String} The identifying key for the session.
 * @private
 */
function createKey(namespace, sessionId) {
  return namespace + '.' + encode(sessionId);
}

/**
 * Encodes a Buffer into a value acceptable by NativeStore.
 * @param {Buffer} buffer A Node.js Buffer holding session information.
 * @return {String} A string representation of the Buffer.
 * @private
 */
function encode(buffer) {
  return buffer.toString('binary');
}

/**
 * Encode a string encode into a Buffer.
 * @param {string} string A string to place into a buffer.
 * @returns {Buffer} A buffer with the string encoded into it.
 * @private
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
