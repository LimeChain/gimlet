# Gimlet

Gimlet is a VSCode Extension that makes Solana smart contract debugging seamless, automated, and fully integrated into the VS Code experience, eliminating the need for manual configuration or terminal-only workflows.

#### Install Gimlet from [here](https://marketplace.visualstudio.com/items?itemName=emilroydev.gimlet-beta)

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Introduction](#introduction)
- [Usage](#usage)
- [Example Project](#example-project)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before using Gimlet, ensure you have the following tools installed:

| Tool             | Installation Command                                                                                   | Notes                |
|------------------|--------------------------------------------------------------------------------------------------------|----------------------|
| `rust-analyzer`  | [Rust Analyzer Extension](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer) | VSCode extension     |
| `codeLLDB`       | [CodeLLDB Extension](https://marketplace.visualstudio.com/items?itemName=vadimcn.vscode-lldb)          | VSCode extension     |
| `solana-cli`     | [Solana Docs](https://solana.com/docs/intro/installation)                                              | Use latest version   |
| `platform-tools` | [Solana Docs](https://solana.com/docs/intro/installation)                                              | Use versions >= 1.51 |

---

## Introduction

Gimlet uses LiteSVM to execute its tests. Each test transaction can start a VM instance running in SBPF, which exposes a gdbstub for debugging over TCP. Gimlet connects to this gdbstub using a specified `tcpPort`. It then launches `lldb` with a special library provided by the Solana platform-tools, enabling LLDB to load and debug ELF files—your compiled SBPF programs. It also supports CPI (Cross-Program Invocation) debugging.

---

## Getting Started with Gimlet

Gimlet makes debugging Solana programs inside VS Code effortless. Follow these steps to get started:

### 1. Automatic Configuration

When you open your Solana project, **Gimlet** automatically creates a `.vscode/gimlet.json` configuration file.  
You can customize this file to:
- Specify a different **platform-tools version**
- Change the default **TCP port** used for debugging  

Gimlet also adjusts a few **VS Code workspace settings** to ensure smooth integration.

### 2. Setup Steps

1. **Open VS Code** in your Solana project folder.  
2. **Install the Gimlet extension** from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=emilroydev.gimlet-beta).  
3. **Open a test case** — you’ll see a **CodeLens button** above it labeled:
   - `Sbpf Debug` → for individual Rust tests  
   - `Sbpf Debug All` → for TypeScript test suites  
4. **Click the button** to start step-by-step debugging using **Gimlet**.  

---

## Example Project

Example Anchor and Pinocchio programs to test Gimlet are available [here](https://github.com/ERoydev/anchor-litesvm-debugger-example).

---

## Troubleshooting

### Permission Denied When Trying to Debug a Program

Refer to the [Apple Developer Forum thread](https://forums.developer.apple.com/forums/thread/17452) for instructions on disabling debugging protection for macOS systems.

---

### Platform-tools

We recommend using platform-tools version **v1.51**.  
To force-install the correct version inside your Rust project, run:

```sh
cargo build-sbf --tools-version v1.51 --debug --arch v1 --force-tools-install
```

### Windows (WSL)

#### Common Issues and Solutions

##### `libpython 3.10.so.1.0` Not Found or Executable Not Found

```bash
sudo apt update
sudo add-apt-repository ppa:deadsnakes/ppa
sudo apt update
sudo apt install python3.10 python3.10-dev
python3.10 --version
```
