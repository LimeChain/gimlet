# Gimlet

Gimlet is a VSCode Extension for debugging Solana programs. It is a wrapper for the locally installed tools `agave-ledger-tool` and `solana-lldb`.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Setup](#setup)
  - [macOS](#macos)
  - [Windows (WSL)](#windows-wsl)
- [Installation](#installation)
- [Usage](#usage)
  - [Running Agave Ledger Tool](#running-agave-ledger-tool)
  - [Debugging a Solana Program](#debugging-a-solana-program)
  - [Additional LLDB Commands](#additional-lldb-commands)
- [Example Project](#example-project)
- [Troubleshooting](#troubleshooting)
  - [macOS Issues](#macos)
  - [Windows (WSL) Issues](#windows-wsl)

## Prerequisites

Before using Gimlet, ensure you have the following tools installed:

| Tool                | Installation Command                                                                                   | Notes                                          |
|---------------------|--------------------------------------------------------------------------------------------------------|------------------------------------------------|
| `rust-analyzer`     | [Rust Analyzer Extension](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) | VSCode extension                               |
| `agave-ledger-tool` | `cargo install agave-ledger-tool`                                                                      |                                                |
| `solana-cli`        | `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"`                                        | Use latest version (2.0.23 at time of writing) |
| `solana-lldb`       | See [setup instructions](#2-if-solana-lldb-is-not-found)                                               |                                                |

## Setup

Choose the appropriate setup instructions for your operating system:

### macOS

#### 1. Configuring PATH Variables

Add the following lines to your `.zshrc` or `.bashrc`:

```sh
# Solana CLI path
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Solana LLDB tools path
# Note: Choose only one of the two options based on your Solana installation structure.

# Option 1
export PATH="/$PATH:/Users/user/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/llvm/bin"

# Option 2
export PATH="$PATH:$HOME/.local/share/solana/install/active_release/bin/sdk/sbf
```

#### 2. If solana-lldb is not found

Run this command inside a Solana Rust project:

```sh
cargo-build-sbf --force-tools-install
```

This will force the installation of missing Solana build tools required for debugging.

---
### Windows (WSL)

#### 1. Prerequisites
- Follow the [Solana Guide for WSL](https://solana.com/docs/intro/installation)
- Install LLDB: `sudo apt install lldb`

#### 2. Configuring PATH Variables (IMPORTANT!)

Add the following lines to your `.bashrc`:

```sh
. "$HOME/.cargo/env"
export PATH="/usr/bin:$PATH"
export PATH="/usr/local/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"
export PATH="/root/.avm/bin:$PATH"
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
export LLDB_DEBUGSERVER_PATH="/usr/bin/lldb-server"

# Solana LLDB tools path (choose the one matching your installation)
# Option 1
export PATH="/$PATH:/root/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/llvm/bin"

# Option 2
export PATH="/$PATH:/root/.local/share/solana/install/active_release/bin/sdk/sbf
```

---
## Installation

1. Install the extension from the VS Code Marketplace
2. Ensure you have all [Prerequisites](#prerequisites) installed locally

## Usage

### Getting Started

1. Open VS Code inside your Solana project folder
2. Start your local ledger (see [Running Agave Ledger Tool](#running-agave-ledger-tool))
3. Use `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to run `Gimlet: Check Dependecies` - this will run a script to verify all dependencies
4. Use the command palette to run either `Run Agave Ledger Tool` or `Run Solana LLDB`

### Running Agave Ledger Tool

#### Starting a Local Ledger

Before running any commands, you need to start a local ledger:

```sh
solana-test-validator --ledger ./ledger
```

#### Running the Tool

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
2. Select `Run Agave Ledger Tool`
3. Enter a valid subcommand when prompted (example: `accounts`)

The output will be displayed in the integrated terminal.

> **Note:** Make sure you have a local ledger set up and running before executing commands.

### Debugging a Solana Program

#### Step-by-Step Process
> **Note:** `Gimlet: Check Dependencies` in the Command Palette to verify all requirements.

1. **Start local ledger** - Follow the instructions in [Running Agave Ledger Tool](#running-agave-ledger-tool)
2. **Open Command Palette** - Use `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
3. **Select debugging option** - Choose `Run Solana LLDB`
4. **Automatic setup** - The extension will build and start debugging your Solana program using solana-lldb
5. **Set breakpoints** - Once setup is complete, you can set and remove breakpoints in the IDE
6. **Launch process** - Run the `Re-run process launch` command to start debugging with your breakpoints

#### Important Notes

- **Breakpoint management**: If you run the debugger again, remove current breakpoints and set them again
- **Process launching**: After setting breakpoints, use `Re-run process launch` to restart the program and stop at your breakpoints
- **Restarting**: You can run the entire debugging command again to restart the whole process

#### `Re-run process launch` Command from Command Pallette

This command re-runs the currently mounted executable in the same terminal, allowing you to restart debugging with your current breakpoints.

> **Tip:** You can run the debugging command multiple times to restart the entire debugging session.

### Additional LLDB Commands

For a comprehensive list of LLDB commands and their usage, refer to the official [LLDB Commands Documentation](https://lldb.llvm.org/use/map.html).

---
## Example Project

For detailed step-by-step instructions on how to run the example project, refer to the [Installation and Run Guide](docs/install-run.md).

---
## Troubleshooting

### macOS

If you encounter issues with the extension, verify that you have the following packages installed:

#### Required Packages

| Package    | Installation Command    |
|------------|-------------------------|
| `protobuf` | `brew install protobuf` |
| `llvm`     | `brew install llvm`     |

#### Common Issues and Solutions

##### PATH Configuration for LLVM

Add this to your `.zshrc` or `.bashrc`:

```sh
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
```

##### `args-dumper` Not Found Error

Add this to your `.zshrc` or `.bashrc`:

```sh
export LLDB_DEBUGSERVER_PATH="/Applications/Xcode.app/Contents/SharedFrameworks/LLDB.framework/Versions/A/Resources/debugserver"
```

##### Attach Failed (Not Allowed to Attach to Process)

1. **Check Console Messages**: Look in Console.app near the debugserver entries when the attach failed. The subsystem that denied permission will likely have logged an informative message.

2. **Grant Developer Tools Access**: 
   - Go to `System Preferences` → `Privacy & Security` → `Developer Tools` 
   - Grant access to Terminal

3. **Disable Debugging Protection**: On some machines, you may need to disable debugging protection. Refer to this [Apple Developer Forum thread](https://forums.developer.apple.com/forums/thread/17452) for detailed instructions.

##### Permission Denied When Trying to Debug a Program

Refer to the [Apple Developer Forum thread](https://forums.developer.apple.com/forums/thread/17452) for instructions on disabling debugging protection for macOS systems.

---
### Windows (WSL)

#### Common Issues and Solutions

##### `libpython 3.8.so.1.0` Not Found or Executable Not Found

Install Python 3.8 and development libraries:

```sh
sudo apt update
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install python3.8 python3.8-dev
python 3.8 --version
```

##### `lldb-server` Not Found Error

This issue occurs when the PATH for the LLDB server is not set correctly. Add this to your `.bashrc`:

```sh
export LLDB_DEBUGSERVER_PATH="/usr/bin/lldb-server"
```
