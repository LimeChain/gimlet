# Solana Debugger Extension

> **Note:** This is a wrapper for the locally installed tools `agave-ledger-tool` and `solana-lldb`.

## Prerequisites

- `rust-analyzer` -> [Rust Analyzer Extension](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## macOS

### You need to have installed

- `agave-ledger-tool` -> `cargo install agave-ledger-tool`
- `solana-cli` -> `sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"` NOTE: Use latest version (2.0.23 at time of writing)

### PATHS for solana-cli .zshrc or .bashrc IMPORTANT

```sh
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# for this path below there could be 2 possibilities
export PATH="/$PATH:/Users/user/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/llvm/bin"

# or

export PATH="$PATH:$HOME/.local/share/solana/install/active_release/bin/sdk/sbf
```

If solana-lldb is not found on system you might need to run this command inside a rust project

```sh
cargo-build-sbf --force-tools-install
```

Optional

`anchor avm` -> `cargo install --git https://github.com/coral-xyz/anchor avm --force`

## Windows (WSL)

- Follow the [Solana Guide for WSL](https://solana.com/docs/intro/installation)

- Additionally install lldb -> `sudo apt install lldb`

### PATHS for solana-cli .bashrc IMPORTANT

```sh
. "$HOME/.cargo/env"
export PATH="/usr/bin:$PATH"
export PATH="/usr/local/bin:$PATH"
export PATH="$HOME/.cargo/bin:$PATH"
export PATH="/root/.avm/bin:$PATH"
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
export LLDB_DEBUGSERVER_PATH="/usr/bin/lldb-server"

# for this path below there could be 2 possibilities
export PATH="/$PATH:/root/.local/share/solana/install/active_release/bin/sdk/sbf/dependencies/platform-tools/llvm/bin"

# or

export PATH="/$PATH:/root/.local/share/solana/install/active_release/bin/sdk/sbf
```

#### in a solana project run `cargo-build-sbf --force-tools-install` to install all off the necesarry tools

## Installation

1. Install the extension from the VS Code Marketplace.
2. Ensure you have the `Prerequisites` installed locally.

## Usage

1. Open your VS Code inside the Solana project folder.
2. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to run `Run Agave Ledger Tool` or `Run Solana LLDB`.

### Running Agave Ledger Tool

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Select `Run Agave Ledger Tool`.
3. Enter a valid subcommand when prompted, for example:

```sh
   accounts
```

NOTE: Keep in mind that you need to have setup a ledger locally and you need to config the path to the ledger using

```sh
-l /path/to/your/ledger
```

The output will be displayed in the integrated terminal.

### Debugging a Solana Program

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Select `Run Solana LLDB`.
3. The extension will build and start debugging your Solana program using solana-lldb.
4. Once everything is completed you can set and remove breakpoints in the IDE and commands will automatically run inside the terminal. (If you run it again you should remove current breakpoints and redo them).
5. After you've set breakpoint you need to run the command `Re-run process launch` to launch the program again and stop at the set breakpoints.

### Additional LLDB Commands

Refer to this site [LLDB Commands](https://lldb.llvm.org/use/map.html)

#### Re-run process launch command

- It re-runs the currently mounted executable in the same terminal.

TIP: You can run the command again to restart the whole thing.

## Example project

For detailed steps on how to run the example project, refer to the [installation and run guide](docs/install-run.md).

## Troubleshooting

## macOS

if you have troubles with the extension, check if you have the following things installed:

- `protobuf` -> `brew install protobuf`
- `llvm` -> `brew install llvm`

### PATH for llvm

```sh
export PATH="/opt/homebrew/opt/llvm/bin:$PATH"
```

### `args-dumper` Not Found Error

In `.zshrc` or `.bashrc`:

```sh
export LLDB_DEBUGSERVER_PATH="/Applications/Xcode.app/Contents/SharedFrameworks/LLDB.framework/Versions/A/Resources/debugserver"
```

### Attach Failed (Not Allowed to Attach to Process)

Look in the console messages (Console.app), near the debugserver entries, when the attach failed. The subsystem that denied the attach permission will likely have logged an informative message about why it was denied.

Go to:

- `System Preferences` -> `Privacy & Security` -> `Developer Tools` -> `Grant access to Terminal`

On some machines, the step below could also fix the issue:

### Permission Denied When Trying to Debug a Program

Refer to this [Apple Developer Forum thread](https://forums.developer.apple.com/forums/thread/17452) to disable debugging protection for macOS systems.

## Windows (WSL)

### libpython 3.8.so.1.0 not found or executable not found

```sh
sudo apt update
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install python3.8 python3.8-dev
python 3.8 --version
```

### error: lldb-server not found

This might be caused if PATH for the lldb server is not set correctly. In .bashrc

```sh
export LLDB_DEBUGSERVER_PATH="/usr/bin/lldb-server"
```
