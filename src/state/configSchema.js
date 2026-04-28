const { MIN_PLATFORM_TOOLS_VERSION} = require('./constants');

// Validation schema for gimlet.json. Every key is optional; only type-checked when present.
// Keep this in sync with setConfig() assignments below and the README options table.
const SCHEMA = {
    tcpPort:              { type: 'number'  },
    stopOnEntry:          { type: 'boolean' },
    platformToolsVersion: { type: 'string'  },
    sbfTracePath:         { type: 'string'  },
    platformToolsPath:    { type: 'string'  },
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

// Compares Solana platform-tools versions ("1.54", "2.0") — major.minor only.
// Returns negative if a<b, zero if equal, positive if a>b.
function compareVersions(a, b) {
    const [aMajor, aMinor] = a.split('.').map(Number);
    const [bMajor, bMinor] = b.split('.').map(Number);
    return aMajor - bMajor || aMinor - bMinor;
}

module.exports = {
    SCHEMA,
    CHECKS,
};