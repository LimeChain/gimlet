# Amendments

Live log of in-flight deviations from the plan and quick-spec. Entries are immutable once written (append-only); obsolete entries are marked **[RESOLVED]** or **[SUPERSEDED]** rather than deleted.

---

## A-1 — 2026-04-21 — Widen Change 1 from `lldbLibraryPath` to `platformToolsDir` + `lldbLibraryPath`

**Trigger:** During Task 2 manual verification, `lldbLibraryPath` alone did not fully unblock the user's workflow when the platform-tools directory was renamed from `~/.cache/solana/v1.54/` to `~/.cache/solana/proba/`. Two additional errors surfaced from code the plan had not audited:

- `getLldbPythonPath()` at `src/managers/debugConfigManager.js:26-54` — produced toast: `Gimlet: Solana platform-tools v1.54 not found at ~/.cache/solana/v1.54/platform-tools/llvm/lib. Run 'cargo-build-sbf --tools-version v1.54' to install them.`
- `getSolanaScriptsDir()` at `src/managers/debugConfigManager.js:14-24` — produced CodeLLDB error: `module importing failed: invalid pathname '.../v1.54/platform-tools/llvm/bin/lldb_lookup.py'`

Three hardcoded paths share the same `~/.cache/solana/v{version}/platform-tools/` root. A single-file `lldbLibraryPath` override covers only one of them.

**Resolution:** Primary override is now `platformToolsDir` — the platform-tools root. All three subpaths derive from it:
- LLDB library default: `{platformToolsDir}/llvm/lib/liblldb.{ext}`
- Python site-packages search base: `{platformToolsDir}/llvm/lib/`
- LLDB scripts dir: `{platformToolsDir}/llvm/bin/`

`lldbLibraryPath` is retained as a finer-grained override that wins over the derived LLDB default when the library has a non-conventional filename (e.g., user's `liblldb.20.1.7-rust-dev.dylib`) or the `liblldb.{ext}` symlink is missing.

**Scope impact on Task 2 commit:**
- Added `src/managers/debugConfigManager.js` to the commit's file set.
- Added `platformToolsDirOverride` field and three derivation methods (`getPlatformToolsDir`, `getPlatformToolsLibDir`, `getPlatformToolsBinDir`) to `GimletGeneralState`.
- Updated the "platform-tools not found" toast in `debugConfigManager.js` to name `platformToolsDir` as an alternative remediation.
- Deferred `platformToolsDir` SCHEMA entry to Task 3 (config validation) — must be added there.
- `withLldbConfig` remains untouched. Preservation contract upheld.

**Deviation class:** Rule 3 (significant — surface-area change to the gimlet.json config API).

**Follow-up items:**
- Task 3 (validation SCHEMA) must include `platformToolsDir: { type: 'string', optional: true }`.
- README section on config keys must document both `platformToolsDir` and `lldbLibraryPath` with guidance on when to use which.
- Verification matrix in `config-hardening-plan.md` should add: "set `platformToolsDir` pointing at a renamed install; confirm Python path and scripts dir both resolve" scenario.

---

## A-2 — 2026-04-21 — Expand Task 6 scope to cover all three file watcher events

**Trigger:** During Task 2 live-reload testing, user reported that deleting `lldbLibraryPath` / `platformToolsDir` keys from `gimlet.json` sometimes failed to revert to defaults without an IDE reload. Root-cause investigation identified a gap in the watcher: only `onDidChange` is handled, not `onDidCreate` or `onDidDelete`. Editors that save atomically (rename + replace — triggered by format-on-save, some extensions, or Windows behaviour) fire `onDidDelete + onDidCreate` instead of `onDidChange`, bypassing the reload.

**Resolution:** Expand Task 6 (currently scoped to the watcher-leak dispose fix) to also register `onDidCreate` and `onDidDelete` handlers in `watchGimletConfig`:
- `onDidChange`, `onDidCreate` — read file, parse JSON, call `globalState.setConfig(parsed)`, toast.
- `onDidDelete` — call `globalState.setConfig({})` to reset all overrides to null (equivalent to a `{}` file), toast "Gimlet config removed; using defaults."

New AC-10b added to `docs/quick-config-hardening.md` to cover the broader event matrix.

**Deviation class:** Rule 2 (moderate — task scope expansion, not architectural).

**Out of scope for this amendment:** Stale `.vscode/settings.json` state left by crashed sessions (`lldb.library` retaining Gimlet's injected override value); CodeLLDB configuration caching behaviour. Both may need their own follow-ups after this story ships, based on further testing.
