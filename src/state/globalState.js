const os = require('os');
const path = require('path');
const fs = require('fs');

// Shared state container for the debugger session
const DEFAULT_TCP_PORT = 1212;
const DEFAULT_STOP_ON_ENTRY = true;
const DEFAULT_PLATFORM_TOOLS_VERSION = '1.54';
const MIN_PLATFORM_TOOLS_VERSION = '1.54';
const LIB_EXT = process.platform === 'darwin' ? 'dylib' : 'so';

// Compares Solana platform-tools versions ("1.54", "2.0") — major.minor only.
// Returns negative if a<b, zero if equal, positive if a>b.
function compareVersions(a, b) {
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    return aMajor - bMajor || aMinor - bMinor;
}

// Validation schema for gimlet.json. Every key is optional; only type-checked when present.
// Keep this in sync with setConfig() assignments below and the README options table.
const SCHEMA = {
    tcpPort:              { type: 'number'  },
    stopOnEntry:          { type: 'boolean' },
    platformToolsVersion: { type: 'string'  },
    sbfTraceDir:          { type: 'string'  },
    platformToolsDir:     { type: 'string'  },
    lldbLibraryPath:      { type: 'string'  },
    artifactPath:         { type: 'string'  },
};

const CHECKS = {
    tcpPort: [
        { test: (v) => Number.isInteger(v),    error: () => 'must be an integer' },
        { test: (v) => v >= 1 && v <= 65535,   error: () => 'must be in [1, 65535]' },
    ],
    platformToolsVersion: [
        { test: (v) => /^\d+\.\d+$/.test(v),
          error: () => 'does not match expected format (e.g. "1.54")' },
        { test: (v) => compareVersions(v, MIN_PLATFORM_TOOLS_VERSION) >= 0,
          error: (v) => `${v} is not supported by Gimlet (minimum: ${MIN_PLATFORM_TOOLS_VERSION})` },
    ],
};

// Tri-state apply for a single key. Pairs with validateConfig's output:
//   valid value         → cleanConfig has it      → return it
//   key absent          → not in rawConfig        → return defaultValue
//   present but invalid → in rawConfig, not clean → return current (keep prior, don't fall back)
function resolveConfigValue(rawConfig, cleanConfig, key, current, defaultValue) {
    if (cleanConfig[key] !== undefined) return cleanConfig[key];
    if (!Object.prototype.hasOwnProperty.call(rawConfig, key)) return defaultValue;
    return current;
}

function validateConfig(rawConfig) {
    // Guard non-object roots: `null` would crash Object.keys, and primitives/arrays
    // would silently produce an empty cleanConfig. Route everything through the
    // normal validation-error path so callers see a clear schema error.
    if (rawConfig === null || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
        return {
            cleanConfig: {},
            errors: ['config root must be a JSON object'],
            unknownKeys: [],
        };
    }

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

        if (typeof v !== rule.type) {
            errors.push(`${key}: expected ${rule.type}, got ${typeof v}`);
            continue;
        }

        const failed = (CHECKS[key] || []).find((check) => !check.test(v));
        if (failed) {
            errors.push(`${key}: ${failed.error(v)}`);
            continue;
        }

        cleanConfig[key] = v;
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
        // Latest validation result. Populated by setConfig; checked by the debug
        // command to block launch when gimlet.json has any invalid value.
        this.lastConfigErrors = [];
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

        // Capture for the debug-launch gate in extension.js.
        this.lastConfigErrors = errors;

        // Non-object root: schema error already raised, leave state untouched.
        if (rawConfig === null || typeof rawConfig !== 'object' || Array.isArray(rawConfig)) {
            return { errors, unknownKeys };
        }

        const resolve = (key, current, defaultValue) =>
            resolveConfigValue(rawConfig, cleanConfig, key, current, defaultValue);

        this.tcpPort = resolve('tcpPort', this.tcpPort, DEFAULT_TCP_PORT);
        this.stopOnEntry = resolve('stopOnEntry', this.stopOnEntry, DEFAULT_STOP_ON_ENTRY);
        this.sbfTraceDir = resolve('sbfTraceDir', this.sbfTraceDir, null);
        this.artifactPathOverride = resolve('artifactPath', this.artifactPathOverride, null);

        const nextDirOverride = resolve('platformToolsDir', this.platformToolsDirOverride, null);
        if (nextDirOverride !== this.platformToolsDirOverride) {
            this.platformToolsDirOverride = nextDirOverride;
            this.invalidateLldbLibrary();
        }

        const nextLibOverride = resolve('lldbLibraryPath', this.lldbLibraryPathOverride, null);
        if (nextLibOverride !== this.lldbLibraryPathOverride) {
            this.lldbLibraryPathOverride = nextLibOverride;
            this.invalidateLldbLibrary();
        }

        const nextPlatformToolsVersion = resolve(
            'platformToolsVersion',
            this.platformToolsVersion,
            DEFAULT_PLATFORM_TOOLS_VERSION
        );
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
