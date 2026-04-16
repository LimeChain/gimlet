const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { globalState } = require('./state/globalState');

class GimletConfigManager {
    constructor() {
        this.workspaceFolder = null;
        this.depsPath = null;
        this.tracePath = null;
        this.inputPath = null;
    }

    resolveWorkspaceFolder() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return null;
        }

        this.workspaceFolder = folders[0].uri.fsPath;
        globalState.globalWorkspaceFolder = this.workspaceFolder;
        return this.workspaceFolder;
    }

    resolveGimletConfig() {
        const workspaceFolder = this.resolveWorkspaceFolder();
        if (!workspaceFolder) return null;

        this.depsPath = path.join(workspaceFolder, 'target', 'deploy', 'debug'); // TODO(lime): Make this configurable
        if (globalState.sbfTraceDir) {
            const resolved = path.resolve(workspaceFolder, globalState.sbfTraceDir);
            if (!resolved.startsWith(workspaceFolder + path.sep)) {
                vscode.window.showErrorMessage('Gimlet: sbfTraceDir must be within the workspace directory.');
                return null;
            }
            this.tracePath = resolved;
        } else {
            this.tracePath = path.join(workspaceFolder, 'target', 'sbf', 'trace');
        }
        this.inputPath = path.join(workspaceFolder, 'input'); // TODO(lime): Make this configurable

        return {
            depsPath: this.depsPath,
            tracePath: this.tracePath,
            inputPath: this.inputPath
        };
    }

    async ensureGimletConfig() {
        const workspaceFolder = this.resolveWorkspaceFolder();
        if (!workspaceFolder) return null;

        const vscodeDir = path.join(workspaceFolder, '.vscode');
        const configPath = path.join(vscodeDir, 'gimlet.json');
        
        const defaultConfig = {
            tcpPort: globalState.tcpPort,
            platformToolsVersion: globalState.platformToolsVersion,
            stopOnEntry: globalState.stopOnEntry,
        };

        if (!fs.existsSync(vscodeDir)) {
            fs.mkdirSync(vscodeDir);
        }

        let configToWrite = defaultConfig;
        if (fs.existsSync(configPath)) {
            try {
                const existingConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                // Merge existing config with defaults (existing values take precedence)
                configToWrite = { ...defaultConfig, ...existingConfig };
                globalState.setConfig(existingConfig);
            } catch (err) {
                vscode.window.showErrorMessage('Failed to read existing Gimlet config, recreating: ' + err.message);
            }
        }

        fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 4));
        return configPath;
    }

    watchGimletConfig(context) {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return;

        const configPath = path.join(workspaceFolder, '.vscode', 'gimlet.json');
        const watcher = vscode.workspace.createFileSystemWatcher(configPath);

        watcher.onDidChange(() => {
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configContent);

                // Update your state here
                globalState.setConfig(config);
                this.resolveGimletConfig();

                vscode.window.showInformationMessage('Gimlet config updated and state refreshed.');
            } catch (err) {
                vscode.window.showErrorMessage('Failed to reload Gimlet config: ' + err.message);
            }
        });

        context.subscriptions.push(watcher);
    }
}

const gimletConfigManager = new GimletConfigManager();

module.exports = gimletConfigManager;