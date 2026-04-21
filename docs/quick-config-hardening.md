---
name: config-hardening
description: Make Gimlet's hardcoded Solana paths user-configurable via gimlet.json, validate config inputs, and fix the module-load throw that bypasses the litesvm/mollusk activation gate.
type: enhancement
created: 2026-04-21
reference: docs/user-context/config-hardening-plan.md
---

# Quick: Config Hardening

## Change Description

Today Gimlet joins hardcoded paths (`~/.cache/solana/v{version}/platform-tools/...`, `workspace/target/deploy/debug`, `workspace/input`) and assumes they exist. When they don't — Agave users, NixOS shells, custom toolchains, CI, or anyone with `CARGO_TARGET_DIR` set — there's no escape hatch. The singleton even throws at `require` time, so the extension fails to load before the litesvm/mollusk gate can skip activation cleanly.

This work (a) makes every Solana-related path overridable via `.vscode/gimlet.json`, (b) validates user-supplied config values at the boundary with a single aggregated toast, (c) lazy-initialises the LLDB resolution so `require` never throws, and (d) fixes three adjacent bugs surfaced by the audit: a null-destructure in `extension.js`, a redundant-write in `config.js`, and a watcher leak in `config.js`.

Full rationale, code examples, and risks per change: `docs/user-context/config-hardening-plan.md`.

## Affected Files

- `src/state/globalState.js`: lazy getter for `lldbLibrary`, `invalidateLldbLibrary()`, `getPlatformToolsDir()` / `getPlatformToolsLibDir()` / `getPlatformToolsBinDir()` derivation methods, 3-tier `getLldbLibraryPath()` (override → derived default → diagnostic), `platformToolsDirOverride` and `lldbLibraryPathOverride` fields, `SCHEMA` + `validateConfig()`, both override keys consumed in `setConfig`.
- `src/managers/debugConfigManager.js`: `getSolanaScriptsDir()` and `getLldbPythonPath()` consume `globalState.getPlatformToolsBinDir()` / `getPlatformToolsLibDir()`; "platform-tools not found" toast names `platformToolsDir` as remediation. (Added per amendment **A-1**.)
- `src/managers/portManager.js`: **one-line relocation only** — move `const updates = { library: globalState.lldbLibrary };` inside the existing `try` block in `runDebugSessionIteration`. `withLldbConfig` is untouched.
- `src/config.js`: `depsPath` and `inputPath` 3-tier resolution with workspace-containment check, diff-then-write in `ensureGimletConfig`, dispose-previous-watcher in `watchGimletConfig`.
- `src/extension.js`: null-guard `resolveGimletConfig()` return before destructure in `scanDeployDirectory`.

## Acceptance Criteria

### AC-1: Null-destructure no longer masks config failures (Change 5)
- **Given** `resolveGimletConfig()` returns `null` (e.g., no workspace folder, sbfTraceDir outside workspace, or future validation failure)
- **When** `scanDeployDirectory` calls it
- **Then** `scanDeployDirectory` returns `false` cleanly — no `TypeError: Cannot destructure property 'depsPath' of 'null'`.

### AC-2: `require('./state/globalState')` never throws (Change 2)
- **Given** platform-tools is not installed (no `~/.cache/solana/v1.54/...`)
- **When** the extension host loads the module
- **Then** the module loads successfully, `activate()` runs, the litesvm/mollusk gate in `extension.js:123` decides whether to proceed — no red "extension activation failed" toast at load time.

### AC-3: `platformToolsDir` override is honoured (Change 1; amended A-1)
- **Given** `.vscode/gimlet.json` contains `"platformToolsDir": "/path/to/platform-tools"` pointing at a real directory that contains `llvm/lib/liblldb.{ext}`, `llvm/bin/`, and Python site-packages
- **When** a debug session starts
- **Then** `globalState.getPlatformToolsDir()` returns the override; LLDB library, `PYTHONPATH`, and LLDB scripts dir (`lldb_lookup.py` etc.) all resolve under the override root. Prior workspace `lldb.library` is restored on session end.

