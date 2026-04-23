class GimletDebuggerSession {
    constructor() {
        this.debugSessionId = null;

        this.executablesPaths = {}; // Map of programName to executablePath
        this.programHashToProgramName = {}; // sha256 -> programName
        this.programIdToHash = {}; // programId -> sha256
        this.currentProgramHash = null;

        this.tcpPort = null;
    }

    setProgramNameForHash(programHash, programName) {
        this.programHashToProgramName[programHash] = programName;
    }

    reset() {
        this.debugSessionId = null;
        this.executablesPaths = {};
        this.programHashToProgramName = {};
        this.programIdToHash = {};
        this.currentProgramHash = null;
        this.tcpPort = null;
    }
}

// Factory function to create a new session
function createSessionState() {
    return new GimletDebuggerSession();
}

module.exports = {
    createSessionState,
};
