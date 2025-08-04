#!/bin/bash

# Gimlet Setup Script
# Automated setup for Gimlet Solana debugger VS Code extension

# Note: On Windows, please run this script inside WSL (Windows Subsystem for Linux)
#       or Git Bash to ensure proper functionality.
#       Running in CMD or PowerShell is NOT supported.

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
GIMLET_DIR="$(pwd)"
VSCODE_SETTINGS_DIR="$HOME/.vscode"
SOLANA_CONFIG_DIR="$HOME/.config/solana"

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Display banner
show_banner() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════╗"
    echo "║                 GIMLET SETUP SCRIPT                  ║"
    echo "║          Automated Solana Debugger Setup             ║"
    echo "╚══════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Detect OS
# Note: may behave differently if not run in bash
detect_os() {
    log_info "Detecting operating system..."

    DISTRO=""
    VERSION=""

    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if grep -qEi "(Microsoft|WSL)" /proc/version &> /dev/null; then
            IS_WSL=true
            log_info "Running inside Windows Subsystem for Linux (WSL)"
        fi
        if command_exists lsb_release; then
            DISTRO=$(lsb_release -si)
            VERSION=$(lsb_release -sr)
            log_info "Detected: $DISTRO $VERSION"
        else
            log_info "Detected: Linux (unknown distribution)"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        VERSION=$(sw_vers -productVersion)
        log_info "Detected: macOS $VERSION"
    elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
        log_info "Detected: Windows"
    else
        log_error "Unsupported operating system: $OSTYPE"
        exit 1
    fi

    export OS
}

# Detect Solana installation and distribution
# Relies on `solana` command being available in PATH
detect_solana() {
    log_info "Detecting Solana installation..."
    
    if command_exists solana; then
        SOLANA_VERSION=$(solana --version) || {
          log_error "Failed to get Solana version or command timed out. Please make sure Solana CLI is installed correctly and included in PATH."
          exit 1
        }
        log_success "Solana CLI found: $SOLANA_VERSION"
        
        # Detect distribution (Agave vs Solana Labs)
        if echo "$SOLANA_VERSION" | grep -i "agave" >/dev/null; then
            SOLANA_DIST="agave"
            log_info "Distribution: Agave"
        else
            SOLANA_DIST="solana-labs"
            log_info "Distribution: Solana Labs"
        fi
        
        # Get Solana installation path
        SOLANA_INSTALL_PATH=$(dirname "$(which solana)")
        log_info "Solana install path: $SOLANA_INSTALL_PATH"
        
    else
        log_error "Solana CLI not found. Please install Solana first."
        log_info "Visit: https://docs.solana.com/cli/install-solana-cli-tools"
        exit 1
    fi
}

# Check Rust installation
check_rust() {
    log_info "Checking Rust installation..."
    
    if command_exists rustc; then
        RUST_VERSION=$(rustc --version)
        log_success "Rust found: $RUST_VERSION"
    else
        log_error "Rust not found. Please install Rust first."
        log_info "Visit: https://rustup.rs/"
        exit 1
    fi
    
    if command_exists cargo; then
        CARGO_VERSION=$(cargo --version)
        log_success "Cargo found: $CARGO_VERSION"
    else
        log_error "Cargo not found. Please install Rust toolchain."
        exit 1
    fi
}

# Check Anchor installation (optional)
# Relies on `anchor` command being available in PATH
check_anchor() {
    log_info "Checking Anchor installation..."
    
    if command_exists anchor; then
        ANCHOR_VERSION=$(anchor --version)
        log_success "Anchor found: $ANCHOR_VERSION"
        HAS_ANCHOR=true
    else
        log_warning "Anchor not found (optional for Anchor projects)"
        log_info "To install: 'cargo install --git https://github.com/coral-xyz/anchor avm --locked --force'"
        HAS_ANCHOR=false
    fi
}

# Check Python installation (expected: 3.10.1)
# Relies on `python3` or `python` command being available in PATH
check_python() {
    log_info "Checking Python..."

    local PY_CMD=""
    if command_exists python3; then
        PY_CMD="python3"
    elif command_exists python; then
        PY_CMD="python"
    fi

    if [ -n "$PY_CMD" ]; then
        PYTHON_VERSION=$($PY_CMD --version 2>&1 | sed 's/Python //' | grep -E '^[0-9]+\.[0-9]+\.[0-9]+')
        if [ "$PYTHON_VERSION" = "3.10.1" ]; then
            log_success "Python version is $PYTHON_VERSION, matches expected 3.10.1"
        else
            log_warning "Python version is $PYTHON_VERSION, expected 3.10.1"
        fi
    else
        log_warning "Python not found (optional for some Solana tools)"
        log_info "To install: https://www.python.org/downloads/"
    fi
}