### AC-3b: `lldbLibraryPath` override wins over derived default (Change 1; amended A-1)
- **Given** `platformToolsDir` is set AND `lldbLibraryPath` points at a specific `.dylib`/`.so` file (e.g., `liblldb.20.1.7-rust-dev.dylib` with no `liblldb.{ext}` symlink)
- **When** a debug session starts
- **Then** `globalState.lldbLibrary` resolves to the `lldbLibraryPath` file, not the derived `{platformToolsDir}/llvm/lib/liblldb.{ext}` path. Python and scripts paths still derive from `platformToolsDir`.

### AC-4: Missing override produces one clean toast (Change 1 + 2a)
- **Given** `"lldbLibraryPath"` points at a non-existent file
- **When** a debug session starts
- **Then** a single Gimlet toast names the missing file; `withLldbConfig` is never entered (nothing to restore); the polling loop exits with `return false`; no unhandled `TypeError` or stack trace escapes.

### AC-4b: Missing `platformToolsDir` root produces one clean toast (Change 1; amended A-1)
- **Given** `"platformToolsDir"` points at a non-existent directory AND `lldbLibraryPath` is not set
- **When** a debug session starts
- **Then** the LLDB tier-2 default path is `{platformToolsDir}/llvm/lib/liblldb.{ext}` and `realpathSync` throws. A single diagnostic toast lists the attempted path plus both remediation keys (`platformToolsDir` root, `lldbLibraryPath` file).
- **And** if the failure occurs in `debugConfigManager.getLldbPythonPath()` first (e.g., lib dir missing), the "Solana platform-tools not found" toast names `platformToolsDir` as the alternative remediation.

### AC-5: Missing default also produces one clean toast (Change 1)
- **Given** no override set and platform-tools is missing
- **When** a debug session starts
- **Then** a single Gimlet toast names the attempted default path, the `cargo build-sbf` install command, and points at both `platformToolsDir` and `lldbLibraryPath` as alternatives.

### AC-6: Malformed `gimlet.json` values surface as config errors (Change 4)
- **Given** `gimlet.json` contains `"tcpPort": "1212"` (string) and `"platformToolsVersion": "v1.54"` (bad format)
- **When** `setConfig` runs
- **Then** a single toast enumerates both violations; activation continues with defaults for the bad keys; unknown keys warn but don't reject.

### AC-7: `depsPath` and `inputPath` overrides honoured (Change 3)
- **Given** `gimlet.json` sets `"depsPath": "custom/target/deploy/debug"` and `"inputPath": "fixtures"` (workspace-relative)
- **When** `resolveGimletConfig()` runs
- **Then** the resolved paths are used, and both are rejected via error toast if they resolve outside the workspace root (same containment rule as `sbfTraceDir` at `config.js:34`).

### AC-8: `CARGO_TARGET_DIR` fallback for `depsPath` (Change 3)
- **Given** no `depsPath` override in `gimlet.json` AND `CARGO_TARGET_DIR` is set in the environment
- **When** `resolveGimletConfig()` runs
- **Then** `depsPath` resolves to `$CARGO_TARGET_DIR/deploy/debug`; absent both, falls through to the current workspace default.

### AC-9: `gimlet.json` mtime unchanged when content unchanged (Change 6)
- **Given** activation runs with a `gimlet.json` that already matches the merged config
- **When** `ensureGimletConfig()` runs
- **Then** `writeFileSync` is not called; `fs.statSync(configPath).mtime` is identical to before activation.

### AC-10: One config edit → one reload toast, no matter how many re-activations (Change 7)
- **Given** `activateDebugger` has run N times (via repeated `Cargo.toml` saves)
- **When** the user edits `gimlet.json` once
- **Then** exactly one `Gimlet config updated and state refreshed.` toast fires — previous watchers were disposed.

