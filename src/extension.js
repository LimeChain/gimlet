const vscode = require('vscode');
const path = require('path');

const gimletConfigManager  = require('./config');
const { globalState } = require('./state/globalState');
const { createSessionState } = require('./state/sessionState');

const { GimletCodeLensProvider } = require('./lens/gimletCodeLensProvider');

const { rustAnalyzerSettingsManager, editorSettingsManager } = require('./managers/vscodeSettingsManager');
const portManager = require('./managers/portManager')


const { setDebuggerSession, clearDebuggerSession } = require('./managers/sessionManager');

const { workspaceHasLitesvmOrMollusk } = require('./utils');
const { isSessionRunning } = require('./debug');
const { safeReadDir } = require('./projectStructure');

const crypto = require('crypto');
const fs = require('fs');
const { log, error } = require('./logger');

// TODO(lime): duplicate debuggerSession state — also tracked in sessionManager.js. Collapse to one source of truth
let debuggerSession = null;
// Global array ofr disposables that belong to activateDebugger
let debuggerDisposables = [];
let isActivationInProgress = false;

function loadProgramIdMap(session, tracePath) {
    const mapFile = path.join(tracePath, 'program_ids.map');
    if (!fs.existsSync(mapFile)) {
        vscode.window.showErrorMessage(`Gimlet: program_ids.map not found at ${mapFile}. Make sure SBF_TRACE_DIR is set correctly when running tests, or configure sbfTracePath (relative to workspace root) in .vscode/gimlet.json.`);
        return false;
    }

    const content = fs.readFileSync(mapFile, 'utf8'); // TODO(lime): any possible collisions?
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        const [programId, hash] = trimmed.split('=');
        if (programId && hash) {
            session.programIdToHash[programId.trim()] = hash.trim();
        }
    }
    return true;
}

async function scanDeployDirectory(session) {
    const cfg = gimletConfigManager.resolveGimletConfig();
    if (!cfg) return false;
    const { artifactPath, tracePath } = cfg;

    const files = await safeReadDir(artifactPath);
    if (!files) {
        vscode.window.showErrorMessage(`No compiled programs found in ${artifactPath}. Please build your program first with: cargo-build-sbf --tools-version v1.54 --debug --arch v1`);
        return false;
    }

    let soCount = 0;
    for (const file of files) {
        if (!file.endsWith('.so')) continue;
        soCount++;

        const soPath = path.join(artifactPath, file);
        const hash = crypto.createHash('sha256').update(fs.readFileSync(soPath)).digest('hex'); // TODO(lime): any chance of too big .so files?
        session.setProgramNameForHash(hash, file);

        session.executablesPaths[file] = {
            debugBinary: path.join(artifactPath, file + '.debug'),
            bpfCompiledPath: soPath,
        };
    }

    if (soCount === 0) {
        vscode.window.showErrorMessage(
            `Gimlet: no .so files found in ${artifactPath}. ` +
            `artifactPath must point at the directory that directly contains your compiled programs (with their .so.debug siblings). ` +
            `For standard Cargo builds this is "target/deploy/debug", not "target" itself.`
        );
        return false;
    }

    if (!loadProgramIdMap(session, tracePath)) return false;
    return true;
}

// ============== VSCODE COMMANDS ==============
/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    await activateDebugger(context);

    // TODO(lime): file-watcher - every Cargo.toml save triggers full re-activation
    const watcher = vscode.workspace.createFileSystemWatcher('**/Cargo.toml');
    watcher.onDidChange(() => activateDebugger(context));
    watcher.onDidCreate(() => activateDebugger(context));
    watcher.onDidDelete(() => activateDebugger(context));

    context.subscriptions.push(watcher);
}

function deactivate() {
    cleanupDebuggerSession();
}

