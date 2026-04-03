#!/bin/bash

# Gimlet Setup Script
# Checks dependencies for the Gimlet Solana debugger VS Code extension

# Note: On Windows, please run this script inside WSL (Windows Subsystem for Linux)
#       or Git Bash to ensure proper functionality.

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PLATFORM_TOOLS_VERSION="1.54"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

show_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║              GIMLET DEPENDENCY CHECK                 ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

detect_os() {
    log_info "Detecting operating system..."

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        LIB_EXT="so"
        if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
            log_info "Running inside WSL"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        LIB_EXT="dylib"
        log_info "Detected: macOS $(sw_vers -productVersion)"
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi
}

check_rust() {
    log_info "Checking Rust installation..."

    if command_exists rustc; then
        log_success "Rust: $(rustc --version)"
    else
        log_error "Rust not found. Install from: https://rustup.rs/"
        return 1
    fi

    if command_exists cargo; then
        log_success "Cargo: $(cargo --version)"
    else
        log_error "Cargo not found. Install Rust toolchain from: https://rustup.rs/"
        return 1
    fi
}

check_solana() {
    log_info "Checking Solana CLI..."

    if command_exists solana; then
        log_success "Solana CLI: $(solana --version)"
    else
        log_error "Solana CLI not found. Install from: https://solana.com/docs/intro/installation"
        return 1
    fi
}

check_cargo_build_sbf() {
    log_info "Checking cargo-build-sbf..."

    if command_exists cargo-build-sbf; then
        log_success "cargo-build-sbf found"
    else
        log_error "cargo-build-sbf not found. Install Solana platform tools."
        log_info "Run: cargo build-sbf --tools-version v${PLATFORM_TOOLS_VERSION} --debug --arch v1 --force-tools-install"
        return 1
    fi
}

check_platform_tools() {
    log_info "Checking platform-tools v${PLATFORM_TOOLS_VERSION}..."

    local PLATFORM_TOOLS_DIR="$HOME/.cache/solana/v${PLATFORM_TOOLS_VERSION}/platform-tools"
    local LLVM_BIN="$PLATFORM_TOOLS_DIR/llvm/bin"
    local LLDB_LIB="$PLATFORM_TOOLS_DIR/llvm/lib/liblldb.${LIB_EXT}"

    if [ ! -d "$PLATFORM_TOOLS_DIR" ]; then
        log_error "Platform-tools v${PLATFORM_TOOLS_VERSION} not found at: $PLATFORM_TOOLS_DIR"
        log_info "Install with: cargo build-sbf --tools-version v${PLATFORM_TOOLS_VERSION} --debug --arch v1 --force-tools-install"
        return 1
    fi

    log_success "Platform-tools directory found"

    # Check LLDB library
    if [ -f "$LLDB_LIB" ] || [ -L "$LLDB_LIB" ]; then
        log_success "LLDB library: $LLDB_LIB"
    else
        log_error "LLDB library not found: $LLDB_LIB"
        return 1
    fi

    # Check required Python scripts
    local SCRIPTS=("lldb_lookup.py" "solana_lookup.py" "solana_input_deserialize_abiv1.py" "solana_save_output.py")
    local missing=0

    for script in "${SCRIPTS[@]}"; do
        if [ -f "$LLVM_BIN/$script" ]; then
            log_success "Script: $script"
        else
            log_error "Missing script: $LLVM_BIN/$script"
            ((missing++))
        fi
    done

    if [ $missing -gt 0 ]; then
        return 1
    fi
}

check_vscode_extensions() {
    log_info "Checking VS Code extensions..."

    if command_exists code; then
        local extensions=$(code --list-extensions 2>/dev/null)

        if echo "$extensions" | grep -qi "vadimcn.vscode-lldb"; then
            log_success "CodeLLDB extension installed"
        else
            log_error "CodeLLDB extension not found. Install from: https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb"
        fi

        if echo "$extensions" | grep -qi "rust-lang.rust-analyzer"; then
            log_success "rust-analyzer extension installed"
        else
            log_warning "rust-analyzer extension not found (recommended)"
        fi
    else
        log_warning "VS Code CLI (code) not available, skipping extension checks"
    fi
}

show_summary() {
    echo ""
    echo -e "${BLUE}Build command:${NC}"
    echo -e "  cargo-build-sbf --tools-version v${PLATFORM_TOOLS_VERSION} --debug --arch v1"
    echo ""
    echo -e "${BLUE}Test command:${NC}"
    echo -e "  SBF_DEBUG_PORT=1212 SBF_TRACE_DIR=\$PWD/target/deploy/debug/trace cargo test --features sbpf-debugger"
    echo ""
}

main() {
    show_banner

    local errors=0

    detect_os
    check_rust || ((errors++))
    check_solana || ((errors++))
    check_cargo_build_sbf || ((errors++))
    check_platform_tools || ((errors++))
    check_vscode_extensions

    echo ""
    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}All dependencies satisfied.${NC}"
        show_summary
    else
        echo -e "${RED}Found $errors issue(s). Please fix the errors above.${NC}"
    fi
}

if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
