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

let debuggerSession = null;
// Global array ofr disposables that belong to activateDebugger
let debuggerDisposables = [];
let isActivationInProgress = false;

function loadProgramIdMap(session, tracePath) {
    const mapFile = path.join(tracePath, 'program_ids.map');
    if (!fs.existsSync(mapFile)) {
        vscode.window.showErrorMessage(`Gimlet: program_ids.map not found at ${mapFile}. Make sure SBF_TRACE_DIR is set correctly when running tests, or configure sbfTraceDir (relative to workspace root) in .vscode/gimlet.json.`);
        return false;
    }

    const content = fs.readFileSync(mapFile, 'utf8');
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
    const { depsPath, tracePath } = gimletConfigManager.resolveGimletConfig();
    if (!depsPath) return false;

    const files = await safeReadDir(depsPath);
    if (!files) {
        vscode.window.showErrorMessage(`No compiled programs found in ${depsPath}. Please build your program first with: cargo-build-sbf --tools-version v1.54 --debug --arch v1`);
        return false;
    }

    for (const file of files) {
        if (!file.endsWith('.so')) continue;

        const soPath = path.join(depsPath, file);
        const hash = crypto.createHash('sha256').update(fs.readFileSync(soPath)).digest('hex');
        session.setProgramNameForHash(hash, file);

        session.executablesPaths[file] = {
            debugBinary: path.join(depsPath, file + '.debug'),
            bpfCompiledPath: soPath,
        };
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
        await rustAnalyzerSettingsManager.set('debug.engine', 'vadimcn.vscode-lldb');
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
            
        const sbpfDebugDisposable = vscode.commands.registerCommand('gimlet.debugAtLine', async () => {
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
    portManager.listenAndStartDebugForPort(debuggerSession.tcpPort);
}

function cleanupDebuggerSession() {
    debuggerSession = null;
    clearDebuggerSession();
}

module.exports = {
    activate,
    deactivate,
};