### AC-10b: All three file events trigger reload (Change 7; user-reported during Task 2 testing)
- **Given** a user edits `gimlet.json` via any of: in-place save (onDidChange), atomic save (onDidDelete + onDidCreate — some editors/formatters do this), or manual file delete/create
- **When** the save completes
- **Then** `setConfig` runs and reloads state. Specifically:
  - `onDidChange`: read file → `setConfig(parsedConfig)` → toast
  - `onDidCreate`: read file → `setConfig(parsedConfig)` → toast
  - `onDidDelete`: `setConfig({})` → all overrides reset to null (as if the file held `{}`) → toast "Gimlet config removed; using defaults."
- **And:** deleting the `platformToolsDir` or `lldbLibraryPath` key from an existing file must reliably reset those overrides without an IDE reload.

### AC-11: `withLldbConfig` inject/restore behaviour is preserved bit-for-bit
- **Given** a user has `"lldb.library": "/usr/lib/liblldb.so"` set in `.vscode/settings.json`
- **When** a Gimlet debug session starts, runs, and ends (or fails)
- **Then** `.vscode/settings.json` on disk still contains `"lldb.library": "/usr/lib/liblldb.so"` — Gimlet's injected value was restored by the `finally` block of `withLldbConfig`. This is verified on disk, not only in the editor view.

## Constraints (LOCKED)

- **[LOCKED] `withLldbConfig` untouched.** `src/managers/portManager.js:9-25` — no changes to the capture-originals → update → `finally`-restore sequence, the `ConfigurationTarget.Workspace` target, or the try/finally structure. Commit `103ac77` hardened this on purpose.
- **[LOCKED] `portManager.js` touched only for the Change 2a relocation.** One line moves into the existing `try` block. No other reordering, no new try blocks, no new imports.
- **[LOCKED] No I/O in module-load.** `require('./state/globalState')` must never throw. I/O happens behind the lazy getter.
- **[LOCKED] 3-tier resolution for every configurable path.** Override → convention/env-var → diagnostic with install command AND `gimlet.json` alternative.
- **[LOCKED] Validate at the boundary, one toast.** Bad `gimlet.json` → single aggregated error message enumerating all violations; unknown keys warn, not reject.
- **[LOCKED] Don't auto-write override keys.** `lldbLibraryPath`, `depsPath`, `inputPath` stay absent in `gimlet.json` unless the user set them. Absence means "use default."
- **[LOCKED] Atomic commit for 1+2+2a.** Shipping Change 2 without 2a regresses the polling loop; shipping Change 1 without 2 keeps the module-load throw in place.
- **[LOCKED] Workspace containment check for overridable paths.** Resolved `depsPath`/`inputPath` must `startsWith(workspaceFolder + path.sep)` — same rule as `sbfTraceDir`.

## Tasks

Six atomic commits in order. Each task = one commit.

- [ ] **Task 1 — Change 5: null-guard `resolveGimletConfig()` return in `scanDeployDirectory`**
  - AC: AC-1
  - Files: `src/extension.js` (:51-53)
  - Depends: none

- [ ] **Task 2 — Changes 1 + 2 + 2a: lazy LLDB getter + `platformToolsDir` + `lldbLibraryPath` overrides + relocate `updates` into existing try**
  - AC: AC-2, AC-3, AC-3b, AC-4, AC-4b, AC-5, AC-11
  - Files: `src/state/globalState.js` (constructor, platform-tools derivation methods, `getLldbLibraryPath`, `setConfig`, module export), `src/managers/debugConfigManager.js` (consume derivation methods + remediation toast copy — amended A-1), `src/managers/portManager.js` (one-line move only)
  - Depends: Task 1
  - Amendment: A-1 (scope widened — see `docs/amendments.md`)

- [ ] **Task 3 — Change 4: `SCHEMA` + `validateConfig` + aggregated toast in `setConfig`**
  - AC: AC-6
  - Files: `src/state/globalState.js`
  - Depends: Task 2 (SCHEMA must include `lldbLibraryPath` from Task 2)

