const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { globalState } = require('./state/globalState');
const { log } = require('./logger');

function isInsideWorkspace(resolved, workspaceFolder) {
    // path.relative handles case-insensitive comparison on Windows/macOS and
    // mismatched separators. A contained path produces a relative result that
    // is neither absolute (different drive on Windows) nor starts with '..'.
    const rel = path.relative(workspaceFolder, resolved);
    if (rel === '') return false; 
    if (path.isAbsolute(rel)) return false;
    const first = rel.split(path.sep)[0];
    return first !== '..';
}

function surfaceConfigValidation({ errors, unknownKeys }) {
    if (errors.length > 0) {
        const body = errors.map((e) => `  - ${e}`).join('\n');
        vscode.window.showErrorMessage(
            `Gimlet config has ${errors.length} issue${errors.length === 1 ? '' : 's'}. Invalid keys were ignored and defaults kept:\n${body}`
        );
    }
    if (unknownKeys.length > 0) {
        log(
            `Gimlet: unknown gimlet.json key${unknownKeys.length === 1 ? '' : 's'} ignored: ${unknownKeys.join(', ')}`
        );
    }
}

class GimletConfigManager {
    constructor() {
        this.workspaceFolder = null;
        this.artifactPath = null;
        this.tracePath = null;
        this._configWatcher = null;
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

        // artifactPath: gimlet.json override (workspace-relative, containment-checked)
        //        → CARGO_TARGET_DIR env var, if set (used as-is; may live outside workspace)
        //        → workspace/target/deploy/debug default
        if (globalState.artifactPathOverride) {
            const resolved = path.resolve(
                workspaceFolder,
                globalState.artifactPathOverride
            );
            if (!isInsideWorkspace(resolved, workspaceFolder)) {
                vscode.window.showErrorMessage(
                    'Gimlet: artifactPath must be within the workspace directory.'
                );
                return null;
            }
            this.artifactPath = resolved;
        } else if (process.env.CARGO_TARGET_DIR) {
            this.artifactPath = path.join(
                process.env.CARGO_TARGET_DIR,
                'deploy',
                'debug'
            );
        } else {
            this.artifactPath = path.join(
                workspaceFolder,
                'target',
                'deploy',
                'debug'
            );
        }

        if (globalState.sbfTraceDir) {
            const resolved = path.resolve(
                workspaceFolder,
                globalState.sbfTraceDir
            );
            if (!isInsideWorkspace(resolved, workspaceFolder)) {
                vscode.window.showErrorMessage(
                    'Gimlet: sbfTraceDir must be within the workspace directory.'
                );
                return null;
            }
            this.tracePath = resolved;
        } else {
            this.tracePath = path.join(
                workspaceFolder,
                'target',
                'sbf',
                'trace'
            );
        }

        return {
            artifactPath: this.artifactPath,
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
                const existingConfig = JSON.parse(
                    fs.readFileSync(configPath, 'utf8')
                );
                // Merge existing config with defaults (existing values take precedence)
                configToWrite = { ...defaultConfig, ...existingConfig };
                const validation = globalState.setConfig(existingConfig);
                surfaceConfigValidation(validation);
            } catch (err) {
                vscode.window.showErrorMessage(
                    'Failed to read existing Gimlet config, recreating: ' +
                        err.message
                );
            }
        }

        // Diff-then-write: avoid mtime churn and the self-write feedback loop through
        // watchGimletConfig that would otherwise fire on every activation.
        const next = JSON.stringify(configToWrite, null, 4);
        const prev = fs.existsSync(configPath)
            ? fs.readFileSync(configPath, 'utf8')
            : null;
        if (next !== prev) {
            fs.writeFileSync(configPath, next);
        }
        return configPath;
    }

    watchGimletConfig(context) {
        // Dispose any previous watcher — activateDebugger can run multiple times
        // (Cargo.toml saves, manual triggers). Without this, each call registered
        // a new watcher and a single config edit would fire N reload toasts.
        if (this._configWatcher) {
            this._configWatcher.dispose();
            this._configWatcher = null;
        }

        const workspaceFolder =
            vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceFolder) return;

        const configPath = path.join(workspaceFolder, '.vscode', 'gimlet.json');
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(workspaceFolder, '.vscode/gimlet.json')
        );

        const reloadFromDisk = () => {
            try {
                const configContent = fs.readFileSync(configPath, 'utf8');
                const config = JSON.parse(configContent);

                const validation = globalState.setConfig(config);
                this.resolveGimletConfig();
                surfaceConfigValidation(validation);

                if (validation.errors.length === 0) {
                    vscode.window.showInformationMessage(
                        'Gimlet config updated and state refreshed.'
                    );
                }
            } catch (err) {
                vscode.window.showErrorMessage(
                    'Failed to reload Gimlet config: ' + err.message
                );
            }
        };

        const resetToDefaults = () => {
            // File removed — treat as an empty config so every override clears back to null.
            globalState.setConfig({});
            this.resolveGimletConfig();
            vscode.window.showInformationMessage(
                'Gimlet config removed; using defaults.'
            );
        };

        // All three events route through the same handlers. Atomic-save editors
        // (rename+replace on save, common with format-on-save or on Windows) fire
        // onDidDelete + onDidCreate instead of onDidChange — without the Create
        // handler, Gimlet would miss the save entirely.
        watcher.onDidChange(reloadFromDisk);
        watcher.onDidCreate(reloadFromDisk);
        watcher.onDidDelete(resetToDefaults);

        this._configWatcher = watcher;
        context.subscriptions.push(watcher);
    }
}

const gimletConfigManager = new GimletConfigManager();

module.exports = gimletConfigManager;
