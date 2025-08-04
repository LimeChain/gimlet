# Gimlet Installation and Usage Guide

## Install Gimlet

### Installation Steps

1. **Open VS Code Marketplace**
2. **Search for Gimlet** or click [here](https://marketplace.visualstudio.com/items?itemName=limechain.gimlet)
3. **Install** the extension
4. **Restart VS Code** if necessary

## Steps to Debug a Solana Program

### Prerequisites

- **Note:** Run `Gimlet: Check Dependencies` in the Command Palette to verify all requirements.

### 1. Start Local Ledger

Open terminal and run:

```zsh
solana-test-validator --ledger ./ledger
```

> **Important:** You should use that specific naming convention for your local ledger folder.

### 2. Launch the Debugger

1. **Open Command Palette**: Press `Cmd + Shift + P` (macOS) or `Ctrl + Shift + P` (Windows)
2. **Select**: `Run Solana LLDB` from the command palette

#### What Happens During Launch

The debugger will automatically perform the following steps:

1. **Compile Program**: Uses `cargo build-sbf --debug` to create sBPF `.so` and `.debug` stripped files
2. **Start Debug Server**: Runs the compiled `.so` file on local ledger using `agave-ledger-tool` in debug mode, starting a GDB remote server (usually on port 9001)
3. **Attach Debugger**: Launches `solana-lldb` and attaches it to the GDB remote port, loading the `.debug` file for debugging

### 3. Add Breakpoints

#### Setting Breakpoints

- **After the file has run**, you can add breakpoints
- **To add a breakpoint**: Click on a row in the breakpoint area or press `F9`
- **Dynamic management**: You can add and remove breakpoints, and commands will automatically be executed in the Solana LLDB terminal to reflect these changes

> **Important:** If the debugger is stopped, you will need to add all of the breakpoints again.

### 4. Re-run the Debugger

1. **Open Command Palette**: Press `Cmd + Shift + P` (macOS) or `Ctrl + Shift + P` (Windows)
2. **Select**: `Re-run process launch` to run the debugger with the breakpoints

### 5. Hit Breakpoints

#### When a Breakpoint is Hit

- You will see the **memory address location**, **frame**, **file**, and **row** of the breakpoint in the terminal
- **To continue execution**: Type `continue` in the terminal
- **Program flow**: The program execution will continue to the next breakpoint or until it finishes

## Running the Example Project

### Step-by-Step Instructions

Follow these steps to run the example project:

1. **Navigate to project**: Open a terminal in the `example-project/solana_test_extension` folder
2. **Open source file**: Open the `lib.rs` file located in the `src` directory
3. **Open Command Palette**: Press `Cmd + Shift + P` (macOS) or `Ctrl + Shift + P` (Windows)
4. **Start debugging**: Select `Run Solana LLDB` from the Command Palette
5. **Wait for installation**: A popup will appear in the right corner with the message "Target folder not found. Cargo is installing necessary tools." Wait while Cargo installs the necessary tools
6. **Automatic execution**: Once the installation is complete, the debugger will automatically start and execute the program
7. **Set breakpoints**: After the program finishes executing, you can set breakpoints and run it again using the Command Palette and selecting `Re-run process launch`

---

## Additional LLDB Commands

For a comprehensive list of LLDB commands and their usage, refer to the official [LLDB Commands Documentation](https://lldb.llvm.org/use/map.html).
