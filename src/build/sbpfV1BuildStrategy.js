const BaseBuildStrategy = require('./baseBuildStrategy');
const { getDebuggerSession }  = require('../managers/sessionManager');
const vscode = require('vscode');
const fs = require('fs');
const { spawn } = require('child_process');
const BuildCommands = require('./buildCommands');
const gimletConfigManager  = require('../config');
const { safeReadDir } = require('../projectStructure');

class SbpfV1BuildStrategy extends BaseBuildStrategy {
    constructor(
        workspaceFolder,
        buildCommand = BuildCommands.SBF_V1_DEBUG()
    ) {
        super(workspaceFolder);
        this.buildCommand = buildCommand;
        this.debuggerSession = getDebuggerSession();
    }

    static get BUILD_TYPE() {
        return 'V1';
    }

    get buildType() {
        return this.constructor.BUILD_TYPE;
    }

    getBuildCommand() {
        // if Anchor.toml exists, we build, then we delete the .so files to ensure we use the SBF V1 build
        return `[ -f Anchor.toml ] && anchor build; rm target/deploy/*.so || true ; ${this.buildCommand}`;
    }

    async build(progress) {
        const buildCmd = this.getBuildCommand();
        progress.report({ increment: 1, message: 'Building your program!' });

        return new Promise((resolve) => {
            const outputChannel = vscode.window.createOutputChannel('Gimlet');
            outputChannel.show(true);
            outputChannel.appendLine(`Running build command: ${buildCmd}\n`);

            const buildProcess = spawn(
                buildCmd,
                {
                    cwd: this.workspaceFolder,
                    shell: true
                }
            )

            buildProcess.stdout.on('data', (data) => {
                outputChannel.append(data.toString());
            });

            buildProcess.stderr.on('data', (data) => {
                outputChannel.append(data.toString());
            });

            buildProcess.on('close', async (code) => {
                if (code !== 0) {
                    throw new Error(`Build failed with exit code ${code}`);
                }

                // Load the depsPath from gimlet config
                const { depsPath } = await gimletConfigManager.resolveGimletConfig();
                this.depsPath = depsPath;

                // Holds all the compiled programs in target/deploy
                let newFiles = await safeReadDir(this.depsPath);
                if (!newFiles) {
                    resolve();
                    return;
                }

                // Hash all the compiled programs
                for (let programCompiledFile of newFiles) {
                    if (!programCompiledFile.endsWith('.so')) {
                        continue;
                    }

                    const debugBinaryPath = `${this.depsPath}/${programCompiledFile.replace('.so', '.debug')}`;
                    const bpfCompiledPath = `${this.depsPath}/${programCompiledFile}`;
                    
                    this.hashProgram(programCompiledFile);

                    this.debuggerSession.executablesPaths[programCompiledFile] = {
                        debugBinary: debugBinaryPath,
                        bpfCompiledPath: bpfCompiledPath
                    };
                }

                if (progress)
                    progress.report({
                        increment: 3,
                        message: 'Setting up debugger...',
                    });
                resolve(true);
            });
        });
    }

    // Helper to delete the target/deploy files if they exist, so i will ensure that we are going to use the SBF V1 compiled SBF files
    _deleteIfExists(filePath) {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

module.exports = {
    SbpfV1BuildStrategy,
};
