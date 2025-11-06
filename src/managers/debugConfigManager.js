const fs = require('fs');
const { globalState } = require('../state/globalState');
const { getDebuggerSession } = require('../managers/sessionManager');
const vscode = require('vscode');
const { spawn } = require('child_process');
const { VM_DEBUG_EXEC_INFO_FILE } = require('../constants');

class DebugConfigManager {
    async getLaunchConfigForSolanaLldb(currentTcpPort, programKey) {
        const debuggerSession = getDebuggerSession();
        if (!debuggerSession) {
            vscode.window.showErrorMessage('No active debugger session found.');
            return null;
        }
        
        const executablesOfProgram = debuggerSession.executablesPaths[programKey];
        const debugExecutablePath = executablesOfProgram ? executablesOfProgram.debugBinary : null;

        if (!debugExecutablePath || !fs.existsSync(debugExecutablePath)) {
            vscode.window.showErrorMessage('Executable path is not set or does not exist. Please first execute `anchor build` then start debugging.');
            return null;
        }

        return {
            type: "lldb",
            request: "launch",
            name: `Sbpf Debug Port: ${currentTcpPort}`,
            targetCreateCommands: [
                `target create ${debugExecutablePath}`,
            ],
            processCreateCommands: [`gdb-remote 127.0.0.1:${currentTcpPort}`],
        };
    }

    // Wait until programName is available or timeout after 10 seconds
    async waitForProgramName(timeoutMs = 10000, intervalMs = 100) {
        const debuggerSession = getDebuggerSession();
        if (!debuggerSession) {
            vscode.window.showErrorMessage('No active debugger session found.');
            return null;
        }

        try {
            this.pollForTmpFile(debuggerSession, timeoutMs); 
            const start = Date.now();

            while (Date.now() - start < timeoutMs) {
                // TODO: Handle situations where we have a CPI to a program that is not in this project.
                // It will not be in our map and we need to handle that case.
                const programKey = debuggerSession.programHashToProgramName[debuggerSession.currentProgramHash];
                if (programKey) {
                    debuggerSession.tmpFilePollToken = null; // Stop polling
                    return programKey;
                };
                await new Promise(resolve => setTimeout(resolve, intervalMs));
            }
            return null;
        } catch (e) {
            vscode.window.showErrorMessage(e.message);
            return null;
        } finally {
            debuggerSession.currentProgramHash = null; // Reset after waiting
            debuggerSession.tmpFilePollToken = null; // Stop polling
        }
    }

    // The test executor for TS anchor tests
    async spawnAnchorTestProcess() {
        const outputChannel = vscode.window.createOutputChannel('Gimlet');
        outputChannel.show(true);
        outputChannel.appendLine(`Running build command: anchor test\n`);

        return new Promise((resolve, reject) => {
            // Get the active debug console
            const anchorProcess = spawn('anchor', ['test'], {
                env: {
                    ...process.env,
                    SBPF_DEBUG_PORT: globalState.tcpPort.toString(),
                    VM_DEBUG_EXEC_INFO_FILE: VM_DEBUG_EXEC_INFO_FILE,
                },
                cwd: globalState.globalWorkspaceFolder,
                stdio: ['inherit', 'pipe', 'pipe']
            });

            anchorProcess.stderr.on('data', (data) => {
                outputChannel.append(data.toString());
                
            });

            anchorProcess.stdout.on('data', (data) => {
                outputChannel.append(data.toString());
            });

            anchorProcess.on('error', (error) => {
                console.error(`Failed to start anchor: ${error}`);
                reject(error);
            });

            anchorProcess.on('close', (code) => {
                console.log(`anchor process exited with code ${code}`);
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`anchor process failed with code ${code}`));
                }
            });

            return anchorProcess;
        });
    }

    async pollForTmpFile(debuggerSession, timeoutMs = 10000) {
        const filePath = VM_DEBUG_EXEC_INFO_FILE;
        const intervalMs = 1000; // Poll every second
        
        const pollToken = Symbol('tmp-file-poll');
        debuggerSession.tmpFilePollToken = pollToken;
        
        const start = Date.now();
        
        while (debuggerSession.tmpFilePollToken === pollToken && (Date.now() - start < timeoutMs)) {
            try {
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    vscode.window.showInformationMessage(`Found VM output: ${content}`);
                    
                    // Set the hash so waitForProgramName can use it
                    debuggerSession.currentProgramHash = content.trim();
                    
                    // delete the file after reading, may lead to multithreading issues
                    // lets say i read current program hash and before i delete it i receive another program hash and delete the new output
                    // fs.unlinkSync(filePath);
                    
                    break; // Stop polling once file is found
                }
            } catch (err) {
                console.error(`Error reading ${VM_DEBUG_EXEC_INFO_FILE} file`, err);
            }
            
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
        
        debuggerSession.tmpFilePollToken = null;
    }
}

const debugConfigManager = new DebugConfigManager();

module.exports = { debugConfigManager};