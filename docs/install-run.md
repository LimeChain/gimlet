# Gimlet Installation and Usage Guide

## Install Gimlet

### Installation Steps

1. **Open VS Code Marketplace**
2. **Search for Gimlet** or click [here](https://marketplace.visualstudio.com/items?itemName=limechain.gimlet)
3. **Install** the extension
4. **Restart VS Code** if necessary

## Steps to Debug a Solana Program

### Prerequisites

>**Note:** Run `Gimlet: Run Setup` in the Command Palette to verify all requirements.

### 1. Build Your Program

Compile your program with debug symbols:

```sh
cargo-build-sbf --tools-version v1.54 --debug --arch v1
```

> **Note:** Re-run this command whenever you change your program code.

### 2. Run Your Test

Run your test with the debugger enabled:

```sh
SBF_DEBUG_PORT=1212 SBF_TRACE_DIR=$PWD/target/deploy/debug/trace cargo test --features sbpf-debugger
```

This starts the test with a gdbstub listening on the specified TCP port, which Gimlet will connect to.

### 3. Connect Gimlet

1. **Open the test file** in VS Code — you'll see **CodeLens buttons** above test functions:
   - `Sbpf Debug` → for individual Rust tests
   - `Sbpf Debug All` → for TypeScript test suites
2. **Click the button** to connect Gimlet and start step-by-step debugging.

#### What Happens During Launch

Gimlet will automatically:

1. **Scan** `target/deploy/debug/` for compiled `.so` and `.debug` files
2. **Connect** to the gdbstub via `gdb-remote` on the configured TCP port
3. **Load** the correct `.debug` ELF binary into LLDB for symbol resolution

### 4. Set and Hit Breakpoints

- Set breakpoints in your Solana program source code before or after connecting
- Use the VS Code debug controls to step through, continue, and inspect variables

## Additional LLDB Commands

For a comprehensive list of LLDB commands and their usage, refer to the official [LLDB Commands Documentation](https://lldb.llvm.org/use/map.html).
