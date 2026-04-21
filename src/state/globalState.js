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
        this._lldbLibrary = null;
        this.lldbLibraryPathOverride = null;
        this.platformToolsDirOverride = null;
        this.tcpPort = DEFAULT_TCP_PORT;
        this.stopOnEntry = true;
        this.sbfTraceDir = null;
    }

    get lldbLibrary() {
        if (this._lldbLibrary === null) {
            this._lldbLibrary = this.getLldbLibraryPath();
        }
        return this._lldbLibrary;
    }

    invalidateLldbLibrary() {
        this._lldbLibrary = null;
    }

    // Platform-tools root: override from gimlet.json, else ~/.cache/solana/v{version}/platform-tools
    getPlatformToolsDir() {
        if (this.platformToolsDirOverride) {
            return this.platformToolsDirOverride;
        }
        return path.join(
            os.homedir(),
            '.cache',
            'solana',
            `v${this.platformToolsVersion}`,
            'platform-tools'
        );
    }

    getPlatformToolsLibDir() {
        return path.join(this.getPlatformToolsDir(), 'llvm', 'lib');
    }

    getPlatformToolsBinDir() {
        return path.join(this.getPlatformToolsDir(), 'llvm', 'bin');
    }

    getLldbLibraryPath() {
        // 1. Honour explicit user override from gimlet.json
        if (this.lldbLibraryPathOverride) {
            try {
                return fs.realpathSync(this.lldbLibraryPathOverride);
            } catch (err) {
                throw new Error(
                    [
                        'Gimlet: lldbLibraryPath in gimlet.json points to a missing file:',
                        `  ${this.lldbLibraryPathOverride}`,
                        `Original error: ${err}`,
                    ].join('\n')
                );
            }
        }

        // 2. Derived default: {platformToolsDir}/llvm/lib/liblldb.{ext}
        const libPath = path.join(
            this.getPlatformToolsLibDir(),
            `liblldb.${LIB_EXT}`
        );

        try {
            return fs.realpathSync(libPath);
        } catch (err) {
            // 3. Diagnostic
            throw new Error(
                [
                    'Gimlet could not resolve the LLDB library path:',
                    `  ${libPath}`,
                    'Possible cause:',
                    '  - Your Solana toolchain or platform-tools version is incorrect or missing.',
                    `Expected platform-tools version: v${this.platformToolsVersion}`,
                    `Original error: ${err}`,
                    'How to fix:',
                    '  Install the matching Solana platform-tools:',
                    `    cargo build-sbf --tools-version v${this.platformToolsVersion} --debug --arch v1 --force-tools-install`,
                    '  Or point Gimlet at an existing install by setting one of:',
                    '    "platformToolsDir" in .vscode/gimlet.json — root of your platform-tools (covers LLDB, Python and scripts paths)',
                    `    "lldbLibraryPath" in .vscode/gimlet.json — exact path to your liblldb.${LIB_EXT} (LLDB only; use when the lib has a non-standard filename)`,
                ].join('\n')
            );
        }
    }

    setPlatformToolsVersion(version) {
        if (version && version !== this.platformToolsVersion) {
            this.platformToolsVersion = version;
            this.invalidateLldbLibrary();
        }
    }

    // TODO(lime): no validation of config values from user-controlled gimlet.json
    setConfig(config) {
        if (config.tcpPort !== undefined) {
            this.tcpPort = config.tcpPort;
        }
        if (config.stopOnEntry !== undefined) {
            this.stopOnEntry = config.stopOnEntry;
        }
        this.sbfTraceDir = config.sbfTraceDir || null;

        const nextDirOverride = config.platformToolsDir || null;
        if (nextDirOverride !== this.platformToolsDirOverride) {
            this.platformToolsDirOverride = nextDirOverride;
            this.invalidateLldbLibrary();
        }

        const nextLibOverride = config.lldbLibraryPath || null;
        if (nextLibOverride !== this.lldbLibraryPathOverride) {
            this.lldbLibraryPathOverride = nextLibOverride;
            this.invalidateLldbLibrary();
        }

        if (
            config.platformToolsVersion !== undefined &&
            config.platformToolsVersion !== this.platformToolsVersion
        ) {
            this.platformToolsVersion = config.platformToolsVersion;
            this.invalidateLldbLibrary();
        }
    }
}

module.exports = {
    globalState: new GimletGeneralState(), // Singleton
};
