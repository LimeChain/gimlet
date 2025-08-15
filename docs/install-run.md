# Gimlet Installation and Usage Guide

## Install Gimlet

### Installation Steps

1. **Open VS Code Marketplace**
2. **Search for Gimlet** or click [here](https://marketplace.visualstudio.com/items?itemName=limechain.gimlet)
3. **Install** the extension
4. **Restart VS Code** if necessary

## Steps to Debug a Solana Program

### Prerequisites

>**Note:** Run `Gimlet: Check Dependencies` in the Command Palette to verify all requirements.
  
### Important: You must create JSON input file for `agave-ledger-tool`, read [here](./input-for-ledger-tool.md)

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
2. **Attach Debugger**: Launches `solana-lldb`, loads the `.debug` file, and registers any breakpoints you set before or after starting the session.

### 3. Launch tha Agave Ledger Tool on your solana local ledger
1. **Open Command Palette**: Press `Cmd + Shift + P` (macOS) or `Ctrl + Shift + P` (Windows)
2. **Select**: `Run Agave Ledger Tool for Breakpoint` from the command palette

- This will deploy using `.so` file in a mocked environment on the solana-local-host and will execute the instruction you have provided --input for (the JSON file)
- It will host a `gdb-remote` server which solanaLLDB will connect automatically when using Gimlet.
  
### 4. Add Breakpoints

#### Setting Breakpoints

- **Restarting:** To debug another instruction, run the `Agave Ledger Tool for Breakpoints` command again with a new `input.json` for that specific instruction *(just ensure you have the JSON file in the folder gimlet will derive it automatically)*.
  
- **Process Launching:** After setting breakpoints, use `continue` to restart the program and stop at your breakpoints.
  
- **Multiple Breakpoints:** Gimlet will make you choose one of your set breakpoints because `agave-ledger-tool` can run only for one instruction at a time.

### 4. Continue the process in the Debugger

1. **Open Command Palette**: Press `Cmd + Shift + P` (macOS) or `Ctrl + Shift + P` (Windows)
2. **Select**: `Continue process` to resume the debugger at specific breakpoint you have chosen.
3. **Another**: or just type `continue` in the `Solana LLDB Debugger` terminal

### 5. Hit Breakpoints

#### When a Breakpoint is Hit

- You will see the **memory address location**, **frame**, **file**, and **row** of the breakpoint in the terminal
- **To continue execution**: Type `continue` in the terminal
- **Program flow**: The program execution will continue until it finishes

## Running the Example Project

Follow these steps to run the example project:

1. **Navigate to project**: Open a terminal in the `examples/solana_test_extension` folder
2. **Open source file**: Open the `lib.rs` file located in the `src` directory
3. **Open Command Palette**: Press `Cmd + Shift + P` (macOS) or `Ctrl + Shift + P` (Windows)
4. **Start debugging**: Select `Run Solana LLDB` from the Command Palette
5. **Run Agave Ledger Tool for Breakpoints**  
   - In the Command Palette again, select **`Run Agave Ledger Tool for Breakpoint`**.  
   - This will deploy and execute your instruction using the `input.json` file.
6. **Monitor the Solana LLDB Terminal**  
   - Wait until **agave-ledger-tool** connects successfully.  
   - Then focus on the Solana LLDB terminal.
7. **Set Breakpoints**  
   - Once the setup is complete, set or remove breakpoints in your IDE as needed.
8. **Continue Process**  
   - Run the **`continue`** command inside the `solana-lldb` terminal to start debugging with your breakpoints active.
   - Or use the `Continue process` from Command Palette both of them are the same

## Additional LLDB Commands

For a comprehensive list of LLDB commands and their usage, refer to the official [LLDB Commands Documentation](https://lldb.llvm.org/use/map.html).