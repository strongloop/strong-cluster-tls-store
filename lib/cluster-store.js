var NativeStore = require('strong-store-cluster');

module.exports = ClusterStore;

function ClusterStore() {
  this._collection = NativeStore.collection('strong-cluster-tls-session-store');
}

ClusterStore.setup = function() {

};

ClusterStore.prototype.intercept = function(tlsServer) {
  var self = this;

  tlsServer.on('newSession', function(sessionId, sessionData) {
    self._onNewSession(sessionId, sessionData);
  });

  tlsServer.on('resumeSession', function(sessionId, callback) {
    self._onResumeSession(sessionId, callback);
  });
};

ClusterStore.prototype._onNewSession = function(sessionId, sessionData) {
  this._collection.set(
    sessionId.toString('binary'),
    sessionData.toString('binary')
  );
};

ClusterStore.prototype._onResumeSession = function(sessionId, callback) {
  this._collection.get(
    sessionId.toString('binary'),
    function(err, value) {
      var sessionData = null;
      if (!err && value != null) {
        sessionData = new Buffer(value, 'binary');
      }
      callback(null, sessionData);
    }
  );
};
