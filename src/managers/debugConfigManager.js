const fs = require('fs');
const { getDebuggerSession } = require('../managers/sessionManager');
const { globalState } = require('../state/globalState');
const os = require('os');
const path = require('path');
const { log } = require('../logger');

function metadataFilePath(id) {
    return path.join(os.tmpdir(), `gimlet-metadata-${id}.txt`);
}

class DebugConfigManager {
    getSolanaScriptsDir() {
        return globalState.getPlatformToolsBinDir();
    }

    getLldbPythonPath() {
        const libDir = globalState.getPlatformToolsLibDir();

        if (!fs.existsSync(libDir)) {
            throw new Error(
                `Solana platform-tools not found at ${libDir}. ` +
                    `Run 'cargo-build-sbf --tools-version v${globalState.platformToolsVersion}' to install them, ` +
                    `or set "platformToolsPath" in .vscode/gimlet.json to point at an existing platform-tools directory.`
            );
        }

        const pythonDir = fs
            .readdirSync(libDir)
            .find((entry) => entry.startsWith('python'));
        if (!pythonDir) {
            throw new Error(
                `Platform-tools install at ${libDir} is missing its python* directory — LLDB scripts cannot load. ` +
                    `Reinstall with 'cargo-build-sbf --tools-version v${globalState.platformToolsVersion} --force-tools-install', ` +
                    `or point "platformToolsPath" in .vscode/gimlet.json at a complete install.`
            );
        }

        const pythonLibDir = path.join(libDir, pythonDir);
        const packagesDir = fs
            .readdirSync(pythonLibDir)
            .find((entry) => entry.endsWith('-packages'));
        if (!packagesDir) {
            throw new Error(
                `Platform-tools install at ${pythonLibDir} is missing its *-packages directory — LLDB scripts cannot load. ` +
                    `Reinstall with 'cargo-build-sbf --tools-version v${globalState.platformToolsVersion} --force-tools-install', ` +
                    `or point "platformToolsPath" in .vscode/gimlet.json at a complete install.`
            );
        }

        return path.join(pythonLibDir, packagesDir);
    }

    getLaunchConfig(currentTcpPort, metadataId) {
        const metadataFile = metadataFilePath(metadataId);
        const scriptsDir = this.getSolanaScriptsDir();
        const initCommands = [
            `command script import "${path.join(scriptsDir, 'lldb_lookup.py')}"`,
            `command script import "${path.join(scriptsDir, 'solana_lookup.py')}"`,
            `command script import "${path.join(scriptsDir, 'solana_input_deserialize_abiv1.py')}"`,
            `command script import "${path.join(scriptsDir, 'solana_save_output.py')}"`,
        ];

        return {
            type: 'lldb',
            request: 'launch',
            name: `Sbpf Debug ${metadataId.slice(0, 8)}`,
            initCommands,
            targetCreateCommands: [],
            processCreateCommands: [`gdb-remote 127.0.0.1:${currentTcpPort}`],
            postRunCommands: [
                `solana_save_output "${metadataFile}" process plugin packet monitor metadata`,
            ],
        };
    }

    async readMetadata(metadataId, timeoutMs = 10000, intervalMs = 100) {
        const filePath = metadataFilePath(metadataId);
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
            if (fs.existsSync(filePath)) {
                const raw = fs.readFileSync(filePath, 'utf8').trim();
                const content = raw.split('\n')[0].trim();
                if (content) {
                    fs.unlinkSync(filePath);

                    const metadata = {};
                    for (const part of content.split(';')) {
                        const [key, value] = part.split('=');
                        if (key && value) {
                            metadata[key.trim()] = value.trim();
                        }
                    }
                    return metadata;
                }
            }
            await new Promise((resolve) => setTimeout(resolve, intervalMs));
        }
        return null;
    }

    async runCommand(vsDebugSession, expression) {
        await vsDebugSession.customRequest('evaluate', {
            expression,
            context: 'repl',
        });
    }

    async loadProgramModules(vsDebugSession, metadataId) {
        const session = getDebuggerSession();
        if (!session) {
            throw new Error(
                'Gimlet debug session was cleared before program modules could load. ' +
                    'This usually means the session was stopped concurrently — try debugging again.'
            );
        }

        const metadata = await this.readMetadata(metadataId);
        if (!metadata || !metadata.program_id) {
            throw new Error('Failed to read program metadata from debugger.');
        }

        const programId = metadata.program_id;
        const hash = session.programIdToHash[programId];
        if (!hash) {
            throw new Error(
                `Unknown program ID: ${programId}. Not found in program_ids.map.`
            );
        }

        const programName = session.programHashToProgramName[hash];
        if (!programName) {
            throw new Error(`No program found for hash: ${hash}`);
        }

        const execInfo = session.executablesPaths[programName];
        if (!execInfo || !execInfo.debugBinary) {
            throw new Error(`Debug binary not found for ${programName}`);
        }

        const debugPath = execInfo.debugBinary;
        const relativePath = path.relative(
            globalState.globalWorkspaceFolder,
            debugPath
        );
        log(
            `Sbpf Debug ${metadataId.slice(0, 8)} → program=${programId} cpi=${metadata.cpi_level} caller=${metadata.caller} → ${relativePath}`
        );

        await this.runCommand(
            vsDebugSession,
            `target modules add "${debugPath}"`
        );
        await this.runCommand(
            vsDebugSession,
            `target modules load -f "${debugPath}" -s 0x0`
        );

        if (!globalState.stopOnEntry) {
            await this.runCommand(vsDebugSession, 'continue');
        }
    }
}

const debugConfigManager = new DebugConfigManager();

module.exports = { debugConfigManager };
