
// Manages the state of the current debugging session
// Allows setting, getting, and clearing the session state
let debuggerSession = null;

function getDebuggerSession() { return debuggerSession; }
function setDebuggerSession(session) { debuggerSession = session; }
function clearDebuggerSession() { debuggerSession = null; }

module.exports = { getDebuggerSession, setDebuggerSession, clearDebuggerSession };