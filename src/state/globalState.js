const os = require('os');
const path = require('path');
const fs = require('fs');

// Shared state container for the debugger session
const DEFAULT_TCP_PORT = 1212;
const DEFAULT_PLATFORM_TOOLS_VERSION = '1.54';
const LIB_EXT = process.platform === 'darwin' ? 'dylib' : 'so';

// General (global) state, singleton
class GimletGeneralState {
    constructor() {
        this.globalWorkspaceFolder = null;
        this.platformToolsVersion = DEFAULT_PLATFORM_TOOLS_VERSION;
        this.lldbLibrary = this.getLldbLibraryPath();
        this.tcpPort = DEFAULT_TCP_PORT;
        this.stopOnEntry = true;
    }

    // TODO: Implement a mechanism to allow user to pass custom path trough gimlet.json config file.
    getLldbLibraryPath() {
        const libPath = path.join(
            os.homedir(),
            '.cache',
            'solana',
            `v${this.platformToolsVersion}`,
            'platform-tools',
            'llvm',
            'lib',
            `liblldb.${LIB_EXT}`
        );

        try {
            return fs.realpathSync(libPath);
        } catch (err) {
            throw new Error(
                [
                    'Gimlet could not resolve the LLDB library path:',
                    `  ${libPath}`,
                    'Possible cause:',
                    '  - Your Solana toolchain or platform-tools version is incorrect or missing.',
                    `Expected platform-tools version: v${this.platformToolsVersion}`,
                    `Original error: ${err}`,
                    'How to fix:',
                    '  Run the following command in your terminal to install the correct platform tools:',
                    `    cargo build-sbf --tools-version v${this.platformToolsVersion} --debug --arch v1 --force-tools-install`,
                ].join('\n')
            );
        }
    }

    setPlatformToolsVersion(version) {
        if (version && version !== this.platformToolsVersion) {
            this.platformToolsVersion = version;
            this.lldbLibrary = this.getLldbLibraryPath();
        }
    }

    setConfig(config) {
        if (config.tcpPort !== undefined) {
            this.tcpPort = config.tcpPort;
        }
        if (config.stopOnEntry !== undefined) {
            this.stopOnEntry = config.stopOnEntry;
        }
        if (
            config.platformToolsVersion !== undefined &&
            config.platformToolsVersion !== this.platformToolsVersion
        ) {
            this.platformToolsVersion = config.platformToolsVersion;
            this.lldbLibrary = this.getLldbLibraryPath();
        }
    }
}

module.exports = {
    globalState: new GimletGeneralState(), // Singleton
}
