#!/bin/bash

# Script to check Gimlet setup dependencies on Linux (read-only)
# Checks: Solana CLI, Rust, Python, libpython, VS Code, Gimlet extension, file descriptor limits

# Function to log messages to stdout
log() {
    echo "$1"
} # End log function

# Function to check command availability and version
check_command() {
    if command -v "$1" &> /dev/null; then
        VERSION=$($1 --version 2>&1 | head -n 1)
        log "✅ $1 is installed: $VERSION"
        return 0
    else
        log "❌ $1 is not installed"
        return 1
    fi
} # End check_command function

# Function to check library presence
check_library() {
    if ldconfig -p | grep -q "$1"; then
        log "✅ Library $1 is present"
        return 0
    else
        log "❌ Library $1 is not present"
        return 1
    fi
} # End check_library function

# Check for Windows-style line endings
if file "$0" | grep -q "CRLF"; then
    log "⚠️ Script contains Windows-style (CRLF) line endings, which may cause errors."
    log "Run 'dos2unix $0' or 'sed -i ''s/\r$//' $0' to convert to Unix line endings."
    exit 1
fi

# Detect Linux distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO="$ID"
    log "Detected distribution: $DISTRO"
else
    log "❌ Could not detect distribution"
    DISTRO="unknown"
fi

# 1. Check Solana CLI (expected: >=2.0.0)
log "Checking Solana CLI..."
if check_command solana; then
    SOLANA_VERSION=$(solana --version | grep -oP '\d+\.\d+\.\d+')
    if echo "$SOLANA_VERSION" | awk -F. '{if ($1*10000+$2*100+$3 >= 20000) exit 0; else exit 1}'; then
        log "✅ Solana CLI version is $SOLANA_VERSION, meets requirement (>=2.0.0)"
    else
        log "⚠️ Solana CLI version is $SOLANA_VERSION, expected >=2.0.0"
    fi
fi

# 2. Check Rust (expected: >=1.86.0)
log "Checking Rust..."
if check_command rustc; then
    RUST_VERSION=$(rustc --version | grep -oP '\d+\.\d+\.\d+')
    if echo "$RUST_VERSION" | awk -F. '{if ($1*10000+$2*100+$3 >= 18600) exit 0; else exit 1}'; then
        log "✅ Rust version is $RUST_VERSION, meets requirement (>=1.86.0)"
    else
        log "⚠️ Rust version is $RUST_VERSION, expected >=1.86.0"
    fi
fi

# 3. Check Python and libpython (expected: 3.10.1)
log "Checking Python..."
if check_command python3; then
    PYTHON_VERSION=$(python3 --version | grep -oP '\d+\.\d+\.\d+')
    if [ "$PYTHON_VERSION" = "3.10.1" ]; then
        log "✅ Python version is $PYTHON_VERSION, matches expected 3.10.1"
    else
        log "⚠️ Python version is $PYTHON_VERSION, expected 3.10.1"
    fi
fi
check_library libpython3.10

# 4. Check VS Code (expected: 1.99.2)
log "Checking VS Code..."
if check_command code; then
    VSCODE_VERSION=$(code --version | head -n 1)
        log "✅ VS Code version is $VSCODE_VERSION
fi

# 5. Check Gimlet VS Code extension
log "Checking Gimlet VS Code extension..."
if command -v code &> /dev/null && code --list-extensions | grep -q "gimlet"; then
    log "✅ Gimlet extension is installed"
else
    log "❌ Gimlet extension is not installed"
fi

# 6. Check file descriptor limits
log "Checking file descriptor limits..."
CURRENT_LIMIT=$(ulimit -n)
RECOMMENDED_LIMIT=1000000
if [ "$CURRENT_LIMIT" -lt "$RECOMMENDED_LIMIT" ]; then
    log "⚠️ File descriptor limit is $CURRENT_LIMIT, recommended $RECOMMENDED_LIMIT"
else
    log "✅ File descriptor limit is sufficient: $CURRENT_LIMIT"
fi

# 7. Check Solana CLI PATH
log "Checking Solana CLI PATH..."
SOLANA_PATH="$HOME/.local/share/solana/install/active_release/bin"
if [[ ":$PATH:" != *":$SOLANA_PATH:"* ]]; then
    log "⚠️ Solana CLI PATH not set correctly"
else
    log "✅ Solana CLI PATH is set correctly"
fi

# Summary
log "Setup check complete. Review output for details."
log "Dependencies checked:"
log "- Solana CLI: Expected >=2.0.0"
log "- Rust: Expected >=1.86.0"
log "- Python: Expected 3.10.1 with libpython3.10"
log "- VS Code: Expected 1.99.2 with Gimlet extension"
log "- File descriptor limit: Recommended 1000000"
log "- Solana CLI PATH: $SOLANA_PATH"
log "To fix issues, refer to the Gimlet README or run a setup script with installation steps."
