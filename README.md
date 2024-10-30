# Solana Debugger Extension

## Installation

1. Install the extension from the VS Code Marketplace.
2. Ensure you have the Solana tools installed locally.

## Usage

1. Open your Solana project in VS Code.
2. Use the command palette (`Ctrl+Shift+P` or `Cmd+Shift+P`) to run `Run Agave Ledger Tool` or `Run Solana LLDB`.

### Running Agave Ledger Tool

1. Open the Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`).
2. Select `Run Agave Ledger Tool`.
3. Enter a valid subcommand when prompted, for example:

```sh
   validate --path /path/to/ledger
```

The output will be displayed in the integrated terminal.

### Debugging a Solana Program

1. Open the Command Palette (Ctrl+Shift+P or Cmd+Shift+P).
2. Select Run Solana LLDB.
3. The extension will build and start debugging your Solana program using LLDB.
