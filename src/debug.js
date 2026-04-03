const { getDebuggerSession } = require("./managers/sessionManager");

/**
 * Check if a Gimlet debugger session is already active.
 */
function isSessionRunning() {
    const debuggerSession = getDebuggerSession();
    return debuggerSession && debuggerSession.debugSessionId;
}

module.exports = {
    isSessionRunning
}