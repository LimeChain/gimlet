const os = require('os');
const path = require('path');
const fs = require('fs');

// Shared state container for the debugger session
const DEFAULT_TCP_PORT = 1212;
const DEFAULT_STOP_ON_ENTRY = true;
const DEFAULT_PLATFORM_TOOLS_VERSION = '1.54';
const LIB_EXT = process.platform === 'darwin' ? 'dylib' : 'so';

// Validation schema for gimlet.json. Every key is optional; only type-checked when present.
// Keep this in sync with setConfig() assignments below and the README options table.
const SCHEMA = {
    tcpPort:              { type: 'number',  range: [1, 65535] },
    stopOnEntry:          { type: 'boolean' },
    platformToolsVersion: { type: 'string',  pattern: /^\d+\.\d+(\.\d+)?$/ },
    sbfTraceDir:          { type: 'string' },
    platformToolsDir:     { type: 'string' },
    lldbLibraryPath:      { type: 'string' },
    artifactPath:         { type: 'string' },
};

function validateConfig(rawConfig) {
    const errors = [];
    const unknownKeys = [];
    const cleanConfig = {};

    for (const key of Object.keys(rawConfig)) {
        if (!Object.prototype.hasOwnProperty.call(SCHEMA, key)) {
            unknownKeys.push(key);
        }
    }

    for (const [key, rule] of Object.entries(SCHEMA)) {
        const v = rawConfig[key];
        if (v === undefined) continue;

        const keyErrors = [];
        if (typeof v !== rule.type) {
            keyErrors.push(`${key}: expected ${rule.type}, got ${typeof v}`);
        } else {
            if (rule.range && (v < rule.range[0] || v > rule.range[1])) {
                keyErrors.push(`${key}: must be in [${rule.range[0]}, ${rule.range[1]}]`);
            }
            if (rule.pattern && !rule.pattern.test(v)) {
                keyErrors.push(`${key}: does not match expected format (e.g. "1.54", "1.54.1")`);
            }
        }

        if (keyErrors.length === 0) {
            cleanConfig[key] = v;
        } else {
            errors.push(...keyErrors);
        }
    }

    return { cleanConfig, errors, unknownKeys };
}

// General (global) state, singleton
class GimletGeneralState {
    constructor() {
        this.globalWorkspaceFolder = null;
        this.platformToolsVersion = DEFAULT_PLATFORM_TOOLS_VERSION;
        this._lldbLibrary = null;
        this.lldbLibraryPathOverride = null;
        this.platformToolsDirOverride = null;
        this.tcpPort = DEFAULT_TCP_PORT;
        this.stopOnEntry = DEFAULT_STOP_ON_ENTRY;
        this.sbfTraceDir = null;
        this.artifactPathOverride = null;
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

    // Validates gimlet.json input against SCHEMA, applies only valid keys, and returns
    // { errors, unknownKeys } so the caller (config.js) can surface one aggregated toast
    // and log ignored keys to the Gimlet Output channel.
    setConfig(rawConfig) {
        const { cleanConfig, errors, unknownKeys } = validateConfig(rawConfig);

        // Missing keys reset to defaults — setConfig({}) means "no overrides".
        // Without this, deleting gimlet.json would leave previously-set scalars
        // stuck at their last value despite the "using defaults" toast.
        this.tcpPort = cleanConfig.tcpPort !== undefined
            ? cleanConfig.tcpPort
            : DEFAULT_TCP_PORT;
        this.stopOnEntry = cleanConfig.stopOnEntry !== undefined
            ? cleanConfig.stopOnEntry
            : DEFAULT_STOP_ON_ENTRY;
        this.sbfTraceDir = cleanConfig.sbfTraceDir || null;
        this.artifactPathOverride = cleanConfig.artifactPath || null;

        const nextDirOverride = cleanConfig.platformToolsDir || null;
        if (nextDirOverride !== this.platformToolsDirOverride) {
            this.platformToolsDirOverride = nextDirOverride;
            this.invalidateLldbLibrary();
        }

        const nextLibOverride = cleanConfig.lldbLibraryPath || null;
        if (nextLibOverride !== this.lldbLibraryPathOverride) {
            this.lldbLibraryPathOverride = nextLibOverride;
            this.invalidateLldbLibrary();
        }

        const nextPlatformToolsVersion = cleanConfig.platformToolsVersion !== undefined
            ? cleanConfig.platformToolsVersion
            : DEFAULT_PLATFORM_TOOLS_VERSION;
        if (nextPlatformToolsVersion !== this.platformToolsVersion) {
            this.platformToolsVersion = nextPlatformToolsVersion;
            this.invalidateLldbLibrary();
        }

        return { errors, unknownKeys };
    }
}

module.exports = {
    globalState: new GimletGeneralState(), // Singleton
};
