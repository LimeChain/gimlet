# Change Log

All notable changes to the "Gimlet" extension will be documented in this file.

## [Unreleased]

## [0.1.25] - 2026-04-30

### Fixed

- fix(session): collapse duplicate `debuggerSession` state to a single source of truth in `sessionManager` ([#59](https://github.com/LimeChain/gimlet/pull/59))
- fix(activation): drop redundant `rust-analyzer.debug.engine` workspace override; Gimlet launches CodeLLDB directly and no longer needs to overwrite the user's preference ([#60](https://github.com/LimeChain/gimlet/pull/60))

## [0.1.24] - 2026-04-30

### Added

- feat(ui): idle status tooltip with Mollusk / LiteSVM setup instructions (build flags + `cargo test` invocation)

### Changed

- perf(port): lower `scheduleCleanup` grace from 3s to 2s for snappier session-end transitions
- docs: clarify that the `sbpf-debugger` feature lives on the `mollusk-svm` / `litesvm` dependency
- chore: move debugger screenshot into `images/` and drop the empty `assets/` folder

## [0.1.23] - 2026-04-29

### Changed

- refactor(activation): activate on any Rust/TS workspace; drop the litesvm/mollusk gate
- refactor(activation): defer settings writes and `gimlet.json` creation to first Attach/Setup; auto-engage if `gimlet.json` exists
- perf(monitor): pause port polling while the Gimlet pane is hidden

### Fixed

- fix(monitor): refresh state on session cleanup so status bar/pane don't stick on "Attached"

### Removed

- Cargo.toml file watcher
- `toml` dependency

## [0.1.22] - 2026-04-29

### Added

- feat(ui): activity-bar pane and status-bar item showing debug session state (Idle / Ready / Attached) ([#58](https://github.com/LimeChain/gimlet/pull/58))
- feat: `Gimlet: Attach Debugger` command - attach via the Gimlet pane or the Command Palette
- feat(config): `platformToolsDir`, `lldbLibraryPath`, and `artifactsPath` overrides in `gimlet.json` for non-standard platform-tools installs ([#57](https://github.com/LimeChain/gimlet/pull/57))
- feat(config): schema-based validation of `gimlet.json`; debug launch is gated while errors exist
- feat(config): tri-state apply - valid keys apply, absent keys reset to defaults, invalid keys keep prior value
- feat(config): enforce `platformToolsVersion` >= 1.54 and integer `tcpPort` >= 1024

### Changed

- Replace per-test CodeLens with a status-bar item and a dedicated activity-bar pane
- perf(config): write `gimlet.json` only when content changes (stops mtime churn)
- refactor(config): lazy LLDB library resolution so missing platform-tools no longer throws on activation
- Rename `depsPath` to `artifactsPath`; remove vestigial `inputPath`

### Fixed

- fix: handle `startDebugging` errors and restore lldb config on failure
- fix: check llvm lib directory exists before use
- fix: validate `sbfTraceDir` stays within workspace - reject `..` traversal
- fix: quote `metadataFile` and `debugPath` in lldb commands to handle paths with spaces
- fix: use `os.tmpdir()` instead of hardcoded `/tmp/` for cross-platform temp dir
- fix: missing `await` on `listenAndStartDebugForPort()`
- fix(config): use `path.relative` for workspace containment (case-insensitive, cross-drive safe)
- fix(config): watch `gimlet.json` via `RelativePattern`; dispose prior watcher; handle create/delete events

### Removed

- CodeLens "Sbpf Debug" / "Sbpf Debug All" buttons above test functions
- Force-set of the `editor.codeLens` workspace setting

## [0.1.21] - 2026-04-16

### Changed

- refactor(port): replace `netstat` shell-out with `systeminformation` for cross-platform port detection

## [0.1.20] - 2026-04-16

Stable release - consolidates all changes since v0.0.10.

### Added

- feat: CPI debugging across multiple programs in a single test ([#48](https://github.com/LimeChain/gimlet/pull/48))
- feat: CodeLens button for SBPF debugging on Rust macros and TS test blocks
- feat: SBPF debug via VS Code debug adapter
- feat: session manager with state management and concurrent session prevention
- feat: output channel for stdout and stderr
- feat: configurable trace directory via `sbfTraceDir` in `gimlet.json` ([#50](https://github.com/LimeChain/gimlet/pull/50))
- feat: support for all Solana projects, not only Anchor
- feat: `stopOnEntry` option in `gimlet.json` to control initial breakpoint behavior
- feat: `Gimlet: Stop Debug Session` command
- feat: program resolution via sha256 hash mapping from `program_ids.map`
- feat: timestamped logging via VS Code OutputChannel (`Gimlet` channel)
- ci: add CI workflow with lint, syntax check, and dry-run packaging ([#54](https://github.com/LimeChain/gimlet/pull/54))
- docs: troubleshooting documentation ([#45](https://github.com/LimeChain/gimlet/pull/45))

### Fixed

- fix: fail immediately when no debug session is found on the port ([#56](https://github.com/LimeChain/gimlet/pull/56))
- fix: improve error message when `program_ids.map` is not found
- fix: scope PYTHONPATH to debug session instead of persisting in workspace settings
- fix: set PYTHONPATH for LLDB Python on all platforms ([#52](https://github.com/LimeChain/gimlet/pull/52), [#53](https://github.com/LimeChain/gimlet/pull/53))
- fix: auto-stop debugger when test execution ends or fails ([#51](https://github.com/LimeChain/gimlet/pull/51))
- fix: continue process command ([#46](https://github.com/LimeChain/gimlet/pull/46))
- fix: symlink issues when using LLDB library on linux-x86
- fix: rust-analyzer cursor pointer for editor
- fix: resolved all 75 reported npm vulnerabilities ([#49](https://github.com/LimeChain/gimlet/pull/49))

### Changed

- docs: align readme with latest sbpf-debugger feature changes ([#55](https://github.com/LimeChain/gimlet/pull/55))
- chore: bump dependencies & README ([#49](https://github.com/LimeChain/gimlet/pull/49))
- refactor: simplified and modularized extension architecture ([#48](https://github.com/LimeChain/gimlet/pull/48))
- refactor: CodeLens no longer depends on rust-analyzer; uses direct text scanning
- refactor: users now build manually with `cargo-build-sbf`; removed build strategies
- refactor: `lldb.library` scoped per debug session to avoid conflicts with rust-analyzer debugging
- chore: trace directory defaults to `target/sbf/trace` instead of `target/deploy/debug/sbf/trace`
- chore: compatible with platform-tools v1.54
- chore: bump all dependencies to latest major versions

### Removed

- `agave-ledger-tool` dependency
- Build strategies (`baseBuildStrategy`, `sbpfV1BuildStrategy`, `buildCommands`)
- `constants.js`, `docs/input-for-ledger-tool.md`
- Unused config properties (`solanaDebugger.solanaLldbPath`, `gimlet.enableCodeLens`)
- Unused test scaffolding (`@types/mocha`, `@vscode/test-cli`, `@vscode/test-electron`)

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
