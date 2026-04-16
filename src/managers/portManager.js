const crypto = require('crypto');
const { exec } = require('child_process');
const vscode = require('vscode');
const { debugConfigManager } = require('./debugConfigManager');
const { getDebuggerSession } = require('./sessionManager');
const { globalState } = require('../state/globalState');
const { log } = require('../logger');

class PortManager {
    constructor() {
        this.pollingToken = null;
        this.cleanupTimer = null;
    }

    async isPortOpen(port) {
        return new Promise((resolve) => {
            exec(
                `netstat -nat | grep -E '[:|.]${port}\\b' | grep 'LISTEN' | wc -l`,
                (err, stdout) => {
                    const isOpen = stdout.trim() === '1';
                    resolve(isOpen);
                }
            );
        });
    }

    async listenAndStartDebugForPort(port) {
        if (this.pollingToken) return;

        const myToken = Symbol();
        this.pollingToken = myToken;

        while (this.pollingToken === myToken) {
            const isOpen = await this.isPortOpen(port);

            if (isOpen) {
                const metadataId = crypto.randomUUID();
                const launchConfig = debugConfigManager.getLaunchConfig(port, metadataId);

                const sessionPromise = new Promise(resolve => {
                    const listener = vscode.debug.onDidStartDebugSession(session => {
                        if (session.name === launchConfig.name) {
                            listener.dispose();
                            resolve(session);
                        }
                    });
                });

                this.cancelCleanupTimer();
                log('Starting debug session on port:', port);
                const lldbConfig = vscode.workspace.getConfiguration('lldb');
                const originalLibrary = lldbConfig.get('library');
                const originalAdapterEnv = lldbConfig.get('adapterEnv');

                const pythonPath = debugConfigManager.getLldbPythonPath();
                if (pythonPath) {
                    const currentPythonPath = process.env.PYTHONPATH || '';
                    const newPythonPath = currentPythonPath ? `${pythonPath}:${currentPythonPath}` : pythonPath;
                    await lldbConfig.update('adapterEnv', { PYTHONPATH: newPythonPath }, vscode.ConfigurationTarget.Workspace);
                }
                await lldbConfig.update('library', globalState.lldbLibrary, vscode.ConfigurationTarget.Workspace);

                await vscode.debug.startDebugging(globalState.globalWorkspaceFolder, launchConfig);
                log('Waiting for debug session to start...');
                const vsDebugSession = await sessionPromise;

                await lldbConfig.update('adapterEnv', originalAdapterEnv, vscode.ConfigurationTarget.Workspace);
                await lldbConfig.update('library', originalLibrary, vscode.ConfigurationTarget.Workspace);
                log('Debug session started, connected to gdbstub on port:', port);

                const gimletSession = getDebuggerSession();
                if (gimletSession && !gimletSession.debugSessionId) {
                    gimletSession.debugSessionId = vsDebugSession.id;
                }

                log('Loading program modules...');
                const loaded = await debugConfigManager.loadProgramModules(vsDebugSession, metadataId);
                log('Program modules loaded:', loaded);
                if (!loaded) {
                    vscode.window.showErrorMessage('Failed to load program modules. Stopping debug session.');
                    this.pollingToken = null;
                    await vscode.debug.stopDebugging();
                    break;
                }

                // Wait for port to enter LISTEN again (next program ready)
                log('Waiting for next program on port:', port);
                while (this.pollingToken === myToken) {
                    const listening = await this.isPortOpen(port);
                    if (listening) {
                        log('Next program ready on port:', port);
                        break;
                    }
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        this.pollingToken = null;
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