async function activateDebugger(context) {
    // TODO(lime): re-activation drops pending debug sessions — if called mid-session (via Cargo.toml watcher), disposes the termination listener so cleanup never fires and debuggerSession stays stale. Check isSessionRunning() before disposing
    if (isActivationInProgress) {
        return;
    }

    isActivationInProgress = true;

    try {
        log('Activating debugger...');
        // Dispose all old resources before reinitializing
        for (const d of debuggerDisposables) {
            try { d.dispose(); } catch {}
        }
        debuggerDisposables = [];

        // TODO(lime): multi-root workspaces are silently ignored — grabs workspaceFolders[0]
        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
        if (!workspaceUri) {
            log('No workspace folder found');
            return;
        }

        const rootPath = workspaceUri.fsPath;
        log('Checking for litesvm/mollusk in:', rootPath);
        const hasLitesvmOrMollusk = await workspaceHasLitesvmOrMollusk(rootPath);

        if (!hasLitesvmOrMollusk) {
            log('litesvm/mollusk not found, skipping activation');
            return;
        }
        log('litesvm/mollusk found, proceeding');

        gimletConfigManager.ensureGimletConfig();
        gimletConfigManager.watchGimletConfig(context);

        // Set necessary VS Code settings for optimal debugging experience
        // TODO(lime): rust-analyzer.debug.engine silently overwritten at workspace level, never restored. Hostile to users who prefer a different engine
        await rustAnalyzerSettingsManager.set('debug.engine', 'vadimcn.vscode-lldb');
        // TODO(lime): editor.codeLens force-set at workspace level
        await editorSettingsManager.set('codeLens', true);
        log('Settings configured');
    
        // This is automated script to check dependencies for Gimlet
        const setupDisposable = vscode.commands.registerCommand(
            'extension.runGimletSetup',
            () => {
                const scriptPath = path.join(context.extensionPath, 'scripts/gimlet-setup.sh');
    
                // Create a terminal to show the output
                const terminal = vscode.window.createTerminal('Gimlet Setup');
                terminal.show();
                terminal.sendText(`bash "${scriptPath}"`);
            }
        );
    
        // Register provider for the Rust files
        const codeLensDisposable = vscode.languages.registerCodeLensProvider(
            [{ language: 'rust' }, { language: 'typescript' }],
            new GimletCodeLensProvider()
        );
    
        // Listener to handle when debug ends
        const debugListener = vscode.debug.onDidTerminateDebugSession(session => {
            log('Debug session terminated:', session.name);
            if (portManager.isPolling()) {
                portManager.scheduleCleanup(() => cleanupDebuggerSession());
            } else {
                cleanupDebuggerSession();
            }
        });

        const stopDisposable = vscode.commands.registerCommand('gimlet.stopSession', () => {
            log('Stopping Gimlet session');
            portManager.cleanup();
            cleanupDebuggerSession();
            vscode.debug.stopDebugging();
        });
            
        // TODO(lime): CodeLens passes [document, line] as command args but this handler ignores them — "Debug at Line" doesn't actually know which line was clicked
        const sbpfDebugDisposable = vscode.commands.registerCommand('gimlet.debugAtLine', async () => {
            // Block launch when gimlet.json has any validation error. Falling back
            // to defaults would silently mask the user's bad value.
            if (globalState.lastConfigErrors.length > 0) {
                const body = globalState.lastConfigErrors.map((e) => `  - ${e}`).join('\n');
                vscode.window.showErrorMessage(
                    `Gimlet: cannot start debug — fix gimlet.json first:\n${body}`
                );
                return;
            }

            // Prevent starting a new session if one is already running
            if (isSessionRunning()) {
                vscode.window.showInformationMessage('A Gimlet debug session is already running. Please stop the current session before starting a new one.');
                return;
            }

            // Always create a new session state for a new debug session
            const sessionStateInstance = createSessionState();
            setDebuggerSession(sessionStateInstance);
            debuggerSession = sessionStateInstance;
            
            debuggerSession.tcpPort = globalState.tcpPort;

            try {
                log('Starting debug session...');
                const scanned = await scanDeployDirectory(debuggerSession);
                if (!scanned) return;
                log('Scanned deploy directory:', JSON.stringify(debuggerSession.executablesPaths));
                log('Program ID map:', JSON.stringify(debuggerSession.programIdToHash));
                log('Hash to name map:', JSON.stringify(debuggerSession.programHashToProgramName));

                log('Starting port listener on port:', debuggerSession.tcpPort);
                await startPortDebugListener();
            } catch (err) {
                error('Error:', err);
                vscode.window.showErrorMessage(`Failed to debug with Gimlet: ${err.message}`);
            }
        });
            
        // Add all disposables to context subscriptions
        debuggerDisposables.push(
            setupDisposable,
            codeLensDisposable,
            sbpfDebugDisposable,
            debugListener,
            stopDisposable
        )
        log('Activation complete, CodeLens registered');

    } catch (err) {
        error('Error during activateDebugger:', err);
    } finally {
        isActivationInProgress = false;
    }
}

async function startPortDebugListener() {
    await portManager.listenAndStartDebugForPort(debuggerSession.tcpPort);
}

function cleanupDebuggerSession() {
    debuggerSession = null;
    clearDebuggerSession();
}

module.exports = {
    activate,
    deactivate,
};

