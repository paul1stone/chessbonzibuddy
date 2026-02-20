// Worker wrapper that bridges standard Worker API <-> Stockfish module API
importScripts('stockfish.js');

// Stockfish is a factory function exported by the IIFE in stockfish.js
var engine = typeof Stockfish === 'function' ? Stockfish() : Stockfish;

// Forward UCI commands from main thread to Stockfish engine
self.onmessage = function(e) {
  engine.postMessage(e.data);
};

// Forward Stockfish output back to main thread
engine.addMessageListener(function(line) {
  self.postMessage(line);
});
