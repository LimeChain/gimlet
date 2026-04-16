# Gimlet

Gimlet is a VSCode Extension that makes Solana smart contract debugging seamless, automated, and fully integrated into the VS Code experience.

![debugger](assets/vscode-debugger.png)

---

## Table of Contents

- [Gimlet](#gimlet)
  - [Table of Contents](#table-of-contents)
  - [Prerequisites](#prerequisites)
  - [Introduction](#introduction)
  - [Getting Started with Gimlet](#getting-started-with-gimlet)
    - [1. Automatic Configuration](#1-automatic-configuration)
    - [2. Setup Steps](#2-setup-steps)
  - [Troubleshooting](#troubleshooting)
    - [Permission Denied When Trying to Debug a Program](#permission-denied-when-trying-to-debug-a-program)
    - [Platform-tools](#platform-tools)
    - [Python Issues](#python-issues)

---

## Prerequisites

Before using Gimlet, ensure you have the following tools installed:

| Tool             | Installation Command                                                                                   | Notes                |
|------------------|--------------------------------------------------------------------------------------------------------|----------------------|
| `rust-analyzer`  | [Rust Analyzer Extension](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) | VSCode extension     |
| `codeLLDB`       | [CodeLLDB Extension](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)          | VSCode extension     |
| `solana-cli`     | [Solana Docs](https://solana.com/docs/intro/installation)                                              | Use latest version   |
| `platform-tools` | [Solana Docs](https://solana.com/docs/intro/installation)                                              | Use versions >= 1.54 |

---

## Introduction

When the `sbpf-debugger` feature is enabled in a Solana testing framework - currently [Mollusk](https://github.com/anza-xyz/mollusk/pull/229), with LiteSVM and surfpool on the way (pending alignment with Agave 4.0) - each instruction spins up a VM that, if `SBF_DEBUG_PORT` and `SBF_TRACE_DIR` are set, listens on that TCP port via a gdbstub. Gimlet connects to this port using the `tcpPort` setting (which must match `SBF_DEBUG_PORT`) and launches `lldb` with a special library provided by the Solana platform-tools, setting up the symbols needed to load and debug ELF files (your compiled Solana programs). CPI (Cross-Program Invocation) debugging is supported as well.

---

## Getting Started with Gimlet

Gimlet makes debugging Solana programs inside VS Code effortless. Follow these steps to get started:

### 1. Automatic Configuration

When you open your Solana project, **Gimlet** automatically creates a `.vscode/gimlet.json` configuration file.  
You can customize this file to:
- Specify a different **platform-tools version**
- Change the default **TCP port** used for debugging
- Control whether the debugger **stops on entry** or runs straight to your first breakpoint  

| Option                 | Default  | Description                                                                 |
|------------------------|----------|-----------------------------------------------------------------------------|
| `tcpPort`              | `1212`   | TCP port the gdbstub listens on                                             |
| `platformToolsVersion` | `"1.54"` | Solana platform-tools version                                               |
| `stopOnEntry`          | `true`   | Stop at program entry point; set to `false` to skip to the first breakpoint |
| `sbfTraceDir`          | `null`   | Relative path from the workspace root to the SBF trace directory; defaults to `target/sbf/trace` |

### 2. Setup Steps

1. **Open VS Code** in your Solana project folder.  
2. **Install the Gimlet extension** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=limechain.gimlet).
3. **Build your program** with debug symbols:
   ```sh
   RUSTFLAGS="-Copt-level=0 -C strip=none -C debuginfo=2" cargo build-sbf --tools-version v1.54 --debug --arch v1
   ```
4. **Run your test** with the debugger enabled:
   ```sh
   SBF_DEBUG_PORT=1212 SBF_TRACE_DIR=$PWD/target/sbf/trace cargo test --features sbpf-debugger
   ```
   `SBF_TRACE_DIR` is required: it tells the runtime where to emit `program_ids.map`, which maps each program ID to the SHA-256 of its ELF. Gimlet uses this mapping to locate the matching debug symbols.
5. **Open the test file in VS Code** - you'll see a **CodeLens button** above it labeled:
   - `Sbpf Debug` → for individual Rust tests  
   - `Sbpf Debug All` → for TypeScript test suites  
6. **Click the button** to connect **Gimlet** and start step-by-step debugging.  

---

## Troubleshooting

### Permission Denied When Trying to Debug a Program

Refer to the [Apple Developer Forum thread](https://forums.developer.apple.com/forums/thread/17452) for instructions on disabling debugging protection for macOS systems.

---

### Platform-tools

We recommend using platform-tools version **v1.54**.  
To force-install the correct version inside your Rust project, run:

```sh
cargo build-sbf --tools-version v1.54 --debug --arch v1 --force-tools-install
```

### Python Issues

If for some reason you're willing to debug by hand and `lldb` fails to start due to missing or mismatched Python, follow the upstream guide: [README_SOLANA_LLDB_PYTHON.md](https://github.com/anza-xyz/llvm-project/blob/solana-rustc/20.1-2025-02-13/lldb/docs/solana/README_SOLANA_LLDB_PYTHON.md).
