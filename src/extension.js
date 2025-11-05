const vscode = require('vscode');
const path = require('path');

const gimletConfigManager  = require('./config');
const { globalState } = require('./state/globalState');
const { createSessionState } = require('./state/sessionState');

const { SbpfV1BuildStrategy } = require('./build/sbpfV1BuildStrategy');
const { GimletCodeLensProvider } = require('./lens/gimletCodeLensProvider');

const { lldbSettingsManager, rustAnalyzerSettingsManager, editorSettingsManager } = require('./managers/vscodeSettingsManager');
const portManager = require('./managers/portManager')
const { debugConfigManager } = require('./managers/debugConfigManager');

const { setDebuggerSession, clearDebuggerSession } = require('./managers/sessionManager');
const { VM_DEBUG_EXEC_INFO_FILE } = require('./constants');

const { workspaceHasLitesvmOrMollusk } = require('./utils');
const { isSessionRunning, hasSupportedBackend } = require('./debug');

let debuggerSession = null;
// Global array ofr disposables that belong to activateDebugger
let debuggerDisposables = [];
let isActivationInProgress = false;

async function SbpfCompile() {
    // TODO: Implement a dispatcher for different build strategies if we decide to add more in the future
    debuggerSession.buildStrategy = new SbpfV1BuildStrategy(globalState.globalWorkspaceFolder);

    return vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Setting Gimlet',
            cancellable: false,
        },
        async (progress) => {
            try {
                const buildResult = await debuggerSession.buildStrategy.build(progress);
                if (!buildResult) return;
            } catch (err) {
                vscode.window.showErrorMessage(`Build failed: ${err.message}`);
            }
        }
    );
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
        // Dispose all old resources before reinitializing
        for (const d of debuggerDisposables) {
            try { d.dispose(); } catch {}
        }
        debuggerDisposables = [];
    
        const workspaceUri = vscode.workspace.workspaceFolders?.[0]?.uri; // you said you already have it
        if (!workspaceUri) return;
    
        const rootPath = workspaceUri.fsPath;
        const hasLitesvmOrMollusk = await workspaceHasLitesvmOrMollusk(rootPath);
    
        if (!hasLitesvmOrMollusk) {
            // Don't activate the extension if litesvm/mollusk is not found
            return;
        }
    
        gimletConfigManager.ensureGimletConfig();
        gimletConfigManager.watchGimletConfig(context);
    
        // Set necessary VS Code settings for optimal debugging experience
        rustAnalyzerSettingsManager.set('debug.engine', 'vadimcn.vscode-lldb');
        editorSettingsManager.set('codeLens', true);
    
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
    
        // Listener to handle when debug ends and extension can clean up
        const debugListener = vscode.debug.onDidTerminateDebugSession(session => {
            if (session.id === debuggerSession.debugSessionId) {
                portManager.cleanup(); // Clean up any active port polling when session ends
                cleanupDebuggerSession();
            }
        });
            
        const sbpfDebugDisposable = vscode.commands.registerCommand('gimlet.debugAtLine', async (document, line) => {
            // Prevent starting a new session if one is already running
            if (isSessionRunning()) {
                vscode.window.showInformationMessage('A Gimlet debug session is already running. Please stop the current session before starting a new one.');
                return;
            }
    
            if (!(await hasSupportedBackend())) {
                // Don't activate the extension if litesvm/mollusk is not found
                vscode.window.showInformationMessage('Litesvm or Mollusk not found in Cargo.toml. Add litesvm or mollusk to use Gimlet debugging.');
                return;
            }
    
            // Always create a new session state for a new debug session
            const sessionStateInstance = createSessionState();
            setDebuggerSession(sessionStateInstance);
            debuggerSession = sessionStateInstance;
            
            debuggerSession.tcpPort = globalState.tcpPort;
            const language = document.languageId;
    
            try {
                await SbpfCompile();
                await new Promise(resolve => setTimeout(resolve, 500));
    
    
                const originalEnvPortValue = process.env.SBPF_DEBUG_PORT;
                const originalEnvOutputValue = process.env.VM_DEBUG_EXEC_INFO_FILE;
    
                process.env.SBPF_DEBUG_PORT = debuggerSession.tcpPort.toString();
                process.env.VM_DEBUG_EXEC_INFO_FILE = VM_DEBUG_EXEC_INFO_FILE;
    
                // remove the lldb.library setting to allow rust-analyzer/typescript test debugger to work properly
                await lldbSettingsManager.disable('library');
    
                try {
                    if (language == 'rust') {
                        const debugListener = vscode.debug.onDidStartDebugSession(session => {
                            // Literally this is the place where the debugging starts
                            // Only the first occurrence of lldb session is relevant(the test session)
                            if (session.type === 'lldb') {
                                debuggerSession.debugSessionId = session.id;
                                debugListener.dispose();
                            }
                        });

                        const result = await startRustAnalyzerDebugSession(line);
                        
                        if (!result) {
                            vscode.window.showInformationMessage('Please ensure you have selected a runnable in the rust-analyzer prompt.');
                            return;
                        }
    
                        await lldbSettingsManager.set('library', globalState.lldbLibrary);
                        await startPortDebugListeners();
                    } else if (language == 'typescript') {
                        // typescript debug command to run the tests 
                        debugConfigManager.spawnAnchorTestProcess();
    
                        await lldbSettingsManager.set('library', globalState.lldbLibrary);
                        await startPortDebugListeners();
                    }
                } finally {
                    // Cleanup strategy for the ENV after command execution
                    if (originalEnvPortValue === undefined) {
                        delete process.env.SBPF_DEBUG_PORT;
                    } else {
                        process.env.SBPF_DEBUG_PORT = originalEnvPortValue;
                    }
    
                    if (originalEnvOutputValue === undefined) {
                        delete process.env.VM_DEBUG_EXEC_INFO_FILE;
                    } else {
                        process.env.VM_DEBUG_EXEC_INFO_FILE = originalEnvOutputValue;
                    }
                }
            } catch (err) {
                console.log(err);
                vscode.window.showErrorMessage(`Failed to debug with Gimlet: ${err.message}`);
            }
        });
            
        // Add all disposables to context subscriptions
        debuggerDisposables.push(
            setupDisposable,
            codeLensDisposable,
            sbpfDebugDisposable,
            debugListener
        )

    } catch (err) {
        console.error('Error during activateDebugger:', err);
    } finally {
        isActivationInProgress = false;
    }
}

// UTILS FOR DEBUG
async function startPortDebugListeners() {
    const initialTcpPort = debuggerSession.tcpPort;
    const CPI_PORT_COUNT = 4; // Solana currently supports up to 4 for CPI

    const ports = [];
    for (let i = 0; i < CPI_PORT_COUNT; i++) {
        ports.push(initialTcpPort + i);
    }

    debuggerSession.tcpPort += CPI_PORT_COUNT;
    portManager.listenAndStartDebugForPorts(ports);
}

function cleanupDebuggerSession() {
    debuggerSession = null;
    clearDebuggerSession();
}

async function startRustAnalyzerDebugSession(line) {
    // rust-analyzer command to debug reusing the client and runnables it creates initially
        const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    editor.selection = new vscode.Selection(
        new vscode.Position(line, 0), 
        new vscode.Position(line, 0)
    );
    return await vscode.commands.executeCommand("rust-analyzer.debug");
}


module.exports = {
    activate,
    deactivate,
};

