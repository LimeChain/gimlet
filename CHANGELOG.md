# Change Log

All notable changes to the "Gimlet" extension will be documented in this file.

## [Unreleased]

## [0.1.19] - 2026-04-16

### Changed

- Updated README to align with latest sbpf-debugger feature changes

### Fixed

- Fail immediately when no debug session is found on the port instead of waiting silently

## [0.1.18] - 2026-04-16

- Improve error message when program_ids.map is not found to mention SBF_TRACE_DIR and sbfTraceDir config
- Scope PYTHONPATH to debug session instead of persisting in workspace settings

## [0.1.17] - 2026-04-16

### Fixed

- CI workflow with lint, syntax check, and dry-run packaging on every push

## [0.1.16] - 2026-04-16

### Fixed

- Set PYTHONPATH for LLDB Python module resolution on all platforms

## [0.1.15] - 2026-04-16

### Fixed

- Set PYTHONPATH for LLDB Python module resolution on all platforms via initCommands as script command

## [0.1.14] - 2026-04-16

### Fixed

- Set PYTHONPATH for LLDB Python module resolution on all platforms via initCommands

## [0.1.13] - 2026-04-16

### Added

- `sbfTraceDir` config option in `gimlet.json` to override the default trace directory with a workspace-relative path

### Changed

- Trace directory now defaults to `target/sbf/trace` instead of `target/deploy/debug/sbf/trace`

### Fixed

- Show specific error messages for each scan failure instead of a generic one
- Stop debug process when trace is not found
- Recalculate config paths on hot-reload so cached values stay in sync
- Load existing gimlet.json values into globalState on activation so sbfTraceDir is picked up immediately
- Reset sbfTraceDir to default when removed from gimlet.json instead of keeping the stale value
- Auto-stop debugger when test execution ends or fails instead of polling forever
- Auto-set PYTHONPATH for LLDB Python module resolution on all platforms

## [0.1.12] - 2026-04-06

### Added

- Screenshot in README demonstrating how the debugger works

### Changed

- Bump all dependencies to latest major versions: toml 4.1.1, eslint 10.2.0, globals 17.4.0, @types/node 22.x, @types/vscode 1.110.0, prettier 3.8.1

### Removed

- Unused test scaffolding (@types/mocha, @vscode/test-cli, @vscode/test-electron, boilerplate test file)

### Fixed

- Resolved all 75 reported npm vulnerabilities

## [0.1.11] - 2026-04-03

### Added

- CPI debugging: debug across multiple programs in a single test
- `stopOnEntry` option in `gimlet.json` to control initial breakpoint behavior
- Timestamped logging via VS Code OutputChannel (`Gimlet` channel)
- `Gimlet: Stop Debug Session` command
- Program resolution via sha256 hash mapping from `program_ids.map`

### Changed

- Users now build manually with `cargo-build-sbf`
- CodeLens no longer depends on rust-analyzer; uses direct text scanning
- `lldb.library` scoped per debug session to avoid conflicts with rust-analyzer debugging
- Rewrote `gimlet-setup.sh` to check current dependencies
- Updated README and docs for new workflow
- Compatible with platform-tools v1.54

### Removed

- Build strategies (`baseBuildStrategy`, `sbpfV1BuildStrategy`, `buildCommands`)
- `constants.js`
- `docs/input-for-ledger-tool.md`
- Unused config properties (`solanaDebugger.solanaLldbPath`, `gimlet.enableCodeLens`)
- `agave-ledger-tool` dependency

## [0.0.11] - 2025-08-26

### Added

- Added documentation highlighting common errors and troubleshooting steps when manually creating input JSON files for `agave-ledger-tool`. [#45](https://github.com/LimeChain/gimlet/pull/45)

### Changed

- Updated input ledger tool documentation.

## [0.0.10] - 2025-08-19

### Added

- Improved time between lldb to ledger tool connection. [#44](https://github.com/LimeChain/gimlet/pull/44)
- Added Solana-lldb Troubleshooting

### Changed

- Updated documentation for clearer setup instructions, troubleshooting steps, and usage guidance
- Extended the time between solana-lldb and agave-ledger-tool gdb connection
- Added the npm package link to the docs inside the input-for-ledger-tool.md to provide automatic JSON generation

## [0.0.9] - 2025-08-15

### Added

- Mapped functions to addresses for instruction-level breakpoints with per-instruction debugging. [#41](https://github.com/LimeChain/gimlet/pull/41)

### Changed

- Updated documentation [#42](https://github.com/LimeChain/gimlet/pull/42)
- Updated the examples with input JSON files [#43](https://github.com/LimeChain/gimlet/pull/43)

## [0.0.8] - 2025-08-05

### Added

- Bash script automation to check for all required dependencies [#40](https://github.com/LimeChain/gimlet/pull/40)
- Examples using Anchor [#39](https://github.com/LimeChain/gimlet/pull/39)

### Changed

- Fix support for individual programs in multi-program Anchor projects [#39](https://github.com/LimeChain/gimlet/pull/39)
- Update documentation

## [0.0.7] - 2025-07-30

### Changed

- Use eBPF files for debugging instead of executable created from tests [#38](https://github.com/LimeChain/gimlet/pull/38)
- Refactored to use eBPF files for debugging instead of cargo test executable ones
- Implemented anchor logic to create binary exe and run it in lldb
- Updated README

## [0.0.6] - 2025-05-12

### Fixed

- Changed package name determination format [#15](https://github.com/LimeChain/gimlet/pull/15)
- Breakpoint listener and active instance of lldb terminal [#36](https://github.com/LimeChain/gimlet/pull/36)

### Added

- Keyboard bindings for key commands [#18](https://github.com/LimeChain/gimlet/pull/18)
- Bug report template [#12](https://github.com/LimeChain/gimlet/pull/12)

### Changed

- Improved README structure and content [#25](https://github.com/LimeChain/gimlet/pull/25)

## [0.0.5] - 2025-03-19

### Fixed

- Bug with terminal name [#10](https://github.com/LimeChain/gimlet/pull/10)

## [0.0.4] - 2025-03-13

### Added

- Logo and extension name [#9](https://github.com/LimeChain/gimlet/pull/9)

## [0.0.3] - 2025-02-10

### Changed

- Updated documentation [#8](https://github.com/LimeChain/gimlet/pull/8)

## [0.0.2] - 2025-02-07

### Added

- Documentation and example project [#4](https://github.com/LimeChain/gimlet/pull/4)
- Installation and usage documentation [#6](https://github.com/LimeChain/gimlet/pull/6), [#7](https://github.com/LimeChain/gimlet/pull/7)

### Changed

- Updated README with comprehensive setup instructions

## [0.0.1] - 2025-01-22

### Added

- Initial release of Gimlet extension
- Support for `solana-lldb` and `agave-ledger-tool`
- Dynamic breakpoint setting and deletion in VSCode
- WSL support with rust-lldb
- Path support for different environments
- VSCode engine compatibility for backwards compatibility
- Add MIT License
- GitHub Actions for CI/CD and publishing workflow

### Fixed

- Fixed solana-lldb to properly compile and execute lib.rs Solana programs
- Updated VS Code engine version for backwards compatibility

## [0.0.1-alpha] - 2025-01-21

### Added

- Alpha release with initial debugging capabilities
- Basic CI/CD setup
- Publisher configuration