# Find solana-lldb debugger
# This depends on `find` which is available on most Unix-like systems, and it is slow, maybe we should find a way to speed it up
# It is slow because it searches through the whole HOME directory and common paths, but if tools exists it will find it almost guaranteed
find_solana_lldb() {
    log_info "Locating solana-lldb debugger, this may take a moment..."
    
    # Common paths where solana-lldb might be located
    local possible_paths=(
        "$HOME/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/llvm/bin/solana-lldb"
        "$SOLANA_INSTALL_PATH/../share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/llvm/bin/solana-lldb"
        "/usr/local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/llvm/bin/solana-lldb"
        "$(find $HOME -name "solana-lldb" 2>/dev/null | head -1)"
    )
    
    for path in "${possible_paths[@]}"; do
        if [ -f "$path" ]; then
            SOLANA_LLDB_PATH="$path"
            log_success "solana-lldb found: $path"
            return 0
        fi
    done
    
    log_warning "solana-lldb not found in common locations"
    log_info "Attempting to install Solana platform tools..."
    
    # Try to install platform tools
    if solana install; then
        log_info "Solana platform tools installation initiated"
        sleep 5  # Give it time to install
        
        # Check again
        for path in "${possible_paths[@]}"; do
            if [ -f "$path" ]; then
                SOLANA_LLDB_PATH="$path"
                log_success "solana-lldb found after installation: $path"
                return 0
            fi
        done
    fi
    
    log_error "Could not locate or install solana-lldb"
    log_info "Please ensure Solana platform tools are installed: 'solana install'"
    exit 1
}

# Find agave-ledger-tool
find_agave_ledger_tool() {
    log_info "Locating agave-ledger-tool..."
    
    local possible_paths=(
        "$HOME/.local/share/solana/install/active_release/bin/agave-ledger-tool"
        "$SOLANA_INSTALL_PATH/agave-ledger-tool"
        "/usr/local/bin/agave-ledger-tool"
        "$(which agave-ledger-tool 2>/dev/null)"
    )
    
    for path in "${possible_paths[@]}"; do
        if [ -f "$path" ]; then
            AGAVE_LEDGER_TOOL_PATH="$path"
            log_success "agave-ledger-tool found: $path"
            return 0
        fi
    done
    
    log_error "Could not locate agave-ledger-tool"
    log_info "Please ensure Solana/Agave tools are properly installed"
    exit 1
}

# Validate setup
validate_setup() {
    log_info "Validating Gimlet setup..."
    
    local errors=0
    
    # Check critical files exist
    if [ ! -f "$SOLANA_LLDB_PATH" ]; then
        log_error "solana-lldb not found at: $SOLANA_LLDB_PATH"
        ((errors++))
    fi
    
    if [ ! -f "$AGAVE_LEDGER_TOOL_PATH" ]; then
        log_error "agave-ledger-tool not found at: $AGAVE_LEDGER_TOOL_PATH"
        ((errors++))
    fi

    if [ $errors -eq 0 ]; then
        log_success "Setup validation passed!"
        return 0
    else
        log_error "Setup validation failed with $errors errors"
        return 1
    fi
}

# Show setup summary
show_summary() {
    echo -e "\n${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                 SETUP COMPLETE!                      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}\n"
    
    echo -e "${BLUE}Configuration Summary:${NC}"
    echo -e "  OS: $OS"
    echo -e "  Solana Distribution: $SOLANA_DIST"
    echo -e "  Solana Version: $SOLANA_VERSION, ${YELLOW}should be >= 2.0.0${NC}"
    echo -e "  solana-lldb: $SOLANA_LLDB_PATH"
    echo -e "  Rust: $RUST_VERSION, ${YELLOW}should be >= 1.86.0${NC}"
    echo -e "  agave-ledger-tool: $AGAVE_LEDGER_TOOL_PATH"
    echo -e "  Anchor: $([ "$HAS_ANCHOR" = true ] && echo "Available" || echo "Not available")"
    
    echo -e "\n${YELLOW}Next Steps:${NC}"
    echo -e "  1. Open VS Code in your desired project directory"
    echo -e "  2. Press CTRL+Shift+P and search for 'Gimlet' commands"
    echo -e "  3. Choose 'Run Solana LLDB' to start debugging"
    echo -e "  4. Set breakpoints and start debugging!"
    echo -e "  5. https://lldb.llvm.org/use/map.html for LLDB commands reference"
    
    echo -e "\n${GREEN}Happy debugging with Gimlet!${NC}"
}

# Main setup function
main() {
    show_banner
    
    log_info "Starting Gimlet setup process..."
    
    detect_os
    check_rust
    detect_solana
    check_anchor
    check_python
    find_solana_lldb
    find_agave_ledger_tool
    
    if validate_setup; then
        show_summary
        exit 0
    else
        log_error "Setup incomplete. Please check the errors above."
        exit 1
    fi
}

# Run setup if script is executed directly
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    main "$@"
fi
