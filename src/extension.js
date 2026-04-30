const vscode = require('vscode');
const path = require('path');

const gimletConfigManager  = require('./config');
const { globalState } = require('./state/globalState');
const { createSessionState } = require('./state/sessionState');

const { rustAnalyzerSettingsManager } = require('./managers/vscodeSettingsManager');
const portManager = require('./managers/portManager');
const { StatusBarManager } = require('./managers/statusBarManager');
const { TreeView } = require('./managers/treeView');
const { StateMonitor } = require('./managers/stateMonitor');


const { getDebuggerSession, setDebuggerSession, clearDebuggerSession } = require('./managers/sessionManager');

const { isSessionRunning } = require('./debug');
const { safeReadDir } = require('./projectStructure');

const crypto = require('crypto');
const fs = require('fs');
const { log, error } = require('./logger');

let debuggerDisposables = [];
let stateMonitor = null;
let engaged = false;

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
    const { artifactsPath, tracePath } = cfg;

    const files = await safeReadDir(artifactsPath);
    if (!files) {
        vscode.window.showErrorMessage(`No compiled programs found in ${artifactsPath}. Please build your program first with: cargo-build-sbf --tools-version v${globalState.platformToolsVersion} --debug --arch v1`);
        return false;
    }

    let soCount = 0;
    for (const file of files) {
        if (!file.endsWith('.so')) continue;
        soCount++;

        const soPath = path.join(artifactsPath, file);
        const hash = crypto.createHash('sha256').update(fs.readFileSync(soPath)).digest('hex'); // TODO(lime): any chance of too big .so files?
        session.setProgramNameForHash(hash, file);

        session.executablesPaths[file] = {
            debugBinary: path.join(artifactsPath, file + '.debug'),
            bpfCompiledPath: soPath,
        };
    }

    if (soCount === 0) {
        vscode.window.showErrorMessage(
            `Gimlet: no .so files found in ${artifactsPath}. ` +
            `artifactsPath must point at the directory that directly contains your compiled programs (with their .so.debug siblings). ` +
            `For standard Cargo builds this is "target/deploy/debug", not "target" itself.`
        );
        return false;
    }

    if (!loadProgramIdMap(session, tracePath)) return false;
    return true;
}

// Run the side effects that turn an opened workspace into a Gimlet workspace:
// write .vscode/gimlet.json, attach the config watcher, override
// rust-analyzer's debug engine, and surface the status bar item. Idempotent —
// safe to call from every entry point that needs an engaged extension.
async function engage(context) {
    if (engaged) return;
    engaged = true;

    // TODO(lime): rust-analyzer.debug.engine silently overwritten at workspace level, never restored. Hostile to users who prefer a different engine
    await rustAnalyzerSettingsManager.set('debug.engine', 'vadimcn.vscode-lldb');

    gimletConfigManager.ensureGimletConfig();
    gimletConfigManager.watchGimletConfig(context);

    const bar = new StatusBarManager();
    bar.activate(stateMonitor);
    debuggerDisposables.push(bar);

    await vscode.commands.executeCommand('setContext', 'gimlet.active', true);
    log('Engagement complete');
}

function gimletConfigExists() {
    const folder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!folder) return false;
    return fs.existsSync(path.join(folder, '.vscode', 'gimlet.json'));
}

// ============== VSCODE COMMANDS ==============
/**
 * @param {vscode.ExtensionContext} context
 */
async function activate(context) {
    log('Activating Gimlet...');

    // TODO(lime): multi-root workspaces are silently ignored — grabs workspaceFolders[0]
    const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri;
    if (!workspaceUri) {
        log('No workspace folder found');
        return;
    }

    await vscode.commands.executeCommand('setContext', 'gimlet.active', false);

    stateMonitor = new StateMonitor();

    const treeView = new TreeView();
    treeView.activate(stateMonitor);

    const setupDisposable = vscode.commands.registerCommand(
        'extension.runGimletSetup',
        async () => {
            await engage(context);
            const scriptPath = path.join(context.extensionPath, 'scripts/gimlet-setup.sh');
            const terminal = vscode.window.createTerminal('Gimlet Setup');
            terminal.show();
            terminal.sendText(`bash "${scriptPath}"`);
        }
    );

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

    const attachDisposable = vscode.commands.registerCommand('gimlet.attachDebugger', async () => {
        await engage(context);

        // Block launch when gimlet.json has any validation error. Falling back
        // to defaults would silently mask the user's bad value.
        if (globalState.lastConfigErrors.length > 0) {
            const body = globalState.lastConfigErrors.map((e) => `  - ${e}`).join('\n');
            vscode.window.showErrorMessage(
                `Gimlet: cannot start debug — fix gimlet.json first:\n${body}`
            );
            return;
        }

        if (isSessionRunning()) {
            vscode.window.showInformationMessage('A Gimlet debug session is already running. Please stop the current session before starting a new one.');
            return;
        }

        const session = createSessionState();
        session.tcpPort = globalState.tcpPort;
        setDebuggerSession(session);

        try {
            log('Starting debug session...');
            const scanned = await scanDeployDirectory(session);
            if (!scanned) return;
            log('Scanned deploy directory:', JSON.stringify(session.executablesPaths));
            log('Program ID map:', JSON.stringify(session.programIdToHash));
            log('Hash to name map:', JSON.stringify(session.programHashToProgramName));

            log('Starting port listener on port:', session.tcpPort);
            await startPortDebugListener();
        } catch (err) {
            error('Error:', err);
            vscode.window.showErrorMessage(`Failed to debug with Gimlet: ${err.message}`);
        }
    });

    debuggerDisposables.push(
        setupDisposable,
        stateMonitor,
        treeView,
        attachDisposable,
        debugListener,
        stopDisposable
    );

    // A workspace that already has .vscode/gimlet.json has engaged before — keep
    // the status bar and palette commands available without forcing the user to
    // click Attach again.
    if (gimletConfigExists()) {
        await engage(context);
    }

    log('Activation complete');
}

async function deactivate() {
    for (const d of debuggerDisposables) {
        try { d.dispose(); } catch (err) { error('Disposable threw during deactivate:', err); }
    }
    debuggerDisposables = [];
    stateMonitor = null;
    engaged = false;
    cleanupDebuggerSession();
    await vscode.commands.executeCommand('setContext', 'gimlet.active', false);
}

async function startPortDebugListener() {
    await portManager.listenAndStartDebugForPort(getDebuggerSession().tcpPort);
}

function cleanupDebuggerSession() {
    clearDebuggerSession();
    stateMonitor?.tick();
}

module.exports = {
    activate,
    deactivate,
};
