# Change Log

All notable changes to the "Gimlet" extension will be documented in this file.

## [0.0.11] - 2025-8-26

### Added

- Added documentation highlighting common errors and troubleshooting steps when manually creating input JSON files for `agave-ledger-tool`. [#45](https://github.com/LimeChain/gimlet/pull/45)

### Changed

- Updated input ledger tool documentation.
  
## [0.0.10] - 2025-8-19

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