- [ ] **Task 4 — Change 3: `depsPath` + `inputPath` 3-tier resolution with containment check**
  - AC: AC-7, AC-8
  - Files: `src/config.js` (:31, :43-44), `src/state/globalState.js` (extend SCHEMA + `setConfig` with `depsPath`/`inputPath`)
  - Depends: Task 3

- [ ] **Task 5 — Change 6: diff-then-write `gimlet.json` in `ensureGimletConfig`**
  - AC: AC-9
  - Files: `src/config.js` (:82-83)
  - Depends: none (could run in parallel with Task 3 or 4, but sequenced to keep config.js diffs reviewable)

- [ ] **Task 6 — Change 7: dispose previous watcher in `watchGimletConfig`**
  - AC: AC-10
  - Files: `src/config.js` (:87-111)
  - Depends: Task 5

## must_haves

truths:
  - "require('./state/globalState') never throws; first access to globalState.lldbLibrary throws only inside the existing try/catch in runDebugSessionIteration."
  - "gimlet.json.lldbLibraryPath, when set and pointing at a real file, is the value that withLldbConfig injects as lldb.library for a Gimlet session."
  - "After a Gimlet session ends (success or failure), .vscode/settings.json on disk contains the user's original lldb.library value (or is restored to absent if originally absent)."
  - "Malformed gimlet.json values produce exactly one aggregated error toast; activation continues with defaults where a field was invalid."
  - "Resolved depsPath and inputPath are always inside the workspace root; attempts to escape produce an error toast and return null from resolveGimletConfig()."
  - "Activating N times in a row with no gimlet.json content change writes to gimlet.json zero times after the first (no mtime churn)."
  - "Editing gimlet.json once fires exactly one reload toast regardless of how many activateDebugger calls have occurred."

artifacts:
  - "src/state/globalState.js"
  - "src/managers/portManager.js"
  - "src/config.js"
  - "src/extension.js"

key_links:
  - "get lldbLibrary()"
  - "invalidateLldbLibrary"
  - "lldbLibraryPathOverride"
  - "validateConfig"
  - "const SCHEMA ="
  - "this._configWatcher"
  - "CARGO_TARGET_DIR"

## Detected Conventions

- **Module system:** CommonJS (`require` / `module.exports`), not ESM.
- **Error surfacing:** `vscode.window.showErrorMessage('Gimlet: ...')` — always prefixed with `Gimlet:` for user-facing errors.
- **Logging:** `const { log, error } = require('./logger');` — use `log()` / `error()`, never `console.*`.
- **Paths:** `path.join` / `path.resolve` — never string concatenation for filesystem paths.
- **File I/O:** `fs.realpathSync` for resolving + existence check (throws when missing — see existing `getLldbLibraryPath`); `fs.existsSync` for pure existence checks; `fs.readFileSync(..., 'utf8')` for text reads.
- **State mutation:** `globalState.setConfig(config)` is the only write path for user config; always flowed through the singleton.
- **Config lifecycle:** `ensureGimletConfig()` writes defaults once, `watchGimletConfig()` reloads on change, `resolveGimletConfig()` computes derived paths on demand.
- **Disposables:** pushed onto `context.subscriptions` for VS Code lifecycle; for manager-owned ones, hold on `this._foo` and dispose before re-registering.
- **Workspace containment:** `path.resolve(workspaceFolder, input).startsWith(workspaceFolder + path.sep)` — the pattern at `config.js:34`.
- **No tests in repo.** Verification is manual per the doc's test matrix + the extra scenarios for the 1+2+2a commit.

## Test Tooling Note

`package.json` has no `test` script. Baseline test snapshot step will record `baselineTests: { noInfra: true }`. Gate 5 "no new failures" criterion will be skipped with that note. Verification rests on:
- `npm run lint` and `npm run format` (detected).
- The manual test matrix in `docs/user-context/config-hardening-plan.md` — 4 activation scenarios + re-activation test, plus 4 extra scenarios for the 1+2+2a commit.
