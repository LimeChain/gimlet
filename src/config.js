const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { globalState } = require('./state/globalState');
const { log } = require('./logger');

function surfaceConfigValidation({ errors, unknownKeys }) {
    if (errors.length > 0) {
        const body = errors.map((e) => `  - ${e}`).join('\n');
        vscode.window.showErrorMessage(
            `Gimlet config has ${errors.length} issue${errors.length === 1 ? '' : 's'}. Invalid keys were ignored and defaults kept:\n${body}`
        );
    }
    if (unknownKeys.length > 0) {
        log(`Gimlet: unknown gimlet.json key${unknownKeys.length === 1 ? '' : 's'} ignored: ${unknownKeys.join(', ')}`);
    }
}

class GimletConfigManager {
    constructor() {
        this.workspaceFolder = null;
        this.depsPath = null;
        this.tracePath = null;
    }

    resolveWorkspaceFolder() {
        const folders = vscode.workspace.workspaceFolders;
        if (!folders || folders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder found.');
            return null;
        }

        // TODO(lime): multi-root workspaces always picks folders[0]
        this.workspaceFolder = folders[0].uri.fsPath;
        globalState.globalWorkspaceFolder = this.workspaceFolder;
        return this.workspaceFolder;
    }

    resolveGimletConfig() {
        const workspaceFolder = this.resolveWorkspaceFolder();
        if (!workspaceFolder) return null;

        // depsPath: gimlet.json override (workspace-relative, containment-checked)
        //        → CARGO_TARGET_DIR env var, if set (used as-is; may live outside workspace)
        //        → workspace/target/deploy/debug default
        if (globalState.depsPathOverride) {
            const resolved = path.resolve(workspaceFolder, globalState.depsPathOverride);
            if (!resolved.startsWith(workspaceFolder + path.sep)) {
                vscode.window.showErrorMessage('Gimlet: depsPath must be within the workspace directory.');
                return null;
            }
            this.depsPath = resolved;
        } else if (process.env.CARGO_TARGET_DIR) {
            this.depsPath = path.join(process.env.CARGO_TARGET_DIR, 'deploy', 'debug');
        } else {
            this.depsPath = path.join(workspaceFolder, 'target', 'deploy', 'debug');
        }

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

        return {
            depsPath: this.depsPath,
            tracePath: this.tracePath,
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
                const validation = globalState.setConfig(existingConfig);
                surfaceConfigValidation(validation);
            } catch (err) {
                vscode.window.showErrorMessage('Failed to read existing Gimlet config, recreating: ' + err.message);
            }
        }

        // TODO(lime): writeFileSync rewrites gimlet.json on every activation. Only write when merged content differs from existing
        fs.writeFileSync(configPath, JSON.stringify(configToWrite, null, 4));
        return configPath;
    }

    watchGimletConfig(context) {
        // TODO(lime): watcher leak — this method runs on every activateDebugger() call. Dispose previous watcher or guard against re-registration
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return;

        const configPath = path.join(workspaceFolder, '.vscode', 'gimlet.json');
        const watcher = vscode.workspace.createFileSystemWatcher(configPath);

        watcher.onDidChange(() => {
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configContent);

                const validation = globalState.setConfig(config);
                this.resolveGimletConfig();
                surfaceConfigValidation(validation);

                if (validation.errors.length === 0) {
                    vscode.window.showInformationMessage('Gimlet config updated and state refreshed.');
                }
            } catch (err) {
                vscode.window.showErrorMessage('Failed to reload Gimlet config: ' + err.message);
            }
        });

        context.subscriptions.push(watcher);
    }
}

const gimletConfigManager = new GimletConfigManager();

module.exports = gimletConfigManager;