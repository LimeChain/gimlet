
// Manages the state of the current debugging session
// Allows setting, getting, and clearing the session state
// TODO(lime): duplicate debuggerSession state — also tracked as a module-level let in extension.js. Collapse to one source of truth
let debuggerSession = null;

function getDebuggerSession() { return debuggerSession; }
function setDebuggerSession(session) { debuggerSession = session; }
function clearDebuggerSession() { debuggerSession = null; }

module.exports = { getDebuggerSession, setDebuggerSession, clearDebuggerSession };