const crypto = require('crypto');
const si = require('systeminformation');
const vscode = require('vscode');
const { debugConfigManager } = require('./debugConfigManager');
const { getDebuggerSession } = require('./sessionManager');
const { globalState } = require('../state/globalState');
const { log } = require('../logger');

async function withLldbConfig(updates, fn) {
    const lldbConfig = vscode.workspace.getConfiguration('lldb');
    const originals = {};
    for (const key of Object.keys(updates)) {
        originals[key] = lldbConfig.get(key);
    }
    try {
        for (const [key, value] of Object.entries(updates)) {
            await lldbConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
        }
        return await fn();
    } finally {
        for (const [key, value] of Object.entries(originals)) {
            await lldbConfig.update(key, value, vscode.ConfigurationTarget.Workspace);
        }
    }
}

function awaitDebugSessionStart(sessionName, timeoutMs) {
    let listener;
    let timeout;
    let settled = false;

    const promise = new Promise((resolve, reject) => {
        listener = vscode.debug.onDidStartDebugSession(session => {
            if (session.name === sessionName) {
                settled = true;
                clearTimeout(timeout);
                listener.dispose();
                resolve(session);
            }
        });

        timeout = setTimeout(() => {
            settled = true;
            listener.dispose();
            reject(new Error(`Debug session did not start within ${timeoutMs / 1000} seconds`));
        }, timeoutMs);
    });

    const cancel = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        listener.dispose();
    };

    return { promise, cancel };
}

class PortManager {
    constructor() {
        this.pollingToken = null;
        this.cleanupTimer = null;
    }

    async isPortOpen(port) {
        try {
            const connections = await si.networkConnections();
            return connections.some(c => c.localPort === String(port) && (c.protocol === 'tcp4' || c.protocol === 'tcp') && c.state === 'LISTEN');
        } catch (err) {
            log(`Port check failed: ${err.message}`);
            return false;
        }
    }

    async listenAndStartDebugForPort(port) {
        if (this.pollingToken) return;

        if (!(await this.isPortOpen(port))) {
            vscode.window.showErrorMessage(`Gimlet: No debug session found on port ${port}. Make sure your test is running with SBF_DEBUG_PORT=${port}, or change the port in .vscode/gimlet.json (tcpPort).`);
            return;
        }

        const myToken = Symbol();
        this.pollingToken = myToken;

        while (this.pollingToken === myToken) {
            if (await this.isPortOpen(port)) {
                const shouldContinue = await this.runDebugSessionIteration(port, myToken);
                if (!shouldContinue) break;
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.pollingToken = null;
    }

    async runDebugSessionIteration(port, myToken) {
        const metadataId = crypto.randomUUID();
        const launchConfig = debugConfigManager.getLaunchConfig(port, metadataId);
        const { promise: sessionPromise, cancel: cancelSessionWait } = awaitDebugSessionStart(launchConfig.name, 30000);

        this.cancelCleanupTimer();
        log('Starting debug session on port:', port);

        let vsDebugSession;
        try {
            const pythonPath = debugConfigManager.getLldbPythonPath();
            const currentPythonPath = process.env.PYTHONPATH || '';
            const updates = {
                library: globalState.lldbLibrary,
                adapterEnv: { PYTHONPATH: currentPythonPath ? `${pythonPath}:${currentPythonPath}` : pythonPath },
            };
            vsDebugSession = await withLldbConfig(updates, async () => {
                await vscode.debug.startDebugging(globalState.globalWorkspaceFolder, launchConfig);
                log('Waiting for debug session to start...');
                return sessionPromise;
            });
        } catch (err) {
            cancelSessionWait();
            log(`Debug session failed to start: ${err.message}`);
            vscode.window.showErrorMessage(`Gimlet: ${err.message}`);
            return false;
        }

        log('Debug session started, connected to gdbstub on port:', port);

        const gimletSession = getDebuggerSession();
        if (gimletSession && !gimletSession.debugSessionId) {
            gimletSession.debugSessionId = vsDebugSession.id;
        }

        log('Loading program modules...');
        try {
            await debugConfigManager.loadProgramModules(vsDebugSession, metadataId);
        } catch (err) {
            log(`Failed to load program modules: ${err.message}`);
            vscode.window.showErrorMessage(`Gimlet: ${err.message}`);
            await vscode.debug.stopDebugging();
            return false;
        }
        log('Program modules loaded');

        log('Waiting for next program on port:', port);
        while (this.pollingToken === myToken) {
            if (await this.isPortOpen(port)) {
                log('Next program ready on port:', port);
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        return true;
    }

    isPolling() {
        return this.pollingToken !== null;
    }

    scheduleCleanup(onCleanup) {
        this.cancelCleanupTimer();
        this.cleanupTimer = setTimeout(() => {
            log('No new program detected after session ended, cleaning up.');
            this.cleanup();
            if (onCleanup) onCleanup();
        }, 3000);
    }

    cancelCleanupTimer() {
        if (this.cleanupTimer) {
            clearTimeout(this.cleanupTimer);
            this.cleanupTimer = null;
        }
    }

    cleanup() {
        this.cancelCleanupTimer();
        this.pollingToken = null;
    }
}

const portManager = new PortManager();

module.exports = portManager;
